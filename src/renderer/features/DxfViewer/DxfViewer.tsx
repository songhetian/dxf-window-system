import { useRef, useEffect, useState, useCallback, useMemo, forwardRef, useImperativeHandle, memo } from 'react';
import { Box, Text, Center, Stack, Badge, Loader, Paper } from '@mantine/core';
import { TransformWrapper, TransformComponent, ReactZoomPanPinchRef, useTransformEffect } from 'react-zoom-pan-pinch';
import { useWindowStore } from '../../stores/windowStore';
import { WindowItem } from '../../../shared/schemas';

interface DxfViewerProps {
  processedResult: {
    pathChunks: { color: string; paths: Path2D[] }[];
    textMarkers?: { text: string; x: number; y: number }[];
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

    // 清空背景
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, w, h);
    if (!processedResult.pathChunks || processedResult.pathChunks.length === 0) return;

    const { scale, positionX: px, positionY: py } = state;
    if (isNaN(scale) || isNaN(px) || isNaN(py)) return;

    ctx.save();
    // 核心修复：直接应用缩放库的偏移和比例
    // 此时 Canvas 的 (0,0) 就是图纸解析时的中心点 (centerX, centerY)
    ctx.translate(px * dpr, py * dpr); 
    ctx.scale(scale * dpr, scale * dpr);
    
    // 1. 绘制底图 (原样输出：包含所有线条、虚线等)
    ctx.lineWidth = 1.0 / scale; 
    ctx.lineCap = 'butt'; ctx.lineJoin = 'miter';

    processedResult.pathChunks.forEach(chunk => {
      ctx.strokeStyle = chunk.color;
      chunk.paths.forEach(p => ctx.stroke(p));
    });

    // 2. 绘制原图文字标注
    if (processedResult.textMarkers && scale > 0.002) {
      ctx.fillStyle = '#444444';
      ctx.font = `${11 / scale}px sans-serif`;
      processedResult.textMarkers.forEach(tm => {
        ctx.fillText(tm.text, tm.x, -tm.y);
      });
    }

    // 3. 绘制识别出的窗户高亮层 (不再填充，仅显示细边框)
    windows.forEach((win) => {
      const isActive = win.id === activeWindowId;
      const pts = win.points;
      if (!pts || pts.length === 0) return;

      ctx.beginPath();
      ctx.moveTo(pts[0].x, -pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, -pts[i].y);
      ctx.closePath();

      // 关键改进：仅使用极淡的填充和细边框，防止遮挡原图线条
      ctx.fillStyle = isActive ? 'rgba(0, 122, 255, 0.1)' : 'rgba(255, 149, 0, 0.05)';
      ctx.fill();
      ctx.strokeStyle = isActive ? '#007AFF' : '#FF9500';
      ctx.lineWidth = (isActive ? 3 : 1.5) / scale;
      ctx.stroke();
    });

    ctx.restore();
  }, [processedResult, windows, activeWindowId]);

  const zoomToFit = useCallback(() => {
    if (!processedResult?.bounds || !transformRef.current || !containerRef.current) return;
    const { bounds } = processedResult;
    const rect = containerRef.current.getBoundingClientRect();
    
    const scaleX = (rect.width - 40) / (bounds.width || 1);
    const scaleY = (rect.height - 40) / (bounds.height || 1);
    let scale = Math.min(scaleX, scaleY);
    
    if (isNaN(scale) || !isFinite(scale) || scale <= 0) scale = 1;
    
    // 初始化位置：将图纸中心 (0,0) 放置在屏幕中心
    const initialX = rect.width / 2;
    const initialY = rect.height / 2;
    
    transformRef.current.setTransform(initialX, initialY, scale, 0);
    // 立即手动触发一次重绘，确保不闪烁
    draw({ scale, positionX: initialX, positionY: initialY });
  }, [processedResult, draw]);

  useImperativeHandle(ref, () => ({ 
    reset: zoomToFit, 
    zoomToWindow: (win: WindowItem) => {
      if (!transformRef.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pts = win.points;
      const cx = pts.reduce((a, b) => a + b.x, 0) / pts.length;
      const cy = pts.reduce((a, b) => a + b.y, 0) / pts.length;
      
      const targetScale = Math.min(rect.width / (win.width * 2.5), rect.height / (win.height * 2.5), 0.2);
      const px = rect.width / 2 - cx * targetScale;
      const py = rect.height / 2 + cy * targetScale;
      
      transformRef.current.setTransform(px, py, targetScale, 500);
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
    return <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />;
  };

  if (!processedResult) return <Center h="100%"><Loader /></Center>;

  return (
    <Box ref={containerRef} style={{ width: '100%', height: '100%', overflow: 'hidden', background: '#fff', position: 'relative' }}>
      <TransformWrapper 
        ref={transformRef} 
        minScale={0.00001} 
        maxScale={200} 
        initialScale={1}
        centerOnInit={false}
        limitToBounds={false}
        doubleClick={{ disabled: true }}
        wheel={{ step: 0.1 }}
      >
        <Box style={{ width: '100%', height: '100%', position: 'relative' }}>
          <Box style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0, pointerEvents: 'none' }}>
            <DrawingLayer />
          </Box>
          <TransformComponent wrapperStyle={{ width: '100%', height: '100%' }} contentStyle={{ width: '100%', height: '100%' }}>
             <div style={{ width: '100%', height: '100%', pointerEvents: 'auto' }} />
          </TransformComponent>
        </Box>
      </TransformWrapper>
      <Box style={{ position: 'absolute', bottom: 10, right: 10, zIndex: 10, pointerEvents: 'none' }}>
        <Badge color="blue" size="xs">Entities: {processedResult.totalEntities}</Badge>
      </Box>
    </Box>
  );
});
