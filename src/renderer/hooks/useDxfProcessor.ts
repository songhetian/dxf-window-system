import { useCallback, useRef } from 'react';
import { notifications } from '@mantine/notifications';

import {
  calculateArea,
  calculatePerimeter,
  calculateBoundingBox,
  calculateSymmetryRate,
  analyzePathFeatures,
  isPointInPolygon,
} from '../../shared/utils';
import { useCreateDrawing } from './useWindowApi';
import { WindowItem } from '../../shared/schemas';
import { useWindowStore } from '../stores/windowStore';
import { useShallow } from 'zustand/react/shallow';

const ACI_COLORS: Record<number, string> = {
  1: '#FF0000', 2: '#FFFF00', 3: '#00FF00', 4: '#00FFFF', 5: '#0000FF', 6: '#FF00FF',
  7: '#1A1B1E', 8: '#808080', 9: '#C0C0C0', 256: '#1A1B1E', 0: '#1A1B1E',
};

const SNAP_PRECISION = 2;
const MIN_LOOP_AREA = 20_000;
const ENTITIES_PER_PATH = 5000;
const BATCH_SIZE = 1000;

type Point = { x: number; y: number };
type TextMarker = { text: string; x: number; y: number; layer: string };
type RecognitionMarker = TextMarker;
type MatchedLabel = { marker: TextMarker; code: string };
type OrientationHintBox = {
  box: { width: number; height: number; centerX: number; centerY: number };
};
type FlatEntity = {
  type: string;
  pts: Point[];
  colorIdx: number;
  linetype: string;
  layer: string;
  raw: any;
  isClosed: boolean;
};
type LoopCandidate = {
  pts: Point[];
  area: number;
  box: { width: number; height: number; centerX: number; centerY: number };
  raw: any;
  fingerprint: string;
  sourceKind: 'closed' | 'segment' | 'component';
};
type ComponentCandidate = {
  pts: Point[];
  box: { width: number; height: number; centerX: number; centerY: number };
  axisCoverageX: number;
  axisCoverageY: number;
  density: number;
  fingerprint: string;
};
type LoopScoreMeta = {
  nestedChildren: number;
  sourcePenalty: number;
  oversizePenalty: number;
  minDimension: number;
  baseDistanceLimit: number;
};
type ExcludedLayerDetail = {
  layer: string;
  entityCount: number;
  labelCount: number;
};
type LabelCodeStat = {
  code: string;
  rawCount: number;
  matchedCount: number;
};
type RecognitionSummary = {
  totalLabels: number;
  matchedLabels: number;
  candidateLabelCodes: string[];
  matchedLabelCodes: string[];
  rawLabelSamples: string[];
  labelCodeStats: LabelCodeStat[];
  unmatchedLabels: string[];
  unmatchedLabelMarkers: RecognitionMarker[];
  diagnostic: {
    rawTextCount: number;
    regexMatchedTextCount: number;
    filteredLabelCount: number;
    filteredEntityCount: number;
    loopCandidateCount: number;
    reason: string;
  };
  includedLayers: string[];
  excludedLayers: string[];
  excludedLayerDetails: ExcludedLayerDetail[];
  activeEntityLayers: string[];
  activeLabelLayers: string[];
};
type ProcessedResult = {
  pathChunks: { color: string; paths: Path2D[] }[];
  textMarkers?: RecognitionMarker[];
  bounds: any;
  totalEntities: number;
  recognitionSummary?: RecognitionSummary;
};

const rotate = (x: number, y: number, angle: number) => {
  if (!angle) return { x, y };
  const r = (angle * Math.PI) / 180;
  return { x: x * Math.cos(r) - y * Math.sin(r), y: x * Math.sin(r) + y * Math.cos(r) };
};

const makePointKey = (point: Point) => `${Math.round(point.x / SNAP_PRECISION)},${Math.round(point.y / SNAP_PRECISION)}`;

