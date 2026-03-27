import { useRef, useEffect, useCallback, forwardRef, useImperativeHandle, memo, useState } from 'react';
import { Box, Center, Stack, Badge, Loader } from '@mantine/core';
import { TransformWrapper, TransformComponent, ReactZoomPanPinchRef, useTransformEffect } from 'react-zoom-pan-pinch';
import { useWindowStore } from '../../stores/windowStore';
import { WindowItem } from '../../../shared/schemas';
import { useShallow } from 'zustand/react/shallow';

type RecognitionMarker = { text: string; x: number; y: number; layer: string };
type RecognitionSummary = {
  totalLabels: number;
  matchedLabels: number;
  unmatchedLabels: string[];
  unmatchedLabelMarkers: RecognitionMarker[];
  includedLayers: string[];
  excludedLayers: string[];
  excludedLayerDetails: Array<{ layer: string; entityCount: number; labelCount: number }>;
  activeEntityLayers: string[];
  activeLabelLayers: string[];
};

interface DxfViewerProps {
  processedResult: {
    pathChunks: { color: string; paths: Path2D[] }[];
    textMarkers?: RecognitionMarker[];
    bounds: any;
    totalEntities: number;
    recognitionSummary?: RecognitionSummary;
  } | null;
  windows: WindowItem[];
  focusedMarker?: RecognitionMarker | null;
}

export interface DxfViewerRef {
  reset: () => void;
  zoomToWindow: (window: WindowItem) => void;
  zoomToMarker: (marker: RecognitionMarker) => void;
}

