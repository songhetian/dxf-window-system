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
};
type ExcludedLayerDetail = {
  layer: string;
  entityCount: number;
  labelCount: number;
};
type RecognitionSummary = {
  totalLabels: number;
  matchedLabels: number;
  unmatchedLabels: string[];
  unmatchedLabelMarkers: RecognitionMarker[];
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

const pointToBoxDistance = (point: Point, box: LoopCandidate['box']) => {
  const dx = Math.max(Math.abs(point.x - box.centerX) - box.width / 2, 0);
  const dy = Math.max(Math.abs(point.y - box.centerY) - box.height / 2, 0);
  return Math.hypot(dx, dy);
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

const buildLoopCandidates = (
  entities: FlatEntity[],
  wallAreaThreshold: number,
  minWindowArea: number,
  minSideLength: number,
) => {
  const loopMap = new Map<string, LoopCandidate>();
  const walls: LoopCandidate[] = [];

  const pushLoop = (points: Point[], raw: any) => {
    if (points.length < 3) return;
    const area = calculateArea(points);
    if (area < MIN_LOOP_AREA) return;

    const box = calculateBoundingBox(points);
    const fingerprint = makeLoopFingerprint(points, area);
    const target = area >= wallAreaThreshold ? walls : null;

    if (target) {
      if (!walls.some((item) => item.fingerprint === fingerprint)) {
        walls.push({ pts: points, area, box, raw, fingerprint });
      }
      return;
    }

    if (area < minWindowArea) return;
    if (box.width < minSideLength || box.height < minSideLength) return;

    if (!loopMap.has(fingerprint)) {
      loopMap.set(fingerprint, { pts: points, area, box, raw, fingerprint });
    }
  };

  entities.forEach((entity) => {
    if (entity.isClosed && entity.pts.length >= 3) {
      pushLoop(entity.pts, entity.raw);
    }
  });

  collectLoopsFromSegments(entities).forEach((points) => {
    pushLoop(points, { type: 'SEGMENT_LOOP' });
  });

  return {
    walls,
    loops: [...loopMap.values()],
  };
};

const findBestLoopForLabel = (
  label: TextMarker,
  loops: LoopCandidate[],
  usedFingerprints: Set<string>,
  labelMaxDistance: number,
) => {
  const candidates = loops
    .filter((loop) => !usedFingerprints.has(loop.fingerprint))
    .map((loop) => {
      const contains = isPointInPolygon(label, loop.pts);
      const boxDistance = pointToBoxDistance(label, loop.box);
      const centerDistance = Math.hypot(label.x - loop.box.centerX, label.y - loop.box.centerY);
      const distanceLimit = Math.max(labelMaxDistance, Math.max(loop.box.width, loop.box.height) * 0.35);

      if (!contains && boxDistance > distanceLimit) return null;

      return {
        loop,
        score: (contains ? 0 : 100_000) + boxDistance * 10 + centerDistance + loop.area * 0.0001,
      };
    })
    .filter(Boolean) as Array<{ loop: LoopCandidate; score: number }>;

  candidates.sort((a, b) => a.score - b.score);
  return candidates[0]?.loop || null;
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
          } else if ((entity.type === 'TEXT' || entity.type === 'MTEXT') && (entity.position || entity.startPoint)) {
            const position = entity.position || entity.startPoint;
            const transformed = transformPoint(position.x, position.y, offset, scale, rotation);
            const text = normalizeText(entity.text || '');
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
      const recognitionEntities = transformedEntities.filter((entity) => !shouldExcludeLayer(entity.layer, excludeLayerKeywords));
      const preferredRecognitionEntities = includeLayerKeywords.length > 0
        ? recognitionEntities.filter((entity) => matchesLayerKeyword(entity.layer, includeLayerKeywords))
        : recognitionEntities;
      const effectiveEntities = preferredRecognitionEntities.length > 0 ? preferredRecognitionEntities : recognitionEntities;
      const { walls, loops } = buildLoopCandidates(
        effectiveEntities,
        wallAreaThreshold,
        minWindowArea,
        minSideLength,
      );
      const regex = new RegExp(identRules.windowPattern || 'C\\d{4}', 'i');
      const filteredLabels = textMarkers.filter((marker) => !shouldExcludeLayer(marker.layer, excludeLayerKeywords));
      const preferredLabels = includeLayerKeywords.length > 0
        ? filteredLabels.filter((marker) => matchesLayerKeyword(marker.layer, includeLayerKeywords))
        : filteredLabels;
      const effectiveLabels = preferredLabels.length > 0 ? preferredLabels : filteredLabels;
      const targetLabels = effectiveLabels.filter((marker) => regex.test(marker.text));
      const usedFingerprints = new Set<string>();
      const windowsToCreate: WindowItem[] = [];
      const unmatchedLabels: string[] = [];
      const unmatchedLabelMarkers: RecognitionMarker[] = [];

      targetLabels.forEach((label) => {
        const matchedLoop = findBestLoopForLabel(label, loops, usedFingerprints, labelMaxDistance);
        if (!matchedLoop) {
          unmatchedLabels.push(label.text);
          unmatchedLabelMarkers.push({
            ...label,
            x: label.x - centerX,
            y: label.y - centerY,
          });
          return;
        }

        usedFingerprints.add(matchedLoop.fingerprint);

        const box = matchedLoop.box;
        const isInWall = walls.some((wall) => isPointInPolygon({ x: box.centerX, y: box.centerY }, wall.pts));
        const perimeter = calculatePerimeter(matchedLoop.pts);
        const { arcRatio } = analyzePathFeatures(matchedLoop.pts);
        const symmetryRate = calculateSymmetryRate(matchedLoop.pts);
        const edgeCount = matchedLoop.pts.length;

        let baseType = '矩形';
        if (arcRatio > 10 && symmetryRate < 70) baseType = '弧形';
        else if (arcRatio > 30 && symmetryRate >= 80) baseType = '拱形';
        else if (arcRatio < 5 && edgeCount >= 5) baseType = '多边形';

        const hasOpening = orientationHints.some((hint) => {
          const hintBox = calculateBoundingBox(hint.pts);
          return (
            hintBox.centerX > box.centerX - box.width / 2 &&
            hintBox.centerX < box.centerX + box.width / 2 &&
            hintBox.centerY > box.centerY - box.height / 2 &&
            hintBox.centerY < box.centerY + box.height / 2
          );
        });

        let openingType = hasOpening ? '平开窗' : '推拉窗';
        if (!hasOpening && matchedLoop.area < 1_000_000) openingType = '固定窗';

        windowsToCreate.push({
          id: crypto.randomUUID(),
          name: label.text,
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
          totalLabels: targetLabels.length,
          matchedLabels: windowsToCreate.length,
          unmatchedLabels: uniqueSorted(unmatchedLabels),
          unmatchedLabelMarkers,
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
