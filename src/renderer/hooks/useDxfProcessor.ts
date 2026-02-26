import { useState, useCallback } from 'react';
import { notifications } from '@mantine/notifications';
import { calculateArea, calculatePerimeter, calculateBoundingBox } from '../../shared/utils';
import { useCreateDrawing } from './useWindowApi';
import { WindowItem } from '../../shared/schemas';
import { useWindowStore } from '../stores/windowStore';

const ACI_COLORS: Record<number, string> = {
  1: '#FF0000', 2: '#FFFF00', 3: '#00FF00', 4: '#00FFFF', 5: '#0000FF', 6: '#FF00FF', 
  7: '#1A1B1E', 8: '#808080', 9: '#C0C0C0', 256: '#1A1B1E', 0: '#1A1B1E'
};

export const useDxfProcessor = () => {
  const [processedResult, setProcessedResult] = useState<{
    pathChunks: { color: string; paths: Path2D[] }[];
    bounds: any;
    totalEntities: number;
  } | null>(null);
  
  const [fileName, setFileName] = useState('');
  const [pendingWindows, setPendingWindows] = useState<Omit<WindowItem, 'id' | 'drawingId' | 'createdAt'>[]>([]);
  const [progress, setProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const { scaleFactor, profileWidth, unitWeight } = useWindowStore();
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

        const extract = (ents: any[], offset = {x:0, y:0}, scale = {x:1, y:1}, rot = 0, depth = 0) => {
          if (depth > 10 || !ents) return;
          ents.forEach(e => {
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
              if (e.vertices) pts = e.vertices.map((v:any) => {
                const r = rotate(v.x * scale.x, v.y * scale.y, rot);
                return { x: r.x + offset.x, y: r.y + offset.y };
              });
              else if (e.start && e.end) pts = [e.start, e.end].map((v:any) => {
                const r = rotate(v.x * scale.x, v.y * scale.y, rot);
                return { x: r.x + offset.x, y: r.y + offset.y };
              });

              if (pts.length > 0) {
                const entData = { ...e, pts };
                allFlatEnts.push(entData);
                if (e.type === 'LINE' || (e.type === 'LWPOLYLINE' && !e.closed)) linesForOrientation.push(entData);
              }
            }
          });
        };

        extract(parsed.entities || []);
        setProgress(20);

        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        allFlatEnts.forEach(e => e.pts.forEach((p:any) => {
          minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
          minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
        }));
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;

        // Path2D 分片存储，解决超大型图纸不渲染问题
        const chunkMap = new Map<string, Path2D[]>();
        const foundShapes = new Set<string>();
        const windowsToCreate: any[] = [];
        const ENTITIES_PER_PATH = 3000; 

        allFlatEnts.forEach((e, idx) => {
          const colorIdx = e.colorIndex ?? layers[e.layer.toUpperCase()]?.colorIndex ?? 7;
          const hex = ACI_COLORS[colorIdx] || '#000000';
          
          if (!chunkMap.has(hex)) chunkMap.set(hex, [new Path2D()]);
          let currentPaths = chunkMap.get(hex)!;
          if (idx % ENTITIES_PER_PATH === 0) currentPaths.push(new Path2D());
          const path = currentPaths[currentPaths.length - 1];

          const pts = e.pts;
          path.moveTo(pts[0].x - centerX, -(pts[0].y - centerY));
          for (let j = 1; j < pts.length; j++) path.lineTo(pts[j].x - centerX, -(pts[j].y - centerY));
          
          const dist = Math.hypot(pts[0].x - pts[pts.length-1].x, pts[0].y - pts[pts.length-1].y);
          if (e.closed || e.shape || dist < 10) path.closePath();

          // 构件识别
          if ((e.type === 'LWPOLYLINE' || e.type === 'POLYLINE') && (e.closed || e.shape || dist < 10) && pts.length >= 3) {
            const area = calculateArea(pts);
            if (area > 2000) { // 进一步降低门槛
              const { width, height, centerX: cx, centerY: cy } = calculateBoundingBox(pts);
              if (Math.max(width, height) / Math.min(width, height) > 40) return; 

              // 提高指纹唯一性，防止丢失
              const fingerPrint = `${Math.round(area/2)}-${Math.round(cx/1)}-${Math.round(cy/1)}`;
              if (!foundShapes.has(fingerPrint)) {
                foundShapes.add(fingerPrint);
                const p = calculatePerimeter(pts);
                
                let orientation = '固定';
                const hasLeft = linesForOrientation.some(l => l.pts[0].x > (cx-width/2) && l.pts[0].x < cx && l.pts[0].y > (cy-height/2) && l.pts[0].y < (cy+height/2));
                const hasRight = linesForOrientation.some(l => l.pts[0].x > cx && l.pts[0].x < (cx+width/2) && l.pts[0].y > (cy-height/2) && l.pts[0].y < (cy+height/2));
                if (hasLeft && !hasRight) orientation = '左开';
                else if (hasRight && !hasLeft) orientation = '右开';
                else if (hasLeft && hasRight) orientation = '对开';

                windowsToCreate.push({
                  name: `${orientation}窗 #${windowsToCreate.length + 1}`,
                  category: '智能检测',
                  shapeType: pts.length <= 5 ? '矩形' : '异形',
                  width, height, area, perimeter: p,
                  glassArea: Math.max(0, area - (p * profileWidth)),
                  frameWeight: (p / 1000) * unitWeight,
                  points: pts.map((p:any) => ({ x: p.x - centerX, y: p.y - centerY })),
                });
              }
            }
          }
          if (idx % 2000 === 0) setProgress(20 + Math.floor((idx / allFlatEnts.length) * 75));
        });

        const finalChunks = Array.from(chunkMap.entries()).map(([color, paths]) => ({ color, paths }));
        setProcessedResult({ 
          pathChunks: finalChunks, 
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
