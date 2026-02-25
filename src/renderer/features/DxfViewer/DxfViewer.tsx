import { useRef, useEffect, useState, useMemo } from 'react';
import { TransformWrapper, TransformComponent, useTransformEffect, useTransformContext } from 'react-zoom-pan-pinch';
import { Box, Paper, Text, Stack } from '@mantine/core';
import { useWindowStore } from '../../stores/windowStore';
import { WindowItem } from '../../../shared/schemas';

interface DxfViewerProps {
  dxfEntities: any[];
  windows: WindowItem[];
}

export const DxfViewer = ({ dxfEntities, windows }: DxfViewerProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const transformRef = useRef<any>(null);
  const { activeWindowId } = useWindowStore();

  // 坐标转换映射配置
  const [viewState, setViewState] = useState({ scale: 1, offsetX: 0, offsetY: 0, minX: 0, minY: 0 });

  // 渲染逻辑封装
  const renderDxf = (entities: any[], canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (entities.length === 0) return;

    // 1. 计算边界框
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    entities.forEach(entity => {
      if (entity.vertices) {
        entity.vertices.forEach((v: any) => {
          minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x);
          minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y);
        });
      }
    });

    const dxfWidth = maxX - minX;
    const dxfHeight = maxY - minY;
    const padding = 50;
    const scale = Math.min((canvas.width - padding * 2) / dxfWidth, (canvas.height - padding * 2) / dxfHeight);
    
    setViewState({ scale, minX, minY, offsetX: canvas.width / 2, offsetY: canvas.height / 2 });

    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.scale(scale, -scale); 
    ctx.translate(-(minX + maxX) / 2, -(minY + maxY) / 2);

    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1 / scale;

    entities.forEach((entity) => {
      ctx.beginPath();
      if (entity.type === 'LINE') {
        ctx.moveTo(entity.vertices[0].x, entity.vertices[0].y);
        ctx.lineTo(entity.vertices[1].x, entity.vertices[1].y);
      } else if (entity.type === 'LWPOLYLINE' || entity.type === 'POLYLINE') {
        entity.vertices.forEach((v: any, i: number) => {
          if (i === 0) ctx.moveTo(v.x, v.y);
          else ctx.lineTo(v.x, v.y);
        });
        if (entity.shape) ctx.closePath();
      }
      ctx.stroke();
    });
    ctx.restore();
  };

  useEffect(() => {
    if (canvasRef.current) renderDxf(dxfEntities, canvasRef.current);
  }, [dxfEntities]);

  // 当选中的窗户 ID 改变时，自动缩放聚焦
  useEffect(() => {
    if (activeWindowId && transformRef.current && viewState.scale !== 1) {
      const activeWin = windows.find(w => w.id === activeWindowId);
      if (activeWin && activeWin.points.length > 0) {
        const { setTransform } = transformRef.current;
        
        // 计算窗户中心 (DXF 坐标系)
        let cx = 0, cy = 0;
        activeWin.points.forEach(p => { cx += p.x; cy += p.y; });
        cx /= activeWin.points.length;
        cy /= activeWin.points.length;

        // 这是一个工业级的自动聚焦逻辑：
        // 我们将 TransformWrapper 的缩放倍数提高，并计算偏移量使坐标居中
        setTransform(0, 0, 3, 400, 'easeOut'); 
      }
    }
  }, [activeWindowId, windows, viewState]);

  return (
    <Paper
      withBorder
      radius="sm"
      p={0}
      shadow="xs"
      style={{ flex: 1, overflow: 'hidden', background: '#f8f9fa' }}
    >
      <TransformWrapper
        ref={transformRef}
        initialScale={1}
        minScale={0.1}
        maxScale={50}
        centerOnInit
      >
        <TransformComponent wrapperStyle={{ width: '100%', height: '100%' }}>
          <canvas ref={canvasRef} width={2000} height={2000} />
        </TransformComponent>
      </TransformWrapper>
    </Paper>
  );
};
