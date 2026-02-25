import { useState } from 'react';
import { notifications } from '@mantine/notifications';
import { calculateArea, calculatePerimeter, calculateBoundingBox } from '../../shared/utils';
import { useBatchCreateWindows } from './useWindowApi';
import { WindowItem } from '../../shared/schemas';
import { useWindowStore } from '../stores/windowStore';

export const useDxfProcessor = () => {
  const [dxfData, setDxfData] = useState<{ entities: any[], layers: any } | null>(null);
  const [progress, setProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const batchCreateWinMutation = useBatchCreateWindows();
  const { scaleFactor, profileWidth, unitWeight } = useWindowStore();

  const processDxf = async (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const content = e.target?.result as string;
      
      const windowsToCreate: Omit<WindowItem, 'id' | 'createdAt'>[] = [];
      const foundShapes = new Set<string>();

      // 定义处理顶点的内部函数，确保闭包正确访问局部变量
      const processVertices = (vertices: any[]) => {
        if (vertices.length < 3) return;
        const area = calculateArea(vertices);
        if (area > 5000) {
          const cx = vertices.reduce((a: any, b: any) => a + b.x, 0) / vertices.length;
          const cy = vertices.reduce((a: any, b: any) => a + b.y, 0) / vertices.length;
          const fingerPrint = `${Math.round(area/50)}-${Math.round(cx/10)}-${Math.round(cy/10)}`;
          
          if (!foundShapes.has(fingerPrint)) {
            foundShapes.add(fingerPrint);
            const { width, height } = calculateBoundingBox(vertices);
            const p = calculatePerimeter(vertices);
            windowsToCreate.push({
              name: `识别窗户 #${windowsToCreate.length + 1}`,
              category: '自动识别',
              shapeType: vertices.length === 4 ? '矩形窗' : '异形窗',
              width, height, area,
              perimeter: p,
              glassArea: Math.max(0, area - (p * profileWidth)),
              frameWeight: (p / 1000) * unitWeight,
              points: vertices,
            });
          }
        }
      };

      try {
        setIsProcessing(true);
        setProgress(10);

        const parsed = await (window as any).electronAPI.parseDxf(content);
        if (!parsed) throw new Error('解析失败');
        
        const layers = parsed.tables?.layer?.layers || {};
        const entities = parsed.entities || [];
        setDxfData({ entities, layers });
        setProgress(30);

        // 1. 提取所有线段用于未来扩展拓扑识别
        const segments: { p1: any, p2: any }[] = [];
        entities.forEach((entity: any) => {
          if (entity.type === 'LINE') {
            segments.push({ p1: entity.vertices[0], p2: entity.vertices[1] });
          } else if (entity.type === 'LWPOLYLINE' || entity.type === 'POLYLINE') {
            for (let i = 0; i < entity.vertices.length - 1; i++) {
              segments.push({ p1: entity.vertices[i], p2: entity.vertices[i+1] });
            }
            if (entity.shape) {
              segments.push({ p1: entity.vertices[entity.vertices.length - 1], p2: entity.vertices[0] });
            }
          }
        });

        // 2. 核心识别：处理闭合多段线
        const chunkSize = 200;
        for (let i = 0; i < entities.length; i += chunkSize) {
          const chunk = entities.slice(i, i + chunkSize);
          for (const entity of chunk) {
            if ((entity.type === 'LWPOLYLINE' || entity.type === 'POLYLINE') && entity.shape) {
              const vertices = entity.vertices.map((v: any) => ({ x: v.x * scaleFactor, y: v.y * scaleFactor }));
              processVertices(vertices);
            }
          }
          const currentProgress = 30 + Math.floor((i / entities.length) * 50);
          setProgress(currentProgress);
          await new Promise(resolve => setTimeout(resolve, 0));
        }

        setProgress(90);
        if (windowsToCreate.length > 0) {
          await batchCreateWinMutation.mutateAsync(windowsToCreate);
        }
        
        setProgress(100);
        notifications.show({ title: '解析完成', message: `识别了 ${windowsToCreate.length} 樘窗户。`, color: 'green' });
      } catch (err) {
        console.error('DXF Processor Error:', err);
        notifications.show({ title: '错误', message: '处理图纸时发生异常。', color: 'red' });
      } finally {
        setIsProcessing(false);
        setTimeout(() => setProgress(0), 1000);
      }
    };

    reader.readAsText(file);
  };

  return { dxfData, processDxf, isProcessing, progress };
};
