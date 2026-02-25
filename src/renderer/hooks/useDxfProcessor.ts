import { useState } from 'react';
import { notifications } from '@mantine/notifications';
import { calculateArea, calculatePerimeter, calculateBoundingBox } from '../../shared/utils';
import { useCreateWindow } from './useWindowApi';

export const useDxfProcessor = () => {
  const [entities, setEntities] = useState<any[]>([]);
  const createWinMutation = useCreateWindow();

  const processDxf = async (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const content = e.target?.result as string;
      
      try {
        // 调用 Electron 主进程解析 DXF (性能优化)
        const parsed = await (window as any).electronAPI.parseDxf(content);
        
        if (parsed && parsed.entities) {
          setEntities(parsed.entities);
          let count = 0;
          
          for (const entity of parsed.entities) {
            // 自动识别闭合多段线作为窗户
            if ((entity.type === 'LWPOLYLINE' || entity.type === 'POLYLINE') && entity.shape) {
              const vertices = entity.vertices.map((v: any) => ({ x: v.x, y: v.y }));
              const area = calculateArea(vertices);
              const perimeter = calculatePerimeter(vertices);
              const { width, height } = calculateBoundingBox(vertices);

              // 过滤逻辑：面积大于 1000mm² (即 10cm²) 的图形
              if (area > 1000) {
                await createWinMutation.mutateAsync({
                  name: `窗户 ${++count}`,
                  category: '自动识别',
                  shapeType: '异形窗',
                  width,
                  height,
                  area,
                  perimeter,
                  points: vertices,
                });
              }
            }
          }
          
          notifications.show({
            title: '解析成功',
            message: `成功从 DXF 中提取了 ${count} 个窗户图形。`,
            color: 'green',
          });
        }
      } catch (err) {
        notifications.show({
          title: '解析失败',
          message: 'DXF 文件格式有误或解析器出错。',
          color: 'red',
        });
      }
    };
    reader.readAsText(file);
  };

  return {
    entities,
    processDxf,
    isProcessing: createWinMutation.isPending,
  };
};
