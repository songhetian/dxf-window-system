import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { Paper, Box } from '@mantine/core';
import { useWindowStore } from '../../stores/windowStore';
import { WindowItem } from '../../../shared/schemas';

const ACI_COLORS: Record<number, string> = {
  1: '#FF0000', 2: '#FFFF00', 3: '#00FF00', 4: '#00FFFF', 5: '#0000FF', 6: '#FF00FF', 
  7: '#1A1B1E', 8: '#808080', 9: '#C0C0C0', 256: '#1A1B1E', 0: '#1A1B1E'
};

interface DxfViewerProps {
  dxfData: { entities: any[], layers: any } | null;
  windows: WindowItem[];
}

export const DxfViewer = ({ dxfData, windows }: DxfViewerProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { activeWindowId } = useWindowStore();

  const [camera, setCamera] = useState({ x: 0, y: 0, zoom: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const [lastMouse, setLastMouse] = useState({ x: 0, y: 0 });

  // 1. 数据预处理
  const colorGroups = useMemo(() => {
    if (!dxfData) return null;
    const { entities, layers } = dxfData;
    const groups: Record<string, any[]> = {};

    entities.forEach(entity => {
      let colorIndex = entity.colorIndex;
      if (!colorIndex || colorIndex === 256) {
        const layer = layers[entity.layer];
        colorIndex = layer?.colorIndex || 7;
      }
      const hex = ACI_COLORS[colorIndex] || '#333333';
      if (!groups[hex]) groups[hex] = [];
      groups[hex].push(entity);
    });
    return groups;
  }, [dxfData]);

  // 2. 核心绘图
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || !colorGroups) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.scale(camera.zoom * dpr, -camera.zoom * dpr);
    ctx.translate(camera.x, camera.y);

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // 绘制底图
    Object.entries(colorGroups).forEach(([hex, entities]) => {
      ctx.beginPath();
      ctx.strokeStyle = hex;
      ctx.lineWidth = 1.0 / (camera.zoom * dpr);
      entities.forEach(e => {
        if (e.type === 'LINE') {
          ctx.moveTo(e.vertices[0].x, e.vertices[0].y);
          ctx.lineTo(e.vertices[1].x, e.vertices[1].y);
        } else if (e.type === 'LWPOLYLINE' || e.type === 'POLYLINE') {
          e.vertices.forEach((v: any, i: number) => {
            if (i === 0) ctx.moveTo(v.x, v.y); else ctx.lineTo(v.x, v.y);
          });
          if (e.shape) ctx.closePath();
        }
      });
      ctx.stroke();
    });

    // 绘制窗户
    windows.forEach(win => {
      const isActive = win.id === activeWindowId;
      ctx.beginPath();
      ctx.strokeStyle = isActive ? '#228BE6' : '#F76707'; // 橙色显示识别出的图形
      ctx.lineWidth = (isActive ? 5.0 : 2.5) / (camera.zoom * dpr);
      win.points.forEach((p, i) => {
        if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
      });
      ctx.closePath();
      ctx.stroke();
    });

    ctx.restore();
  }, [colorGroups, windows, activeWindowId, camera]);

  // 初始视野计算
  useEffect(() => {
    if (dxfData?.entities.length) {
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      dxfData.entities.forEach(e => {
        const pts = e.vertices || (e.center ? [{x: e.center.x - e.radius, y: e.center.y - e.radius}, {x: e.center.x + e.radius, y: e.center.y + e.radius}] : []);
        pts.forEach((v: any) => {
          minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x);
          minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y);
        });
      });
      if (minX !== Infinity) {
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) {
          const zoom = Math.min((rect.width - 100) / (maxX - minX), (rect.height - 100) / (maxY - minY));
          setCamera({ x: -(minX + maxX) / 2, y: -(minY + maxY) / 2, zoom: zoom || 1 });
        }
      }
    }
  }, [dxfData]);

  const handleWheel = (e: React.WheelEvent) => {
    const factor = -e.deltaY > 0 ? 1.15 : 0.85;
    setCamera(prev => ({ ...prev, zoom: Math.max(0.0001, Math.min(prev.zoom * factor, 5000)) }));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0 || e.button === 1) {
      setIsDragging(true);
      setLastMouse({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = (e.clientX - lastMouse.x) / camera.zoom;
    const dy = -(e.clientY - lastMouse.y) / camera.zoom;
    setCamera(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
    setLastMouse({ x: e.clientX, y: e.clientY });
  };

  useEffect(() => {
    const frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [draw]);

  return (
    <Paper ref={containerRef} withBorder style={{ width: '100%', height: '100%', overflow: 'hidden', cursor: isDragging ? 'grabbing' : 'crosshair' }}
      onWheel={handleWheel} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={() => setIsDragging(false)} onMouseLeave={() => setIsDragging(false)}>
      <canvas ref={canvasRef} style={{ display: 'block' }} />
    </Paper>
  );
};