const DxfViewerInner = forwardRef<DxfViewerRef, DxfViewerProps>(({ processedResult, windows, focusedMarker = null }, ref) => {
  const baseCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const transformRef = useRef<ReactZoomPanPinchRef>(null);
  const lastStateRef = useRef<any>(null);
  const requestRef = useRef<number | undefined>(undefined);
  const [minScale, setMinScale] = useState(0.001);

  const { activeWindowId } = useWindowStore(useShallow((state) => ({
    activeWindowId: state.activeWindowId,
  })));

  const prepareCanvas = (canvas: HTMLCanvasElement | null, alpha = false) => {
    if (!canvas) return null;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth * dpr;
    const h = canvas.clientHeight * dpr;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    const ctx = canvas.getContext('2d', { alpha });
    if (!ctx) return null;
    return { ctx, dpr, w, h };
  };

  const canUseRect = (rect: DOMRect) => Number.isFinite(rect.width) && Number.isFinite(rect.height) && rect.width > 0 && rect.height > 0;
  const isFiniteTransform = (x: number, y: number, scale: number) => (
    Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(scale) && scale > 0
  );
  const setSafeTransform = (x: number, y: number, scale: number, animationTime = 0) => {
    if (!transformRef.current || !isFiniteTransform(x, y, scale)) return;
    transformRef.current.setTransform(x, y, scale, animationTime);
  };

  const drawBase = useCallback((state: { scale: number; positionX: number; positionY: number }) => {
    const prepared = prepareCanvas(baseCanvasRef.current);
    if (!prepared || !processedResult) return;
    const { ctx, dpr, w, h } = prepared;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, w, h);
    if (!processedResult.pathChunks || processedResult.pathChunks.length === 0) return;

    const { scale, positionX: px, positionY: py } = state;
    if (isNaN(scale) || isNaN(px) || isNaN(py)) return;

    ctx.save();
    ctx.translate(px * dpr, py * dpr);
    ctx.scale(scale * dpr, scale * dpr);
    ctx.lineWidth = 1.0 / scale;
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'miter';

    processedResult.pathChunks.forEach((chunk) => {
      ctx.strokeStyle = chunk.color;
      chunk.paths.forEach((path) => ctx.stroke(path));
    });

    // 只在足够放大时绘制少量原图文字，避免识别完成后首帧卡住。
    if (processedResult.textMarkers && scale > 0.01) {
      const visibleTextMarkers = processedResult.textMarkers.length > 600
        ? processedResult.textMarkers.slice(0, 600)
        : processedResult.textMarkers;
      ctx.fillStyle = '#444444';
      ctx.font = `${11 / scale}px sans-serif`;
      visibleTextMarkers.forEach((tm) => {
        ctx.fillText(tm.text, tm.x, -tm.y);
      });
    }

    ctx.restore();
  }, [processedResult]);

  const drawOverlay = useCallback((state: { scale: number; positionX: number; positionY: number }) => {
    const prepared = prepareCanvas(overlayCanvasRef.current, true);
    if (!prepared || !processedResult) return;
    const { ctx, dpr, w, h } = prepared;
    ctx.clearRect(0, 0, w, h);

    const { scale, positionX: px, positionY: py } = state;
    if (isNaN(scale) || isNaN(px) || isNaN(py)) return;

    ctx.save();
    ctx.translate(px * dpr, py * dpr);
    ctx.scale(scale * dpr, scale * dpr);

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

    if (focusedMarker) {
      const x = focusedMarker.x;
      const y = -focusedMarker.y;
      const radius = 120 / scale;

      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 59, 48, 0.14)';
      ctx.fill();
      ctx.strokeStyle = '#FF3B30';
      ctx.lineWidth = 3 / scale;
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(x - radius * 0.55, y);
      ctx.lineTo(x + radius * 0.55, y);
      ctx.moveTo(x, y - radius * 0.55);
      ctx.lineTo(x, y + radius * 0.55);
      ctx.strokeStyle = '#FF3B30';
      ctx.lineWidth = 2 / scale;
      ctx.stroke();

      ctx.fillStyle = '#FF3B30';
      ctx.font = `bold ${13 / scale}px sans-serif`;
      ctx.fillText(focusedMarker.text, x + radius * 0.7, y - radius * 0.7);
    }

    ctx.restore();
  }, [processedResult, windows, activeWindowId, focusedMarker]);

  const zoomToFit = useCallback(() => {
    if (!processedResult?.bounds || !transformRef.current || !containerRef.current) return;
    const { bounds } = processedResult;
    const rect = containerRef.current.getBoundingClientRect();
    if (!canUseRect(rect)) return;
    
    const scaleX = (rect.width - 40) / (bounds.width || 1);
    const scaleY = (rect.height - 40) / (bounds.height || 1);
    let scale = Math.min(scaleX, scaleY);
    
    if (isNaN(scale) || !isFinite(scale) || scale <= 0) scale = 1;
    setMinScale(Math.max(scale * 0.75, 0.0005));
    
    // 初始化位置：将图纸中心 (0,0) 放置在屏幕中心
    const initialX = rect.width / 2;
    const initialY = rect.height / 2;
    
    setSafeTransform(initialX, initialY, scale, 0);
    // 立即手动触发一次重绘，确保不闪烁
    drawBase({ scale, positionX: initialX, positionY: initialY });
    drawOverlay({ scale, positionX: initialX, positionY: initialY });
  }, [processedResult, drawBase, drawOverlay]);

  useImperativeHandle(ref, () => ({ 
    reset: zoomToFit, 
    zoomToWindow: (win: WindowItem) => {
      if (!transformRef.current || !containerRef.current) return;
      if (!win.points?.length || !Number.isFinite(win.width) || !Number.isFinite(win.height) || win.width <= 0 || win.height <= 0) return;
      const rect = containerRef.current.getBoundingClientRect();
      if (!canUseRect(rect)) return;
      const pts = win.points;
      const cx = pts.reduce((a, b) => a + b.x, 0) / pts.length;
      const cy = pts.reduce((a, b) => a + b.y, 0) / pts.length;
      
      const targetScale = Math.max(minScale, Math.min(rect.width / (win.width * 2.5), rect.height / (win.height * 2.5), 0.2));
      const px = rect.width / 2 - cx * targetScale;
      const py = rect.height / 2 + cy * targetScale;
      
      setSafeTransform(px, py, targetScale, 500);
    },
    zoomToMarker: (marker: RecognitionMarker) => {
      if (!transformRef.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      if (!canUseRect(rect) || !Number.isFinite(marker.x) || !Number.isFinite(marker.y)) return;
      const targetScale = Math.max(minScale, 0.12);
      const px = rect.width / 2 - marker.x * targetScale;
      const py = rect.height / 2 + marker.y * targetScale;

      setSafeTransform(px, py, targetScale, 500);
    },
  }));

  useEffect(() => { if (processedResult) setTimeout(zoomToFit, 100); }, [processedResult, zoomToFit]);
  useEffect(() => {
    if (!lastStateRef.current) return;
    drawOverlay(lastStateRef.current);
  }, [drawOverlay]);
  useEffect(() => {
    if (!focusedMarker) return;
    const timeoutId = window.setTimeout(() => {
      if (focusedMarker) {
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect || !canUseRect(rect) || !Number.isFinite(focusedMarker.x) || !Number.isFinite(focusedMarker.y)) return;
        const targetScale = rect ? Math.max(minScale, Math.min(Math.max(rect.width / 4000, 0.05), 0.2)) : Math.max(minScale, 0.12);
        const px = (rect?.width || 0) / 2 - focusedMarker.x * targetScale;
        const py = (rect?.height || 0) / 2 + focusedMarker.y * targetScale;
        setSafeTransform(px, py, targetScale, 500);
      }
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [focusedMarker]);

  const DrawingLayer = () => {
    useTransformEffect(({ state }) => {
      lastStateRef.current = state;
      if (requestRef.current === undefined) {
        requestRef.current = requestAnimationFrame(() => {
          if (lastStateRef.current) {
            drawBase(lastStateRef.current);
            drawOverlay(lastStateRef.current);
          }
          requestRef.current = undefined;
        });
      }
    });
    return (
      <>
        <canvas ref={baseCanvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
        <canvas ref={overlayCanvasRef} style={{ width: '100%', height: '100%', display: 'block', position: 'absolute', inset: 0 }} />
      </>
    );
  };

  if (!processedResult) return <Center h="100%"><Loader /></Center>;

  return (
    <Box ref={containerRef} style={{ width: '100%', height: '100%', overflow: 'hidden', background: '#fff', position: 'relative' }}>
      <TransformWrapper 
        ref={transformRef} 
        minScale={minScale} 
        maxScale={200} 
        initialScale={1}
        centerOnInit={false}
        limitToBounds={false}
        doubleClick={{ disabled: true }}
        wheel={{ step: 0.04 }}
        panning={{ disabled: !processedResult }}
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
        <Stack gap={6} align="flex-end">
          <Badge color="blue" size="xs">Entities: {processedResult.totalEntities}</Badge>
          {processedResult.recognitionSummary ? (
            <Badge color={processedResult.recognitionSummary.unmatchedLabels.length > 0 ? 'yellow' : 'teal'} size="xs">
              Labels: {processedResult.recognitionSummary.matchedLabels}/{processedResult.recognitionSummary.totalLabels}
            </Badge>
          ) : null}
        </Stack>
      </Box>
    </Box>
  );
});

DxfViewerInner.displayName = 'DxfViewer';

export const DxfViewer = memo(DxfViewerInner);
