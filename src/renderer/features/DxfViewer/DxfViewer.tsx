import { useRef, useEffect, useState, useCallback, useMemo, forwardRef, useImperativeHandle } from 'react';
import { Box, Text, Center, Stack, Badge, Loader } from '@mantine/core';
import { TransformWrapper, TransformComponent, ReactZoomPanPinchRef, useTransformEffect } from 'react-zoom-pan-pinch';
import { useWindowStore } from '../../stores/windowStore';
import { WindowItem } from '../../../shared/schemas';

interface DxfViewerProps {
  processedResult: {
    pathChunks: { color: string; paths: Path2D[] }[];
    bounds: any;
    totalEntities: number;
  } | null;
  windows: WindowItem[];
}

export interface DxfViewerRef {
  reset: () => void;
  zoomToWindow: (window: WindowItem) => void;
}

export const DxfViewer = forwardRef<DxfViewerRef, DxfViewerProps>(({ processedResult, windows }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const transformRef = useRef<ReactZoomPanPinchRef>(null);
  const lastStateRef = useRef<any>(null);
  const requestRef = useRef<number | undefined>(undefined);

  const { activeWindowId } = useWindowStore();

  const draw = useCallback((state: { scale: number; positionX: number; positionY: number }) => {
    const canvas = canvasRef.current;
    if (!canvas || !processedResult) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth * dpr; const h = canvas.clientHeight * dpr;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w; canvas.height = h;
    }

    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, w, h);
    const { scale, positionX: px, positionY: py } = state;

    ctx.save();
    ctx.translate(px * dpr + w/2, py * dpr + h/2);
    ctx.scale(scale * dpr, scale * dpr);

    // 1. 分片绘制底图
    ctx.lineWidth = 1.0 / scale; 
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';

    processedResult.pathChunks.forEach(chunk => {
      ctx.strokeStyle = chunk.color;
      chunk.paths.forEach(p => {
        ctx.stroke(p);
      });
    });

    // 2. 绘制窗户
    windows.forEach((win, idx) => {
      const isActive = win.id === activeWindowId;
      const pts = win.points;
      if (!pts || pts.length === 0) return;

      ctx.beginPath();
      ctx.moveTo(pts[0].x, -pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, -pts[i].y);
      ctx.closePath();

      ctx.fillStyle = isActive ? 'rgba(0, 122, 255, 0.5)' : 'rgba(255, 149, 0, 0.25)';
      ctx.fill();
      ctx.strokeStyle = isActive ? '#007AFF' : '#FF9500';
      ctx.lineWidth = (isActive ? 8 : 4) / scale;
      ctx.stroke();

      if (scale > 0.001) {
        const cx = pts.reduce((a, b) => a + b.x, 0) / pts.length;
        const cy = pts.reduce((a, b) => a + b.y, 0) / pts.length;
        ctx.save();
        ctx.translate(cx, -cy); ctx.scale(1/scale, 1/scale);
        ctx.fillStyle = isActive ? '#007AFF' : '#FF9500';
        ctx.beginPath(); ctx.arc(0, 0, 14 * dpr, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = `bold ${12 * dpr}px sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(`${idx + 1}`, 0, 0);
        ctx.restore();
      }
    });

    ctx.restore();
  }, [processedResult, windows, activeWindowId]);

  const zoomToFit = useCallback(() => {
    if (!processedResult?.bounds || !transformRef.current || !containerRef.current) return;
    const { bounds } = processedResult;
    const rect = containerRef.current.getBoundingClientRect();
    const scale = Math.min((rect.width - 100) / bounds.width, (rect.height - 100) / bounds.height) || 1;
    transformRef.current.setTransform(0, 0, scale, 0);
  }, [processedResult]);

  useImperativeHandle(ref, () => ({ 
    reset: zoomToFit, 
    zoomToWindow: (win: WindowItem) => {
      if (!transformRef.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pts = win.points;
      const cx = pts.reduce((a, b) => a + b.x, 0) / pts.length;
      const cy = pts.reduce((a, b) => a + b.y, 0) / pts.length;
      const targetScale = 0.05; 
      transformRef.current.setTransform(-cx * targetScale, cy * targetScale, targetScale, 500);
    }
  }));

  useEffect(() => { if (processedResult) setTimeout(zoomToFit, 100); }, [processedResult, zoomToFit]);

  const DrawingLayer = () => {
    useTransformEffect(({ state }) => {
      lastStateRef.current = state;
      if (requestRef.current === undefined) {
        requestRef.current = requestAnimationFrame(() => {
          if (lastStateRef.current) draw(lastStateRef.current);
          requestRef.current = undefined;
        });
      }
    });
    return <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block', cursor: 'crosshair' }} />;
  };

  if (!processedResult) return <Center h="100%"><Loader /></Center>;

  return (
    <Box ref={containerRef} style={{ width: '100%', height: '100%', overflow: 'hidden', background: '#fff', position: 'relative' }}>
      <TransformWrapper 
        ref={transformRef} 
        minScale={0.000000001} 
        maxScale={100} 
        centerOnInit={false}
        pinch={{ step: 25 }} wheel={{ step: 1.2 }} 
      >
        <TransformComponent wrapperStyle={{ width: '100%', height: '100%' }} contentStyle={{ width: '100%', height: '100%' }}>
           <DrawingLayer />
        </TransformComponent>
      </TransformWrapper>
      <Box style={{ position: 'absolute', bottom: 10, right: 10, zIndex: 10, pointerEvents: 'none' }}>
        <Badge color="blue" size="xs">Entities: {processedResult.totalEntities}</Badge>
      </Box>
    </Paper>
  );
});

import { Paper } from '@mantine/core';
