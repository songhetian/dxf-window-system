import { useState, useCallback } from 'react';
import { notifications } from '@mantine/notifications';
import { calculateArea, calculatePerimeter, calculateBoundingBox, calculateSymmetryRate, analyzePathFeatures, isPointInPolygon } from '../../shared/utils';
import { useCreateDrawing } from './useWindowApi';
import { WindowItem } from '../../shared/schemas';
import { useWindowStore } from '../stores/windowStore';

const ACI_COLORS: Record<number, string> = {
  1: '#FF0000', 2: '#FFFF00', 3: '#00FF00', 4: '#00FFFF', 5: '#0000FF', 6: '#FF00FF', 
  7: '#1A1B1E', 8: '#808080', 9: '#C0C0C0', 256: '#1A1B1E', 0: '#1A1B1E'
};

const WINDOW_LAYERS = ["WINDOW", "窗户", "窗", "C-", "ARCH_WINDOW"];

export const useDxfProcessor = () => {
  const [processedResult, setProcessedResult] = useState<{
    pathChunks: { color: string; paths: Path2D[] }[];
    textMarkers?: { text: string; x: number; y: number }[];
    bounds: any;
    totalEntities: number;
  } | null>(null);
  
  const [fileName, setFileName] = useState('');
  const [pendingWindows, setPendingWindows] = useState<Omit<WindowItem, 'id' | 'drawingId' | 'createdAt'>[]>([]);
  const [progress, setProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const { scaleFactor, profileWidth, unitWeight, identRules } = useWindowStore();
  const createDrawingMutation = useCreateDrawing();

  const clear = useCallback(() => {
    setProcessedResult(null); setPendingWindows([]); setFileName(''); setProgress(0);
  }, []);

  const rotate = (x: number, y: number, angle: number) => {
    if (!angle) return { x, y };
    const r = (angle * Math.PI) / 180;
    return { x: x * Math.cos(r) - y * Math.sin(r), y: x * Math.sin(r) + y * Math.cos(r) };
  };

  const processDxf = async (file: File) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = async (e) => {
      const content = e.target?.result as string;
      setIsProcessing(true); setProgress(5);

      try {
        const parsed = await (window as any).electronAPI.parseDxf(content);
        if (!parsed) throw new Error('解析失败');
        
        const blocks = parsed.tables?.block?.blocks || parsed.blocks || {};
        const layers = parsed.tables?.layer?.layers || {};
        const allFlatEnts: any[] = [];
        const linesForOrientation: any[] = [];
        const textMarkers: any[] = [];

        // 1. 递归提取所有实体并处理坐标变换
        const extract = (ents: any[], offset = {x:0, y:0}, scale = {x:1, y:1}, rot = 0, depth = 0) => {
          if (depth > 10 || !ents) return;
          ents.forEach(e => {
            const layerKey = (e.layer || "").toUpperCase();
            const colorIdx = e.colorIndex ?? layers[layerKey]?.colorIndex ?? 7;
            const linetype = (e.lineTypeName || layers[layerKey]?.lineTypeName || "").toUpperCase();

            if (e.type === 'INSERT' && blocks[e.name]) {
              const p = e.position || {x:0, y:0};
              const s = e.scale || {x:1, y:1};
              const rPos = rotate(p.x * scale.x, p.y * scale.y, rot);
              extract(blocks[e.name].entities, 
                { x: offset.x + rPos.x, y: offset.y + rPos.y },
                { x: scale.x * (s.x || 1), y: scale.y * (s.y || 1) },
                rot + (e.rotation || 0), depth + 1
              );
            } else {
              let pts: any[] = [];
              if (e.vertices) {
                pts = e.vertices.map((v:any) => {
                  const r = rotate(v.x * scale.x, v.y * scale.y, rot);
                  return { x: r.x + offset.x, y: r.y + offset.y };
                });
              } else if (e.start && e.end) {
                pts = [e.start, e.end].map((v:any) => {
                  const r = rotate(v.x * scale.x, v.y * scale.y, rot);
                  return { x: r.x + offset.x, y: r.y + offset.y };
                });
              } else if (e.type === 'CIRCLE') {
                const steps = 32;
                for (let i = 0; i <= steps; i++) {
                  const ang = (i / steps) * Math.PI * 2;
                  const px = e.center.x + Math.cos(ang) * e.radius;
                  const py = e.center.y + Math.sin(ang) * e.radius;
                  const r = rotate(px * scale.x, py * scale.y, rot);
                  pts.push({ x: r.x + offset.x, y: r.y + offset.y });
                }
              } else if (e.type === 'ARC') {
                const steps = 16;
                const start = e.startAngle;
                const end = e.endAngle < e.startAngle ? e.endAngle + Math.PI * 2 : e.endAngle;
                for (let i = 0; i <= steps; i++) {
                  const ang = start + (i / steps) * (end - start);
                  const px = e.center.x + Math.cos(ang) * e.radius;
                  const py = e.center.y + Math.sin(ang) * e.radius;
                  const r = rotate(px * scale.x, py * scale.y, rot);
                  pts.push({ x: r.x + offset.x, y: r.y + offset.y });
                }
              } else if ((e.type === 'TEXT' || e.type === 'MTEXT') && e.position) {
                const txt = (e.text || "").toUpperCase();
                const regex = new RegExp(identRules.windowPattern || 'C\\d{4}');
                const r = rotate(e.position.x * scale.x, e.position.y * scale.y, rot);
                const tm = { text: txt, x: r.x + offset.x, y: r.y + offset.y };
                textMarkers.push(tm);
              }

              if (pts.length > 0) {
                const entData = { ...e, pts, colorIdx, linetype };
                allFlatEnts.push(entData);
                const isDashed = linetype.includes('DASH') || linetype.includes('HIDDEN') || linetype.includes('DOT');
                const isGray = colorIdx === 8 || colorIdx === 9;
                if (isDashed || isGray) linesForOrientation.push(entData);
              }
            }
          });
        };

        extract(parsed.entities || []);
        setProgress(20);

        // 2. 计算边界与中心
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        allFlatEnts.forEach(e => e.pts.forEach((p:any) => {
          minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
          minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
        }));
        const centerX = (minX + maxX) / 2, centerY = (minY + maxY) / 2;

        // 3. 构建 Path2D 渲染分片
        const chunkMap = new Map<string, Path2D[]>();
        const walls: any[] = [];
        const closedLoops: any[] = [];
        const ENTITIES_PER_PATH = 5000, BATCH_SIZE = 1000;

        for (let i = 0; i < allFlatEnts.length; i++) {
          const e = allFlatEnts[i];
          const hex = ACI_COLORS[e.colorIdx] || '#000000';
          if (!chunkMap.has(hex)) chunkMap.set(hex, []);
          let currentPaths = chunkMap.get(hex)!;
          if (currentPaths.length === 0 || i % ENTITIES_PER_PATH === 0) currentPaths.push(new Path2D());
          const path = currentPaths[currentPaths.length - 1];

          const pts = e.pts;
          path.moveTo(pts[0].x - centerX, -(pts[0].y - centerY));
          for (let j = 1; j < pts.length; j++) path.lineTo(pts[j].x - centerX, -(pts[j].y - centerY));
          const dist = Math.hypot(pts[0].x - pts[pts.length-1].x, pts[0].y - pts[pts.length-1].y);
          const isClosed = e.closed || e.shape || dist < 1.0;
          if (isClosed) path.closePath();

          if ((e.type === 'LWPOLYLINE' || e.type === 'POLYLINE' || e.type === 'CIRCLE') && isClosed && pts.length >= 3) {
            const area = calculateArea(pts);
            if (area >= identRules.wallAreaThreshold * 1_000_000) {
              walls.push({ pts, area });
            } else if (area >= 100_000) {
              closedLoops.push({ e, pts, area });
            }
          }
          if (i % BATCH_SIZE === 0) {
             setProgress(20 + Math.floor((i / allFlatEnts.length) * 30));
             await new Promise(r => setTimeout(r, 0));
          }
        }

        // 4. 精准锚点识别逻辑 (Anchor Identification)
        const windowsToCreate: any[] = [];
        const foundFingerprints = new Set<string>();
        const regex = new RegExp(identRules.windowPattern || 'C\\d{4}');

        // 筛选出符合编号规则的文字标注
        const targetLabels = textMarkers.filter(m => regex.test(m.text));

        for (const label of targetLabels) {
          // 找到包含该文字且面积最小的闭合框 (防止误选中外围大框)
          const matchedLoop = closedLoops
            .filter(loop => isPointInPolygon(label, loop.pts))
            .sort((a, b) => a.area - b.area)[0];

          if (!matchedLoop) continue;

          const box = calculateBoundingBox(matchedLoop.pts);
          const fingerPrint = `${Math.round(box.centerX)}-${Math.round(box.centerY)}-${Math.round(matchedLoop.area/100)}`;
          if (foundFingerprints.has(fingerPrint)) continue;
          foundFingerprints.add(fingerPrint);

          const isInWall = walls.some(wall => isPointInPolygon({x: box.centerX, y: box.centerY}, wall.pts));
          const perimeter = calculatePerimeter(matchedLoop.pts);
          const { arcRatio } = analyzePathFeatures(matchedLoop.pts);
          const symmetryRate = calculateSymmetryRate(matchedLoop.pts);
          const edgeCount = (matchedLoop.e.vertices?.length || matchedLoop.pts.length);
          
          let baseType = "矩形";
          if (arcRatio > 10 && symmetryRate < 70) baseType = "弧形";
          else if (arcRatio > 30 && symmetryRate >= 80) baseType = "拱形";
          else if (arcRatio < 5 && edgeCount >= 5) baseType = "多边形";

          const hasOpening = linesForOrientation.some(l => {
            const lBox = calculateBoundingBox(l.pts);
            return lBox.centerX > box.centerX - box.width/2 && lBox.centerX < box.centerX + box.width/2 &&
                   lBox.centerY > box.centerY - box.height/2 && lBox.centerY < box.centerY + box.height/2;
          });

          let openingType = hasOpening ? "平开窗" : "推拉窗";
          // 如果编号是 C0707 且没虚线，通常是固定窗
          if (!hasOpening && matchedLoop.area < 1_000_000) openingType = "固定窗";

          windowsToCreate.push({
            name: label.text,
            category: isInWall ? "真窗" : "参考大样",
            shapeType: `${baseType}${openingType}${isInWall ? "" : " (大样)"}`,
            width: box.width, height: box.height, area: matchedLoop.area, perimeter,
            glassArea: Math.max(0, matchedLoop.area - (perimeter * profileWidth)),
            frameWeight: (perimeter / 1000) * unitWeight,
            points: matchedLoop.pts.map((p:any) => ({ x: p.x - centerX, y: p.y - centerY })),
            handle: matchedLoop.e.handle, arcRatio: Math.round(arcRatio), symmetryRate: Math.round(symmetryRate),
          });
        }

        const finalChunks = Array.from(chunkMap.entries()).map(([color, paths]) => ({ color, paths }));
        setProcessedResult({ 
          pathChunks: finalChunks, 
          textMarkers: textMarkers.map(tm => ({ ...tm, x: tm.x - centerX, y: tm.y - centerY })),
          bounds: { minX, maxX, minY, maxY, width: maxX-minX, height: maxY-minY, centerX, centerY }, 
          totalEntities: allFlatEnts.length 
        });
        setPendingWindows(windowsToCreate);
        setProgress(100);
      } catch (err) {
        console.error(err);
        notifications.show({ title: '解析异常', message: '请检查图纸', color: 'red' });
      } finally {
        setIsProcessing(false);
        setTimeout(() => setProgress(0), 1000);
      }
    };
    reader.readAsText(file);
  };

  return { processedResult, pendingWindows, fileName, processDxf, isProcessing, progress, saveToDb: async (title: string) => {
    await createDrawingMutation.mutateAsync({ title, fileName, windows: pendingWindows });
    clear();
  }, clear };
};