const normalizeText = (text: string) => text.replace(/\\P/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase();
const compactLabelText = (text: string) => normalizeText(text).replace(/[\s_\-－–—'’‘`′＇"“”″]+/g, '');
const stripDxfTextFormatting = (text: string) => text
  .replace(/\\P/gi, ' ')
  .replace(/\\[AaCcFfHhLlOoPpQqTtWw][^;]*;/g, '')
  .replace(/[{}]/g, ' ')
  .replace(/\^I/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();
const extractEntityText = (entity: any) => {
  const rawValue = entity.text
    ?? entity.string
    ?? entity.plainText
    ?? entity.rawText
    ?? entity.value
    ?? '';
  if (typeof rawValue !== 'string') return '';
  return normalizeText(stripDxfTextFormatting(rawValue));
};
const escapeRegExp = (value: string) => value
  .replaceAll('\\', '\\\\')
  .replaceAll('.', '\\.')
  .replaceAll('*', '\\*')
  .replaceAll('+', '\\+')
  .replaceAll('?', '\\?')
  .replaceAll('^', '\\^')
  .replaceAll('$', '\\$')
  .replaceAll('{', '\\{')
  .replaceAll('}', '\\}')
  .replaceAll('(', '\\(')
  .replaceAll(')', '\\)')
  .replaceAll('|', '\\|')
  .replaceAll('[', '\\[')
  .replaceAll(']', '\\]');
const parsePrefixes = (value: string) => value
  .split(/[，,\s]+/)
  .map((item) => compactLabelText(item))
  .filter(Boolean)
  .sort((a, b) => b.length - a.length);
const splitCandidateTokens = (text: string) => normalizeText(text)
  .split(/[\s,，;；:：、()（）[\]【】<>《》/\\|]+/)
  .map((item) => item.trim())
  .filter(Boolean);

const expandPrefixes = (prefixes: string[]) => [...prefixes].sort((a, b) => b.length - a.length);

const buildLabelPatternRegex = (pattern: string) => new RegExp(pattern || '^C\\d{4}$', 'i');
const buildPrefixOnlyRegex = (prefix: string) => new RegExp(
  `^${escapeRegExp(prefix)}\\d{2,}[A-Z\\u4E00-\\u9FFF\\u0027\\u2019\\u2018\\u2032\\uFF07\\u0022\\u201C\\u201D\\u2033]{0,4}$`,
  'i',
);

const matchStandaloneLabelCode = (candidate: string, regex: RegExp, prefixes: string[]) => {
  if (!candidate) return null;

  const normalized = normalizeText(candidate);
  const compact = compactLabelText(candidate);
  const normalizedCandidates = [normalized, compact]
    .map((item) => item.trim())
    .filter(Boolean);

  for (const item of normalizedCandidates) {
    const match = item.match(regex);
    if (match?.[0] && compactLabelText(match[0]) === compactLabelText(item)) {
      return compactLabelText(match[0]).toUpperCase();
    }
  }

  for (const prefix of prefixes) {
    const prefixRegex = buildPrefixOnlyRegex(prefix);
    if (prefixRegex.test(compact)) {
      return compact.toUpperCase();
    }
  }

  return null;
};

const findLabelCode = (text: string, pattern: string, prefixes: string[]) => {
  const regex = buildLabelPatternRegex(pattern);
  const normalized = normalizeText(text);
  const compact = compactLabelText(text);
  const tokens = splitCandidateTokens(text);
  const candidates = [
    normalized,
    compact,
    ...tokens,
    ...tokens.map((item) => compactLabelText(item)),
  ];

  for (const candidate of candidates) {
    const matched = matchStandaloneLabelCode(candidate, regex, prefixes);
    if (matched) return matched;
  }

  return null;
};

const pointToBoxDistance = (point: Point, box: LoopCandidate['box']) => {
  const dx = Math.max(Math.abs(point.x - box.centerX) - box.width / 2, 0);
  const dy = Math.max(Math.abs(point.y - box.centerY) - box.height / 2, 0);
  return Math.hypot(dx, dy);
};
const isLoopContainingLoop = (outer: LoopCandidate, inner: LoopCandidate) => {
  if (outer.fingerprint === inner.fingerprint) return false;
  if (outer.area <= inner.area) return false;
  const centerPoint = { x: inner.box.centerX, y: inner.box.centerY };
  return isPointInPolygon(centerPoint, outer.pts);
};

const makeLoopFingerprint = (points: Point[], area: number) => {
  const box = calculateBoundingBox(points);
  return [
    Math.round(box.centerX / 10),
    Math.round(box.centerY / 10),
    Math.round(box.width / 10),
    Math.round(box.height / 10),
    Math.round(area / 100),
  ].join(':');
};

const isDashedLine = (lineType: string, colorIdx: number) => {
  const upper = lineType.toUpperCase();
  return upper.includes('DASH') || upper.includes('HIDDEN') || upper.includes('DOT') || colorIdx === 8 || colorIdx === 9;
};

const parseLayerKeywords = (value: string) => value
  .split(/[，,\n\s]+/)
  .map((item) => item.trim().toUpperCase())
  .filter(Boolean);

const matchesLayerKeyword = (layer: string, keywords: string[]) => {
  if (!keywords.length) return false;
  const normalized = layer.toUpperCase();
  return keywords.some((keyword) => normalized.includes(keyword));
};

const uniqueSorted = (items: string[]) => [...new Set(items.filter(Boolean))].sort((a, b) => a.localeCompare(b));
const loopSourcePriority: Record<LoopCandidate['sourceKind'], number> = {
  closed: 0,
  segment: 1,
  component: 2,
};

const collectLoopsFromSegments = (entities: FlatEntity[]) => {
  const edges = new Map<number, { a: string; b: string }>();
  const nodes = new Map<string, Point>();
  const adjacency = new Map<string, number[]>();

  const addEdge = (from: Point, to: Point, edgeId: number) => {
    const fromKey = makePointKey(from);
    const toKey = makePointKey(to);
    if (fromKey === toKey) return false;

    edges.set(edgeId, { a: fromKey, b: toKey });
    if (!nodes.has(fromKey)) nodes.set(fromKey, from);
    if (!nodes.has(toKey)) nodes.set(toKey, to);
    adjacency.set(fromKey, [...(adjacency.get(fromKey) || []), edgeId]);
    adjacency.set(toKey, [...(adjacency.get(toKey) || []), edgeId]);
    return true;
  };

  let edgeId = 0;
  entities.forEach((entity) => {
    if (entity.pts.length < 2) return;

    for (let i = 1; i < entity.pts.length; i += 1) {
      addEdge(entity.pts[i - 1], entity.pts[i], edgeId);
      edgeId += 1;
    }

    if (entity.isClosed) {
      addEdge(entity.pts[entity.pts.length - 1], entity.pts[0], edgeId);
      edgeId += 1;
    }
  });

  const visitedNodes = new Set<string>();
  const loops: Point[][] = [];

  const traceCycle = (startKey: string, componentEdges: Set<number>) => {
    const firstEdgeId = adjacency.get(startKey)?.find((id) => componentEdges.has(id));
    if (firstEdgeId === undefined) return null;

    const cycle: Point[] = [nodes.get(startKey)!];
    const usedEdges = new Set<number>();
    let currentKey = startKey;
    let currentEdgeId = firstEdgeId;

    while (true) {
      if (usedEdges.has(currentEdgeId)) return null;
      usedEdges.add(currentEdgeId);

      const edge = edges.get(currentEdgeId);
      if (!edge) return null;

      const nextKey = edge.a === currentKey ? edge.b : edge.a;
      cycle.push(nodes.get(nextKey)!);

      if (nextKey === startKey) {
        cycle.pop();
        return cycle;
      }

      const nextEdgeId = (adjacency.get(nextKey) || []).find((id) => componentEdges.has(id) && !usedEdges.has(id));
      if (nextEdgeId === undefined) return null;

      currentKey = nextKey;
      currentEdgeId = nextEdgeId;
      if (cycle.length > componentEdges.size + 2) return null;
    }
  };

  for (const nodeKey of nodes.keys()) {
    if (visitedNodes.has(nodeKey)) continue;

    const stack = [nodeKey];
    const componentNodes = new Set<string>();
    const componentEdges = new Set<number>();

    while (stack.length > 0) {
      const key = stack.pop()!;
      if (componentNodes.has(key)) continue;
      componentNodes.add(key);
      visitedNodes.add(key);

      const connectedEdges = adjacency.get(key) || [];
      connectedEdges.forEach((id) => {
        componentEdges.add(id);
        const edge = edges.get(id);
        if (!edge) return;
        const otherKey = edge.a === key ? edge.b : edge.a;
        if (!componentNodes.has(otherKey)) stack.push(otherKey);
      });
    }

    if (componentNodes.size < 3 || componentEdges.size < 3) continue;
    if (![...componentNodes].every((key) => (adjacency.get(key) || []).length === 2)) continue;

    const cycle = traceCycle(nodeKey, componentEdges);
    if (cycle && cycle.length >= 3) loops.push(cycle);
  }

  return loops;
};

const collectComponentCandidates = (entities: FlatEntity[]) => {
  const edges = new Map<number, { a: string; b: string; from: Point; to: Point }>();
  const nodes = new Map<string, Point>();
  const adjacency = new Map<string, number[]>();

  const addEdge = (from: Point, to: Point, edgeId: number) => {
    const fromKey = makePointKey(from);
    const toKey = makePointKey(to);
    if (fromKey === toKey) return false;

    edges.set(edgeId, { a: fromKey, b: toKey, from, to });
    if (!nodes.has(fromKey)) nodes.set(fromKey, from);
    if (!nodes.has(toKey)) nodes.set(toKey, to);
    adjacency.set(fromKey, [...(adjacency.get(fromKey) || []), edgeId]);
    adjacency.set(toKey, [...(adjacency.get(toKey) || []), edgeId]);
    return true;
  };

  let edgeId = 0;
  entities.forEach((entity) => {
    if (entity.pts.length < 2) return;
    for (let i = 1; i < entity.pts.length; i += 1) {
      addEdge(entity.pts[i - 1], entity.pts[i], edgeId);
      edgeId += 1;
    }
    if (entity.isClosed) {
      addEdge(entity.pts[entity.pts.length - 1], entity.pts[0], edgeId);
      edgeId += 1;
    }
  });

  const visitedNodes = new Set<string>();
  const components: ComponentCandidate[] = [];

  for (const nodeKey of nodes.keys()) {
    if (visitedNodes.has(nodeKey)) continue;

    const stack = [nodeKey];
    const componentNodes = new Set<string>();
    const componentEdges = new Set<number>();

    while (stack.length > 0) {
      const key = stack.pop()!;
      if (componentNodes.has(key)) continue;
      componentNodes.add(key);
      visitedNodes.add(key);

      const connectedEdges = adjacency.get(key) || [];
      connectedEdges.forEach((id) => {
        componentEdges.add(id);
        const edge = edges.get(id);
        if (!edge) return;
        const otherKey = edge.a === key ? edge.b : edge.a;
        if (!componentNodes.has(otherKey)) stack.push(otherKey);
      });
    }

    if (componentNodes.size < 4 || componentEdges.size < 4) continue;

    const points = [...componentNodes].map((key) => nodes.get(key)!);
    const box = calculateBoundingBox(points);
    if (!Number.isFinite(box.width) || !Number.isFinite(box.height) || box.width <= 0 || box.height <= 0) continue;

    const tolerance = Math.max(SNAP_PRECISION * 2, Math.min(box.width, box.height) * 0.04);
    let coverLeft = 0;
    let coverRight = 0;
    let coverTop = 0;
    let coverBottom = 0;

    componentEdges.forEach((id) => {
      const edge = edges.get(id);
      if (!edge) return;
      const dx = Math.abs(edge.to.x - edge.from.x);
      const dy = Math.abs(edge.to.y - edge.from.y);

      if (dy <= tolerance) {
        const len = dx;
        if (Math.abs(edge.from.y - (box.centerY - box.height / 2)) <= tolerance
          && Math.abs(edge.to.y - (box.centerY - box.height / 2)) <= tolerance) {
          coverBottom += len;
        }
        if (Math.abs(edge.from.y - (box.centerY + box.height / 2)) <= tolerance
          && Math.abs(edge.to.y - (box.centerY + box.height / 2)) <= tolerance) {
          coverTop += len;
        }
      }

      if (dx <= tolerance) {
        const len = dy;
        if (Math.abs(edge.from.x - (box.centerX - box.width / 2)) <= tolerance
          && Math.abs(edge.to.x - (box.centerX - box.width / 2)) <= tolerance) {
          coverLeft += len;
        }
        if (Math.abs(edge.from.x - (box.centerX + box.width / 2)) <= tolerance
          && Math.abs(edge.to.x - (box.centerX + box.width / 2)) <= tolerance) {
          coverRight += len;
        }
      }
    });

    const axisCoverageX = Math.max(coverTop, coverBottom) / Math.max(box.width, 1);
    const axisCoverageY = Math.max(coverLeft, coverRight) / Math.max(box.height, 1);
    const density = componentEdges.size / Math.max(points.length, 1);
    const rectPts = [
      { x: box.centerX - box.width / 2, y: box.centerY - box.height / 2 },
      { x: box.centerX + box.width / 2, y: box.centerY - box.height / 2 },
      { x: box.centerX + box.width / 2, y: box.centerY + box.height / 2 },
      { x: box.centerX - box.width / 2, y: box.centerY + box.height / 2 },
    ];

    components.push({
      pts: rectPts,
      box,
      axisCoverageX,
      axisCoverageY,
      density,
      fingerprint: makeLoopFingerprint(rectPts, box.width * box.height),
    });
  }

  return components;
};

const buildLoopCandidates = (
  entities: FlatEntity[],
  wallAreaThreshold: number,
  minWindowArea: number,
  minSideLength: number,
) => {
  const loopMap = new Map<string, LoopCandidate>();
  const walls: LoopCandidate[] = [];

  const pushLoop = (points: Point[], raw: any, sourceKind: LoopCandidate['sourceKind']) => {
    if (points.length < 3) return;
    const area = calculateArea(points);
    if (area < MIN_LOOP_AREA) return;

    const box = calculateBoundingBox(points);
    const fingerprint = makeLoopFingerprint(points, area);
    const target = area >= wallAreaThreshold ? walls : null;

    if (target) {
      if (!walls.some((item) => item.fingerprint === fingerprint)) {
        walls.push({ pts: points, area, box, raw, fingerprint, sourceKind });
      }
      return;
    }

    if (area < minWindowArea) return;
    if (box.width < minSideLength || box.height < minSideLength) return;

    const nextLoop = { pts: points, area, box, raw, fingerprint, sourceKind };
    const currentLoop = loopMap.get(fingerprint);
    if (!currentLoop || loopSourcePriority[sourceKind] < loopSourcePriority[currentLoop.sourceKind]) {
      loopMap.set(fingerprint, nextLoop);
    }
  };

  entities.forEach((entity) => {
    if (entity.isClosed && entity.pts.length >= 3) {
      pushLoop(entity.pts, entity.raw, 'closed');
    }
  });

  collectLoopsFromSegments(entities).forEach((points) => {
    pushLoop(points, { type: 'SEGMENT_LOOP' }, 'segment');
  });

  collectComponentCandidates(entities).forEach((component) => {
    if (component.axisCoverageX < 0.72 || component.axisCoverageY < 0.72) return;
    if (component.density < 1) return;
    pushLoop(component.pts, {
      type: 'COMPONENT_BOX',
      axisCoverageX: component.axisCoverageX,
      axisCoverageY: component.axisCoverageY,
      density: component.density,
    }, 'component');
  });

  return {
    walls,
    loops: [...loopMap.values()],
  };
};

const scoreLoopForLabel = (
  label: TextMarker,
  loop: LoopCandidate,
  loopMeta: LoopScoreMeta,
  labelMaxDistance: number,
  options?: { relaxDistance?: boolean },
) => {
  const contains = isPointInPolygon(label, loop.pts);
  const boxDistance = pointToBoxDistance(label, loop.box);
  const centerDistance = Math.hypot(label.x - loop.box.centerX, label.y - loop.box.centerY);
  const distanceLimit = options?.relaxDistance ? Math.max(loopMeta.baseDistanceLimit * 4, 5000) : loopMeta.baseDistanceLimit;
  const normalizedCenterDistance = centerDistance / Math.max(loopMeta.minDimension, 1);
  const outsidePenalty = contains ? 0 : 8000;
  const nestedPenalty = loopMeta.nestedChildren > 0
    ? Math.min(loopMeta.nestedChildren * (loop.sourceKind === 'component' ? 2200 : 950), 12000)
    : 0;

  if (!contains && boxDistance > distanceLimit) return null;

  return {
    loop,
    score: loopMeta.sourcePenalty
      + outsidePenalty
      + boxDistance * 14
      + centerDistance
      + normalizedCenterDistance * 180
      + loop.area * 0.00006
      + nestedPenalty
      + loopMeta.oversizePenalty,
  };
};

const buildLoopScoreMeta = (
  loops: LoopCandidate[],
  labelMaxDistance: number,
) => {
  const nestedChildrenMap = new Map<string, number>();
  loops.forEach((loop) => nestedChildrenMap.set(loop.fingerprint, 0));

  for (let i = 0; i < loops.length; i += 1) {
    for (let j = 0; j < loops.length; j += 1) {
      if (i === j) continue;
      if (isLoopContainingLoop(loops[i], loops[j])) {
        nestedChildrenMap.set(loops[i].fingerprint, (nestedChildrenMap.get(loops[i].fingerprint) || 0) + 1);
      }
    }
  }

  return new Map<string, LoopScoreMeta>(
    loops.map((loop) => [
      loop.fingerprint,
      {
        nestedChildren: nestedChildrenMap.get(loop.fingerprint) || 0,
        sourcePenalty: loop.sourceKind === 'closed' ? 0 : loop.sourceKind === 'segment' ? 1200 : 4800,
        oversizePenalty: loop.sourceKind === 'component' && loop.area > 8_000_000
          ? Math.min((loop.area - 8_000_000) / 1500, 6000)
          : 0,
        minDimension: Math.max(Math.min(loop.box.width, loop.box.height), 1),
        baseDistanceLimit: Math.max(labelMaxDistance, Math.max(loop.box.width, loop.box.height) * 0.35),
      },
    ]),
  );
};

const matchLabelsToLoops = (
  labels: MatchedLabel[],
  loops: LoopCandidate[],
  labelMaxDistance: number,
  options?: { relaxDistance?: boolean; preferStrongLoops?: boolean },
) => {
  if (labels.length === 0 || loops.length === 0) {
    return {
      matches: [] as Array<{ label: MatchedLabel; loop: LoopCandidate; score: number }>,
      unmatchedLabels: labels,
      remainingLoops: loops,
    };
  }

  const loopScoreMeta = buildLoopScoreMeta(loops, labelMaxDistance);
  const strongLoops = loops.filter((loop) => loop.sourceKind !== 'component');
  const scoredPairs: Array<{ labelIndex: number; loopFingerprint: string; loop: LoopCandidate; score: number }> = [];

  labels.forEach((label, labelIndex) => {
    const buildCandidates = (candidateLoops: LoopCandidate[]) => {
      const nearbyLoops = candidateLoops
        .map((loop) => ({
          loop,
          boxDistance: pointToBoxDistance(label.marker, loop.box),
          meta: loopScoreMeta.get(loop.fingerprint)!,
        }))
        .filter(({ boxDistance, meta }) => boxDistance <= (options?.relaxDistance ? Math.max(meta.baseDistanceLimit * 4, 5000) : meta.baseDistanceLimit))
        .sort((a, b) => a.boxDistance - b.boxDistance)
        .slice(0, 18);

      const scopedLoops = nearbyLoops.length > 0
        ? nearbyLoops
        : candidateLoops
          .map((loop) => ({
            loop,
            boxDistance: pointToBoxDistance(label.marker, loop.box),
            meta: loopScoreMeta.get(loop.fingerprint)!,
          }))
          .sort((a, b) => a.boxDistance - b.boxDistance)
          .slice(0, 8);

      return scopedLoops
        .map(({ loop, meta }) => scoreLoopForLabel(label.marker, loop, meta, labelMaxDistance, options))
        .filter(Boolean) as Array<{ loop: LoopCandidate; score: number }>;
    };

    const strongCandidates = buildCandidates(strongLoops);
    const candidateBase = options?.preferStrongLoops && strongCandidates.length > 0
      ? strongCandidates
      : buildCandidates(loops);

    candidateBase.forEach((candidate) => {
      scoredPairs.push({
        labelIndex,
        loopFingerprint: candidate.loop.fingerprint,
        loop: candidate.loop,
        score: candidate.score,
      });
    });
  });

  scoredPairs.sort((a, b) => a.score - b.score);

  const usedLabelIndexes = new Set<number>();
  const usedLoopFingerprints = new Set<string>();
  const matches: Array<{ label: MatchedLabel; loop: LoopCandidate; score: number }> = [];

  scoredPairs.forEach((pair) => {
    if (usedLabelIndexes.has(pair.labelIndex) || usedLoopFingerprints.has(pair.loopFingerprint)) return;
    usedLabelIndexes.add(pair.labelIndex);
    usedLoopFingerprints.add(pair.loopFingerprint);
    matches.push({
      label: labels[pair.labelIndex],
      loop: pair.loop,
      score: pair.score,
    });
  });

  return {
    matches,
    unmatchedLabels: labels.filter((_label, index) => !usedLabelIndexes.has(index)),
    remainingLoops: loops.filter((loop) => !usedLoopFingerprints.has(loop.fingerprint)),
  };
};

const resolveOpeningType = (
  box: LoopCandidate['box'],
  area: number,
  orientationHintBoxes: OrientationHintBox[],
) => {
  let openingCount = 0;
  let singleHintCenterX: number | null = null;

  orientationHintBoxes.forEach(({ box: hintBox }) => {
    if (
      hintBox.centerX > box.centerX - box.width / 2
      && hintBox.centerX < box.centerX + box.width / 2
      && hintBox.centerY > box.centerY - box.height / 2
      && hintBox.centerY < box.centerY + box.height / 2
    ) {
      openingCount += 1;
      if (singleHintCenterX === null) singleHintCenterX = hintBox.centerX;
    }
  });

  if (openingCount >= 2) return '双开窗';
  if (openingCount === 1 && singleHintCenterX !== null) {
    const openingSide = singleHintCenterX < box.centerX ? '左开' : '右开';
    return `单开窗(${openingSide})`;
  }
  if (area < 1_000_000) return '固定窗';
  return '推拉窗';
};

export const useDxfProcessor = () => {
  const {
    scaleFactor,
    profileWidth,
    unitWeight,
    identRules,
    processedResult,
    setProcessedResult,
    analysisFileName: fileName,
    setAnalysisFileName,
    sourceContent,
    setSourceContent,
    pendingWindows,
    setPendingWindows,
    analysisProgress: progress,
    setAnalysisProgress,
    analysisProcessing: isProcessing,
    setAnalysisProcessing,
    clearAnalysisSession,
  } = useWindowStore(useShallow((state) => ({
    scaleFactor: state.scaleFactor,
    profileWidth: state.profileWidth,
    unitWeight: state.unitWeight,
    identRules: state.identRules,
    processedResult: state.processedResult,
    setProcessedResult: state.setProcessedResult,
    analysisFileName: state.analysisFileName,
    setAnalysisFileName: state.setAnalysisFileName,
    sourceContent: state.sourceContent,
    setSourceContent: state.setSourceContent,
    pendingWindows: state.pendingWindows,
    setPendingWindows: state.setPendingWindows,
    analysisProgress: state.analysisProgress,
    setAnalysisProgress: state.setAnalysisProgress,
    analysisProcessing: state.analysisProcessing,
    setAnalysisProcessing: state.setAnalysisProcessing,
    clearAnalysisSession: state.clearAnalysisSession,
  })));
  const createDrawingMutation = useCreateDrawing();
  const activeRunIdRef = useRef(0);
  const activeRecognitionKeyRef = useRef<string | null>(null);
  const lastCompletedRecognitionKeyRef = useRef<string | null>(null);
  const lastImportedSignatureRef = useRef<string | null>(null);

  const clear = useCallback(() => {
    activeRunIdRef.current += 1;
    activeRecognitionKeyRef.current = null;
    lastCompletedRecognitionKeyRef.current = null;
    lastImportedSignatureRef.current = null;
    clearAnalysisSession();
  }, [clearAnalysisSession]);

  const runRecognition = useCallback(async (
    content: string,
    options?: { enabledExcludedLayers?: string[] },
  ) => {
    const enabledExcludedLayersList = [...(options?.enabledExcludedLayers || [])].sort((a, b) => a.localeCompare(b));
    const recognitionKey = JSON.stringify({
      pattern: identRules.windowPattern,
      include: identRules.layerIncludeKeywords,
      exclude: identRules.layerExcludeKeywords,
      wall: identRules.wallAreaThreshold,
      minArea: identRules.minWindowArea,
      minSide: identRules.minSideLength,
      maxDistance: identRules.labelMaxDistance,
      enabledExcludedLayers: enabledExcludedLayersList,
      contentLength: content.length,
    });

    if (activeRecognitionKeyRef.current === recognitionKey || lastCompletedRecognitionKeyRef.current === recognitionKey) {
      return;
    }

    const runId = activeRunIdRef.current + 1;
    activeRunIdRef.current = runId;
    activeRecognitionKeyRef.current = recognitionKey;
    const enabledExcludedLayers = new Set((options?.enabledExcludedLayers || []).map((item) => item.toUpperCase()));
    const shouldExcludeLayer = (layer: string, excludeKeywords: string[]) => (
      matchesLayerKeyword(layer, excludeKeywords) && !enabledExcludedLayers.has(layer.toUpperCase())
    );

    try {
      setAnalysisProcessing(true);
      setAnalysisProgress(5);

      const parsed = await (window as any).electronAPI.parseDxf(content);
      if (!parsed) throw new Error('解析失败');
      if (activeRunIdRef.current !== runId) return;

      const blocks = parsed.tables?.block?.blocks || parsed.blocks || {};
      const layers = parsed.tables?.layer?.layers || {};
      const transformedEntities: FlatEntity[] = [];
      const orientationHints: FlatEntity[] = [];
      const textMarkers: TextMarker[] = [];
      const includeLayerKeywords = parseLayerKeywords(identRules.layerIncludeKeywords);
      const excludeLayerKeywords = parseLayerKeywords(identRules.layerExcludeKeywords);

      const transformPoint = (
        x: number,
        y: number,
        offset = { x: 0, y: 0 },
        scale = { x: 1, y: 1 },
        rotation = 0,
      ) => {
        const rotated = rotate(x * scale.x * scaleFactor, y * scale.y * scaleFactor, rotation);
        return { x: rotated.x + offset.x, y: rotated.y + offset.y };
      };

      const extract = (
        entities: any[],
        offset = { x: 0, y: 0 },
        scale = { x: 1, y: 1 },
        rotation = 0,
        depth = 0,
      ) => {
        if (!entities || depth > 12) return;

        entities.forEach((entity) => {
          const entityLayer = String(entity.layer || '0');
          const layerKey = entityLayer.toUpperCase();
          const layer = layers[layerKey] || layers[entity.layer] || {};
          const colorIdx = entity.colorIndex ?? layer.colorIndex ?? 7;
          const lineType = String(entity.lineType || entity.lineTypeName || layer.lineTypeName || layer.lineType || '').toUpperCase();

          if (entity.type === 'INSERT' && blocks[entity.name]) {
            const insertPosition = entity.position || { x: 0, y: 0 };
            const scaledInsert = transformPoint(insertPosition.x, insertPosition.y, offset, scale, rotation);
            extract(
              blocks[entity.name].entities,
              scaledInsert,
              {
                x: scale.x * (entity.xScale || 1),
                y: scale.y * (entity.yScale || 1),
              },
              rotation + (entity.rotation || 0),
              depth + 1,
            );
            return;
          }

          const pts: Point[] = [];

          if (entity.vertices?.length) {
            entity.vertices.forEach((vertex: any) => {
              pts.push(transformPoint(vertex.x, vertex.y, offset, scale, rotation));
            });
          } else if ((entity.type === 'TEXT' || entity.type === 'MTEXT' || entity.type === 'ATTRIB' || entity.type === 'ATTDEF') && (entity.position || entity.startPoint)) {
            const position = entity.position || entity.startPoint;
            const transformed = transformPoint(position.x, position.y, offset, scale, rotation);
            const text = extractEntityText(entity);
            if (text) {
              textMarkers.push({ text, x: transformed.x, y: transformed.y, layer: entityLayer });
            }
          } else if (entity.type === 'CIRCLE' && entity.center) {
            const steps = 48;
            for (let i = 0; i <= steps; i += 1) {
              const angle = (i / steps) * Math.PI * 2;
              const px = entity.center.x + Math.cos(angle) * entity.radius;
              const py = entity.center.y + Math.sin(angle) * entity.radius;
              pts.push(transformPoint(px, py, offset, scale, rotation));
            }
          } else if (entity.type === 'ARC' && entity.center) {
            const steps = 24;
            const startAngle = entity.startAngle || 0;
            const endAngle = entity.endAngle < entity.startAngle ? entity.endAngle + Math.PI * 2 : entity.endAngle;
            for (let i = 0; i <= steps; i += 1) {
              const angle = startAngle + ((endAngle - startAngle) * i) / steps;
              const px = entity.center.x + Math.cos(angle) * entity.radius;
              const py = entity.center.y + Math.sin(angle) * entity.radius;
              pts.push(transformPoint(px, py, offset, scale, rotation));
            }
          } else if (entity.type === 'ELLIPSE' && entity.center && entity.majorAxisEndPoint) {
            const steps = 48;
            const rx = Math.hypot(entity.majorAxisEndPoint.x, entity.majorAxisEndPoint.y);
            const ry = rx * (entity.axisRatio || 1);
            const startAngle = entity.startAngle || 0;
            const endAngle = entity.endAngle || Math.PI * 2;
            for (let i = 0; i <= steps; i += 1) {
              const angle = startAngle + ((endAngle - startAngle) * i) / steps;
              const px = entity.center.x + Math.cos(angle) * rx;
              const py = entity.center.y + Math.sin(angle) * ry;
              pts.push(transformPoint(px, py, offset, scale, rotation));
            }
          }

          if (pts.length < 2) return;

          const dist = Math.hypot(pts[0].x - pts[pts.length - 1].x, pts[0].y - pts[pts.length - 1].y);
          const isClosed = Boolean(entity.closed || entity.shape || entity.type === 'CIRCLE' || dist <= SNAP_PRECISION * 1.5);
          const flatEntity: FlatEntity = {
            type: entity.type,
            pts,
            colorIdx,
            linetype: lineType,
            layer: entityLayer,
            raw: entity,
            isClosed,
          };

          transformedEntities.push(flatEntity);
          if (isDashedLine(lineType, colorIdx)) {
            orientationHints.push(flatEntity);
          }
        });
      };

      extract(parsed.entities || []);
      setAnalysisProgress(20);

      if (transformedEntities.length === 0) {
        throw new Error('图纸中没有可识别的几何对象');
      }

      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;

      transformedEntities.forEach((entity) => {
        entity.pts.forEach((point) => {
          minX = Math.min(minX, point.x);
          maxX = Math.max(maxX, point.x);
          minY = Math.min(minY, point.y);
          maxY = Math.max(maxY, point.y);
        });
      });

      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;
      const chunkMap = new Map<string, Path2D[]>();

      for (let i = 0; i < transformedEntities.length; i += 1) {
        const entity = transformedEntities[i];
        const color = ACI_COLORS[entity.colorIdx] || '#000000';
        if (!chunkMap.has(color)) chunkMap.set(color, []);

        const paths = chunkMap.get(color)!;
        if (paths.length === 0 || i % ENTITIES_PER_PATH === 0) paths.push(new Path2D());
        const path = paths[paths.length - 1];

        path.moveTo(entity.pts[0].x - centerX, -(entity.pts[0].y - centerY));
        for (let j = 1; j < entity.pts.length; j += 1) {
          path.lineTo(entity.pts[j].x - centerX, -(entity.pts[j].y - centerY));
        }
        if (entity.isClosed) path.closePath();

        if (i % BATCH_SIZE === 0) {
          setAnalysisProgress(20 + Math.floor((i / transformedEntities.length) * 30));
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }

      const wallAreaThreshold = identRules.wallAreaThreshold * 1_000_000;
      const minWindowArea = identRules.minWindowArea * 1_000_000;
      const minSideLength = identRules.minSideLength;
      const labelMaxDistance = identRules.labelMaxDistance;
      const orientationHintBoxes: OrientationHintBox[] = orientationHints.map((hint) => ({
        box: calculateBoundingBox(hint.pts),
      }));
      const recognitionEntities = transformedEntities.filter((entity) => !shouldExcludeLayer(entity.layer, excludeLayerKeywords));
      const preferredRecognitionEntities = includeLayerKeywords.length > 0
        ? recognitionEntities.filter((entity) => matchesLayerKeyword(entity.layer, includeLayerKeywords))
        : recognitionEntities;

      let effectiveEntities = preferredRecognitionEntities.length > 0 ? preferredRecognitionEntities : recognitionEntities;
      let { walls, loops } = buildLoopCandidates(
        effectiveEntities,
        wallAreaThreshold,
        minWindowArea,
        minSideLength,
      );

      const fellBackToAllGeometry = (
        preferredRecognitionEntities.length > 0
        && preferredRecognitionEntities.length < recognitionEntities.length
        && loops.length === 0
      );

      if (fellBackToAllGeometry) {
        effectiveEntities = recognitionEntities;
        ({ walls, loops } = buildLoopCandidates(
          effectiveEntities,
          wallAreaThreshold,
          minWindowArea,
          minSideLength,
        ));
      }
      const labelPrefixes = expandPrefixes(parsePrefixes(identRules.windowPrefix || 'C'));
      // 编号文字通常就在 text/dim/标注 图层里，不能跟几何一起按排除图层直接过滤掉。
      const filteredLabels = textMarkers;
      const preferredLabels = filteredLabels;
      const effectiveLabels = preferredLabels;
      const matchedLabels = effectiveLabels
        .map((marker) => ({
          marker,
          code: findLabelCode(marker.text, identRules.windowPattern || 'C\\d{4}', labelPrefixes),
        }))
        .filter((item) => item.code);
      const rawLabelSamples = uniqueSorted(
        effectiveLabels
          .map((marker) => compactLabelText(marker.text))
          .filter((text) => labelPrefixes.some((prefix) => text.includes(prefix)))
      ).slice(0, 200);
      const windowsToCreate: WindowItem[] = [];
      const rawCountMap = new Map<string, number>();
      matchedLabels.forEach(({ code }) => {
        if (!code) return;
        rawCountMap.set(code, (rawCountMap.get(code) || 0) + 1);
      });

      const primaryMatching = matchLabelsToLoops(
        matchedLabels as MatchedLabel[],
        loops,
        labelMaxDistance,
        { preferStrongLoops: true },
      );
      const relaxedMatching = matchLabelsToLoops(
        primaryMatching.unmatchedLabels,
        primaryMatching.remainingLoops,
        labelMaxDistance,
        { relaxDistance: true, preferStrongLoops: true },
      );
      const finalMatches = [...primaryMatching.matches, ...relaxedMatching.matches];
      let unmatchedLabelItems = relaxedMatching.unmatchedLabels;
      let remainingLoops = relaxedMatching.remainingLoops;

      const hasWalls = walls.length > 0;
      finalMatches.forEach(({ label, loop: matchedLoop }) => {
        const box = matchedLoop.box;
        const isInWall = !hasWalls
          || walls.some((wall) => isPointInPolygon({ x: box.centerX, y: box.centerY }, wall.pts));
        const perimeter = calculatePerimeter(matchedLoop.pts);
        const { arcRatio } = analyzePathFeatures(matchedLoop.pts);
        const symmetryRate = calculateSymmetryRate(matchedLoop.pts);
        const edgeCount = matchedLoop.pts.length;

        let baseType = '矩形';
        if (arcRatio > 10 && symmetryRate < 70) baseType = '弧形';
        else if (arcRatio > 30 && symmetryRate >= 80) baseType = '拱形';
        else if (arcRatio < 5 && edgeCount >= 5) baseType = '多边形';

        const openingType = resolveOpeningType(box, matchedLoop.area, orientationHintBoxes);

        windowsToCreate.push({
          id: crypto.randomUUID(),
          name: label.code || compactLabelText(label.marker.text) || label.marker.text,
          category: isInWall ? '真窗' : '参考大样',
          shapeType: `${baseType}${openingType}${isInWall ? '' : ' (大样)'}`,
          width: box.width,
          height: box.height,
          area: matchedLoop.area,
          perimeter,
          glassArea: Math.max(0, matchedLoop.area - perimeter * profileWidth),
          frameWeight: (perimeter / 1000) * unitWeight,
          points: matchedLoop.pts.map((point) => ({ x: point.x - centerX, y: point.y - centerY })),
          handle: matchedLoop.raw?.handle,
          arcRatio: Math.round(arcRatio),
          symmetryRate: Math.round(symmetryRate),
        });
      });

      if (unmatchedLabelItems.length > 0 && remainingLoops.length > 0 && unmatchedLabelItems.length === remainingLoops.length) {
          const orderedLabels = [...unmatchedLabelItems].sort((a, b) => {
            if (Math.abs(a.marker.y - b.marker.y) > labelMaxDistance) return b.marker.y - a.marker.y;
            return a.marker.x - b.marker.x;
          });
          const orderedLoops = [...remainingLoops].sort((a, b) => {
            if (Math.abs(a.box.centerY - b.box.centerY) > labelMaxDistance) return b.box.centerY - a.box.centerY;
            return a.box.centerX - b.box.centerX;
          });

          orderedLabels.forEach((label, index) => {
            const matchedLoop = orderedLoops[index];
            if (!matchedLoop) return;

            const box = matchedLoop.box;
            const isInWall = !hasWalls
              || walls.some((wall) => isPointInPolygon({ x: box.centerX, y: box.centerY }, wall.pts));
            const perimeter = calculatePerimeter(matchedLoop.pts);
            const { arcRatio } = analyzePathFeatures(matchedLoop.pts);
            const symmetryRate = calculateSymmetryRate(matchedLoop.pts);
            const edgeCount = matchedLoop.pts.length;

            let baseType = '矩形';
            if (arcRatio > 10 && symmetryRate < 70) baseType = '弧形';
            else if (arcRatio > 30 && symmetryRate >= 80) baseType = '拱形';
            else if (arcRatio < 5 && edgeCount >= 5) baseType = '多边形';

            const openingType = resolveOpeningType(box, matchedLoop.area, orientationHintBoxes);

            windowsToCreate.push({
              id: crypto.randomUUID(),
              name: label.code || compactLabelText(label.marker.text) || label.marker.text,
              category: isInWall ? '真窗' : '参考大样',
              shapeType: `${baseType}${openingType}${isInWall ? '' : ' (大样)'}`,
              width: box.width,
              height: box.height,
              area: matchedLoop.area,
              perimeter,
              glassArea: Math.max(0, matchedLoop.area - perimeter * profileWidth),
              frameWeight: (perimeter / 1000) * unitWeight,
              points: matchedLoop.pts.map((point) => ({ x: point.x - centerX, y: point.y - centerY })),
              handle: matchedLoop.raw?.handle,
              arcRatio: Math.round(arcRatio),
              symmetryRate: Math.round(symmetryRate),
            });
          });
      }
      const matchedWindowNames = new Set(windowsToCreate.map((item) => item.name).filter(Boolean));
      const unmatchedLabelItemsForReport = matchedLabels.filter((item) => !item.code || !matchedWindowNames.has(item.code));
      const unmatchedLabels = uniqueSorted(unmatchedLabelItemsForReport.map((item) => item.code || compactLabelText(item.marker.text) || item.marker.text));
      const unmatchedLabelMarkers: RecognitionMarker[] = unmatchedLabelItemsForReport.map((item) => ({
        ...item.marker,
        text: item.code || item.marker.text,
        x: item.marker.x - centerX,
        y: item.marker.y - centerY,
      }));
      const matchedCountMap = new Map<string, number>();
      windowsToCreate.forEach((item) => {
        if (!item.name) return;
        matchedCountMap.set(item.name, (matchedCountMap.get(item.name) || 0) + 1);
      });
      const labelCodeStats = [...rawCountMap.entries()]
        .map(([code, rawCount]) => ({
          code,
          rawCount,
          matchedCount: matchedCountMap.get(code) || 0,
        }))
        .sort((a, b) => {
          const gapDiff = (b.rawCount - b.matchedCount) - (a.rawCount - a.matchedCount);
          if (gapDiff !== 0) return gapDiff;
          return a.code.localeCompare(b.code, 'zh-CN');
        });

      const excludedLayerMap = new Map<string, ExcludedLayerDetail>();
      transformedEntities.forEach((entity) => {
        if (!shouldExcludeLayer(entity.layer, excludeLayerKeywords)) return;
        const current = excludedLayerMap.get(entity.layer) || { layer: entity.layer, entityCount: 0, labelCount: 0 };
        current.entityCount += 1;
        excludedLayerMap.set(entity.layer, current);
      });
      textMarkers.forEach((marker) => {
        if (!shouldExcludeLayer(marker.layer, excludeLayerKeywords)) return;
        const current = excludedLayerMap.get(marker.layer) || { layer: marker.layer, entityCount: 0, labelCount: 0 };
        current.labelCount += 1;
        excludedLayerMap.set(marker.layer, current);
      });

      let diagnosticReason = '已识别到可匹配对象。';
      if (matchedLabels.length === 0) {
        diagnosticReason = effectiveLabels.length === 0
          ? '图纸里没有可识别文字，优先检查文本是否被正确解析。'
          : '当前识别规则没有命中任何编号文字，优先检查编号格式和规则。';
      } else if (loops.length === 0) {
        diagnosticReason = effectiveEntities.length === 0
          ? '图层筛选后可用几何为 0，优先检查图层过滤。'
          : (fellBackToAllGeometry
            ? '优先图层里没拼出窗框，已自动回退到全部几何层；仍无候选，优先检查最小边长、最小窗面积和图层。'
            : '编号命中了，但没有可用窗框候选，优先检查最小边长、最小窗面积和图层。');
      } else if (windowsToCreate.length === 0) {
        diagnosticReason = '编号和窗框都存在，但没有成功匹配，优先检查最大匹配距离。';
      } else if (unmatchedLabelMarkers.length > 0) {
        diagnosticReason = '部分编号未匹配到窗框，可点击未匹配编号直接定位检查。';
      }

      const finalChunks = [...chunkMap.entries()].map(([color, paths]) => ({ color, paths }));
      setProcessedResult({
        pathChunks: finalChunks,
        textMarkers: textMarkers.map((marker) => ({ ...marker, x: marker.x - centerX, y: marker.y - centerY })),
        bounds: {
          minX,
          maxX,
          minY,
          maxY,
          width: maxX - minX,
          height: maxY - minY,
          centerX,
          centerY,
        },
        totalEntities: transformedEntities.length,
        recognitionSummary: {
          totalLabels: matchedLabels.length,
          matchedLabels: windowsToCreate.length,
          candidateLabelCodes: uniqueSorted(matchedLabels.map((item) => item.code || '').filter(Boolean)),
          matchedLabelCodes: uniqueSorted(windowsToCreate.map((item) => item.name).filter(Boolean)),
          rawLabelSamples,
          labelCodeStats,
          unmatchedLabels: uniqueSorted(unmatchedLabels),
          unmatchedLabelMarkers,
          diagnostic: {
            rawTextCount: textMarkers.length,
            regexMatchedTextCount: matchedLabels.length,
            filteredLabelCount: effectiveLabels.length,
            filteredEntityCount: effectiveEntities.length,
            loopCandidateCount: loops.length,
            reason: diagnosticReason,
          },
          includedLayers: uniqueSorted(preferredRecognitionEntities.map((entity) => entity.layer)),
          excludedLayers: [...excludedLayerMap.keys()].sort((a, b) => a.localeCompare(b)),
          excludedLayerDetails: [...excludedLayerMap.values()].sort((a, b) => a.layer.localeCompare(b.layer)),
          activeEntityLayers: uniqueSorted(effectiveEntities.map((entity) => entity.layer)),
          activeLabelLayers: uniqueSorted(effectiveLabels.map((label) => label.layer)),
        },
      });
      setPendingWindows(windowsToCreate);
      setAnalysisProgress(100);
      lastCompletedRecognitionKeyRef.current = recognitionKey;

      if (windowsToCreate.length === 0) {
        notifications.show({
          title: '识别完成',
          message: '图纸已解析，但未匹配到有效窗编号或窗框，请检查识别标准。',
          color: 'yellow',
        });
      }
    } catch (error) {
      if (activeRunIdRef.current !== runId) return;
      console.error(error);
      notifications.show({
        title: '解析异常',
        message: error instanceof Error ? error.message : '请检查图纸',
        color: 'red',
      });
    } finally {
      if (activeRunIdRef.current === runId) {
        activeRecognitionKeyRef.current = null;
        setAnalysisProcessing(false);
        setTimeout(() => {
          if (activeRunIdRef.current === runId) {
            setAnalysisProgress(0);
          }
        }, 1000);
      }
    }
  }, [
    identRules,
    profileWidth,
    scaleFactor,
    setAnalysisProcessing,
    setAnalysisProgress,
    setPendingWindows,
    setProcessedResult,
    unitWeight,
  ]);

  const processDxf = async (file: File) => {
    const fileSignature = `${file.name}:${file.size}:${file.lastModified}`;
    if (isProcessing && lastImportedSignatureRef.current === fileSignature) return;
    lastImportedSignatureRef.current = fileSignature;
    setAnalysisFileName(file.name);
    const reader = new FileReader();

    reader.onload = async (event) => {
      const content = event.target?.result as string;
      setSourceContent(content);
      lastCompletedRecognitionKeyRef.current = null;
      await runRecognition(content);
    };

    reader.readAsText(file);
  };

  return {
    processedResult,
    pendingWindows,
    fileName,
    processDxf,
    rerunRecognition: async (enabledExcludedLayers: string[]) => {
      if (!sourceContent) return;
      await runRecognition(sourceContent, { enabledExcludedLayers });
    },
    isProcessing,
    progress,
    saveToDb: async (title: string) => {
      await createDrawingMutation.mutateAsync({ title, fileName, windows: pendingWindows });
      clear();
    },
    clear,
  };
};
