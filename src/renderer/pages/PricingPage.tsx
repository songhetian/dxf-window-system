import React, { memo, useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Checkbox,
  Group,
  Modal,
  MultiSelect,
  NumberInput,
  Pagination,
  Paper,
  ScrollArea,
  Select,
  SegmentedControl,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import {
  IconDeviceFloppy,
  IconFileExport,
  IconPlus,
  IconReceipt2,
  IconTrash,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useMediaQuery } from '@mantine/hooks';
import * as XLSX from 'xlsx';

import {
  MaterialItem,
  PricingProduct,
  PricingQuote,
} from '../../shared/schemas';
import { PageScaffold } from '../components/ui/PageScaffold';
import {
  useCreatePricingQuote,
  useDrawings,
  useDrawingWindows,
  useMaterialCategories,
  useMaterials,
  usePricingProducts,
  usePricingRates,
} from '../hooks/useWindowApi';
import { useDebounce } from '../hooks/useDebounce';
import { useWindowStore } from '../stores/windowStore';
import { useShallow } from 'zustand/react/shallow';

type QuoteExtraMaterialDraft = {
  id: string;
  categoryId: string | null;
  materialId: string | null;
  quantity: number;
};

type QuoteLineDraft = {
  id: string;
  sourceName: string;
  productId: string | null;
  shapeMode: 'rect' | 'triangle' | 'trapezoid' | 'arch' | 'manual';
  width: number;
  height: number;
  shapeTopWidth: number;
  shapeRise: number;
  pricingArea: number;
  pricingPerimeter: number;
  quantity: number;
  lineRateIds: string[];
  extraMaterials: QuoteExtraMaterialDraft[];
};

type QuoteLineEditorProps = {
  line: QuoteLineDraft;
  index: number;
  selected: boolean;
  checked: boolean;
  productOptions: Array<{ value: string; label: string }>;
  rateOptions: Array<{ value: string; label: string }>;
  categoryOptions: Array<{ value: string; label: string }>;
  materialsByCategory: Map<string, MaterialItem[]>;
  materials: MaterialItem[];
  productMap: Map<string, PricingProduct>;
  savePending: boolean;
  onSelect: (lineId: string) => void;
  onToggleChecked: (lineId: string, checked: boolean) => void;
  onSaveSingle: (lineId: string) => void;
  onRemove: (lineId: string) => void;
  onEditMaterials: (lineId: string) => void;
  onUpdateLine: (lineId: string, updater: (current: QuoteLineDraft) => QuoteLineDraft) => void;
};

const modeLabelMap: Record<string, string> = {
  area: '按面积',
  perimeter: '按周长',
  fixed: '按件数',
};

const shapeModeLabelMap: Record<QuoteLineDraft['shapeMode'], string> = {
  rect: '矩形窗',
  triangle: '三角窗',
  trapezoid: '梯形窗',
  arch: '拱形窗',
  manual: '异形手动',
};
const deferredShapeModes: QuoteLineDraft['shapeMode'][] = ['triangle', 'trapezoid', 'arch'];

const emptyExtraMaterial = (): QuoteExtraMaterialDraft => ({
  id: crypto.randomUUID(),
  categoryId: null,
  materialId: null,
  quantity: 1,
});

const createLineDraft = (partial?: Partial<QuoteLineDraft>): QuoteLineDraft => ({
  id: crypto.randomUUID(),
  sourceName: partial?.sourceName || '',
  productId: partial?.productId ?? null,
  shapeMode: partial?.shapeMode ?? 'rect',
  width: partial?.width ?? 1500,
  height: partial?.height ?? 1500,
  shapeTopWidth: partial?.shapeTopWidth ?? 900,
  shapeRise: partial?.shapeRise ?? 300,
  pricingArea: partial?.pricingArea ?? 0,
  pricingPerimeter: partial?.pricingPerimeter ?? 0,
  quantity: partial?.quantity ?? 1,
  lineRateIds: partial?.lineRateIds ?? [],
  extraMaterials: partial?.extraMaterials ?? [],
});

const currency = (value: number) => value.toFixed(2);
const areaForLine = (width: number, height: number, quantity: number) => Math.max(width, 0) / 1000 * (Math.max(height, 0) / 1000) * Math.max(quantity, 0);
const perimeterForLine = (width: number, height: number, quantity: number) => (2 * ((Math.max(width, 0) / 1000) + (Math.max(height, 0) / 1000))) * Math.max(quantity, 0);
const mmToM = (value: number) => Math.max(value, 0) / 1000;
const safeSqrt = (value: number) => Math.sqrt(Math.max(value, 0));
const circularSegmentMetrics = (chord: number, rise: number) => {
  const c = mmToM(chord);
  const h = mmToM(rise);
  if (c <= 0 || h <= 0) return { area: 0, arcLength: 0 };
  const radius = (c * c) / (8 * h) + h / 2;
  const theta = 2 * Math.acos(Math.max(-1, Math.min(1, (radius - h) / radius)));
  const area = 0.5 * radius * radius * (theta - Math.sin(theta));
  const arcLength = radius * theta;
  return { area, arcLength };
};
const effectiveAreaForLine = (line: Pick<QuoteLineDraft, 'shapeMode' | 'width' | 'height' | 'quantity' | 'pricingArea' | 'shapeTopWidth' | 'shapeRise'>) => {
  if (line.shapeMode === 'manual') return Math.max(line.pricingArea, 0);
  const quantity = Math.max(line.quantity, 0);
  const width = mmToM(line.width);
  const height = mmToM(line.height);
  const topWidth = mmToM(line.shapeTopWidth);
  const rise = mmToM(line.shapeRise);
  if (line.shapeMode === 'triangle') return 0.5 * width * height * quantity;
  if (line.shapeMode === 'trapezoid') return ((width + Math.min(topWidth, width)) * height / 2) * quantity;
  if (line.shapeMode === 'arch') {
    const segment = circularSegmentMetrics(line.width, line.shapeRise);
    return (width * height + segment.area) * quantity;
  }
  return areaForLine(line.width, line.height, line.quantity);
};
const effectivePerimeterForLine = (line: Pick<QuoteLineDraft, 'shapeMode' | 'width' | 'height' | 'quantity' | 'pricingPerimeter' | 'shapeTopWidth' | 'shapeRise'>) => {
  if (line.shapeMode === 'manual') return Math.max(line.pricingPerimeter, 0);
  const quantity = Math.max(line.quantity, 0);
  const width = mmToM(line.width);
  const height = mmToM(line.height);
  const topWidth = mmToM(line.shapeTopWidth);
  if (line.shapeMode === 'triangle') {
    const side = safeSqrt((width / 2) ** 2 + height ** 2);
    return (width + side * 2) * quantity;
  }
  if (line.shapeMode === 'trapezoid') {
    const normalizedTopWidth = Math.min(topWidth, width);
    const side = safeSqrt(((width - normalizedTopWidth) / 2) ** 2 + height ** 2);
    return (width + normalizedTopWidth + side * 2) * quantity;
  }
  if (line.shapeMode === 'arch') {
    const segment = circularSegmentMetrics(line.width, line.shapeRise);
    return (width + height * 2 + segment.arcLength) * quantity;
  }
  return perimeterForLine(line.width, line.height, line.quantity);
};
const qtyForMode = (mode: string, area: number, perimeter: number, quantity: number, factor: number) => {
  if (mode === 'area') return area * factor;
  if (mode === 'perimeter') return perimeter * factor;
  return quantity * factor;
};
const unitForMode = (mode: string, fallback?: string) => fallback || (mode === 'area' ? '㎡' : mode === 'perimeter' ? 'm' : '件');

const buildQuotePayload = ({
  quoteName,
  lines,
  products,
  materials,
  categories,
  rates,
  globalRateIds,
}: {
  quoteName: string;
  lines: QuoteLineDraft[];
  products: PricingProduct[];
  materials: MaterialItem[];
  categories: Array<{ id?: string; name: string }>;
  rates: Array<{ id?: string; name: string; percentage: number }>;
  globalRateIds: string[];
}): Omit<PricingQuote, 'id' | 'createdAt'> => {
  const productMap = new Map(products.map((item) => [item.id || '', item]));
  const materialMap = new Map(materials.map((item) => [item.id || '', item]));
  const categoryMap = new Map(categories.map((item) => [item.id || '', item.name]));
  const rateMap = new Map(rates.map((item) => [item.id || '', item]));

  const computedLines = lines
    .map((line) => {
      const product = line.productId ? productMap.get(line.productId) || null : null;
      if (!product) return null;

      const totalArea = effectiveAreaForLine(line);
      const totalPerimeter = effectivePerimeterForLine(line);
      let runningCost = 0;
      let runningRetail = 0;

      const detailRows: PricingQuote['details'] = [];

      product.items.forEach((item) => {
        const mode = item.calcMode || product.pricingMode;
        const baseValue = qtyForMode(mode, totalArea, totalPerimeter, line.quantity, item.quantity);
        const costPrice = item.costPrice || 0;
        const retailPrice = item.retailPrice || 0;
        const costSubtotal = baseValue * costPrice;
        const retailSubtotal = baseValue * retailPrice;
        runningCost += costSubtotal;
        runningRetail += retailSubtotal;
        detailRows.push({
          materialId: item.materialId,
          lineId: line.id,
          lineName: line.sourceName || product.name,
          sourceType: 'combo',
          basisMode: mode,
          baseValue,
          quantity: baseValue,
          unit: unitForMode(mode, item.unitLabel),
          name: item.materialName || '未命名材料',
          categoryName: '组合材料',
          costPrice,
          retailPrice,
          costSubtotal,
          retailSubtotal,
          allocatedCostPerSquareMeter: totalArea > 0 ? costSubtotal / totalArea : 0,
          allocatedRetailPerSquareMeter: totalArea > 0 ? retailSubtotal / totalArea : 0,
        });
      });

      const lineExtraMaterials = line.extraMaterials
        .map((draft) => {
          const material = draft.materialId ? materialMap.get(draft.materialId) || null : null;
          if (!material) return null;
          const mode = material.unitType || 'area';
          const baseValue = qtyForMode(mode, totalArea, totalPerimeter, line.quantity, draft.quantity);
          const costPrice = material.costPrice || 0;
          const retailPrice = material.retailPrice || 0;
          const costSubtotal = baseValue * costPrice;
          const retailSubtotal = baseValue * retailPrice;
          runningCost += costSubtotal;
          runningRetail += retailSubtotal;
          const row: PricingQuote['details'][number] = {
            materialId: material.id,
            lineId: line.id,
            lineName: line.sourceName || product.name,
            sourceType: 'extra',
            basisMode: mode,
            baseValue,
            quantity: baseValue,
            unit: unitForMode(mode, material.unitLabel),
            name: material.name,
            categoryName: categoryMap.get(material.categoryId) || '',
            costPrice,
            retailPrice,
            costSubtotal,
            retailSubtotal,
            allocatedCostPerSquareMeter: totalArea > 0 ? costSubtotal / totalArea : 0,
            allocatedRetailPerSquareMeter: totalArea > 0 ? retailSubtotal / totalArea : 0,
          };
          return {
            id: draft.id,
            materialId: material.id || '',
            name: material.name,
            categoryId: material.categoryId,
            categoryName: categoryMap.get(material.categoryId) || '',
            unitType: mode,
            unitLabel: material.unitLabel,
            quantity: draft.quantity,
            costPrice,
            retailPrice,
            detail: row,
          };
        })
        .filter(Boolean) as Array<{
          id: string;
          materialId: string;
          name: string;
          categoryId?: string;
          categoryName?: string;
          unitType: string;
          unitLabel?: string;
          quantity: number;
          costPrice: number;
          retailPrice: number;
          detail: PricingQuote['details'][number];
        }>;

      lineExtraMaterials.forEach((item) => detailRows.push(item.detail));

      const lineRateSummary = line.lineRateIds
        .map((id) => rateMap.get(id))
        .filter(Boolean)
        .map((rate) => ({ id: rate?.id, name: rate?.name || '', percentage: rate?.percentage || 0 }));

      lineRateSummary.forEach((rate) => {
        const costSubtotal = runningCost * (rate.percentage / 100);
        const retailSubtotal = runningRetail * (rate.percentage / 100);
        detailRows.push({
          lineId: line.id,
          lineName: line.sourceName || product.name,
          sourceType: 'line-rate',
          basisMode: 'rate',
          baseValue: rate.percentage,
          quantity: rate.percentage,
          unit: '%',
          name: rate.name,
          categoryName: '组合费率',
          costPrice: runningCost / 100,
          retailPrice: runningRetail / 100,
          costSubtotal,
          retailSubtotal,
          allocatedCostPerSquareMeter: totalArea > 0 ? costSubtotal / totalArea : 0,
          allocatedRetailPerSquareMeter: totalArea > 0 ? retailSubtotal / totalArea : 0,
        });
        runningCost += costSubtotal;
        runningRetail += retailSubtotal;
      });

      return {
        id: line.id,
        sourceName: line.sourceName,
        productId: product.id || null,
        productName: product.name,
        shapeMode: line.shapeMode,
        shapeTopWidth: line.shapeTopWidth,
        shapeRise: line.shapeRise,
        width: line.width,
        height: line.height,
        pricingArea: totalArea,
        pricingPerimeter: totalPerimeter,
        quantity: line.quantity,
        area: totalArea,
        perimeter: totalPerimeter,
        costTotal: runningCost,
        retailTotal: runningRetail,
        lineRateIds: line.lineRateIds,
        lineRateSummary,
        extraMaterials: lineExtraMaterials.map(({ detail, ...item }) => item),
        details: detailRows,
      };
    })
    .filter(Boolean) as PricingQuote['items'];

  const baseCostTotal = computedLines.reduce((sum, item) => sum + item.costTotal, 0);
  const baseRetailTotal = computedLines.reduce((sum, item) => sum + item.retailTotal, 0);
  const globalRateEligibleLines = computedLines.filter((item) => (item.lineRateIds?.length || 0) === 0);
  const globalRateEligibleCostTotal = globalRateEligibleLines.reduce((sum, item) => sum + item.costTotal, 0);
  const globalRateEligibleRetailTotal = globalRateEligibleLines.reduce((sum, item) => sum + item.retailTotal, 0);
  let quoteCostTotal = baseCostTotal;
  let quoteRetailTotal = baseRetailTotal;

  const details: PricingQuote['details'] = computedLines.flatMap((item) => item.details);
  const globalRateSummary = globalRateIds
    .map((id) => rateMap.get(id))
    .filter(Boolean)
    .map((rate) => ({ id: rate?.id, name: rate?.name || '', percentage: rate?.percentage || 0 }));

  let currentGlobalRateCostBase = globalRateEligibleCostTotal;
  let currentGlobalRateRetailBase = globalRateEligibleRetailTotal;
  globalRateSummary.forEach((rate) => {
    const costSubtotal = currentGlobalRateCostBase * (rate.percentage / 100);
    const retailSubtotal = currentGlobalRateRetailBase * (rate.percentage / 100);
    details.push({
      lineName: '整单汇总',
      sourceType: 'global-rate',
      basisMode: 'rate',
      baseValue: rate.percentage,
      quantity: rate.percentage,
      unit: '%',
      name: rate.name,
      categoryName: '统一费率(仅无单独费率组合)',
      costPrice: currentGlobalRateCostBase / 100,
      retailPrice: currentGlobalRateRetailBase / 100,
      costSubtotal,
      retailSubtotal,
      allocatedCostPerSquareMeter: 0,
      allocatedRetailPerSquareMeter: 0,
    });
    quoteCostTotal += costSubtotal;
    quoteRetailTotal += retailSubtotal;
    currentGlobalRateCostBase += costSubtotal;
    currentGlobalRateRetailBase += retailSubtotal;
  });

  const distinctProducts = [...new Set(computedLines.map((item) => item.productName).filter(Boolean))];
  const totalArea = computedLines.reduce((sum, item) => sum + item.area, 0);
  const totalPerimeter = computedLines.reduce((sum, item) => sum + item.perimeter, 0);
  const totalQuantity = computedLines.reduce((sum, item) => sum + item.quantity, 0);

  return {
    name: quoteName.trim(),
    productId: computedLines.length === 1 ? computedLines[0].productId || null : null,
    productName: distinctProducts.join(' + ') || '多组合报价',
    width: computedLines.length === 1 ? computedLines[0].width : 0,
    height: computedLines.length === 1 ? computedLines[0].height : 0,
    quantity: totalQuantity,
    area: totalArea,
    perimeter: totalPerimeter,
    costTotal: quoteCostTotal,
    retailTotal: quoteRetailTotal,
    globalRateIds,
    globalRateSummary,
    items: computedLines,
    details,
  };
};

const PricingPage = () => {
  const { data: products = [] } = usePricingProducts();
  const { data: rates = [] } = usePricingRates();
  const { data: drawings = [] } = useDrawings();
  const { data: categories = [] } = useMaterialCategories();
  const { data: materials = [] } = useMaterials();
  const saveQuote = useCreatePricingQuote();
  const {
    pricingDraft,
    clearPricingDraft,
    pricingQueue,
    removePricingQueueItem,
  } = useWindowStore(useShallow((state) => ({
    pricingDraft: state.pricingDraft,
    clearPricingDraft: state.clearPricingDraft,
    pricingQueue: state.pricingQueue,
    removePricingQueueItem: state.removePricingQueueItem,
  })));

  const [quoteName, setQuoteName] = useState('');
  const [globalRateIds, setGlobalRateIds] = useState<string[]>([]);
  const [sourceDrawingId, setSourceDrawingId] = useState<string | null>(null);
  const [sourceWindowId, setSourceWindowId] = useState<string | null>(null);
  const [lines, setLines] = useState<QuoteLineDraft[]>([createLineDraft()]);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [detailModalOpened, setDetailModalOpened] = useState(false);
  const [editingMaterialsLineId, setEditingMaterialsLineId] = useState<string | null>(null);
  const [savingLineId, setSavingLineId] = useState<string | null>(null);
  const [lineKeyword, setLineKeyword] = useState('');
  const [linePage, setLinePage] = useState(1);
  const [selectedLineIds, setSelectedLineIds] = useState<string[]>([]);
  const [batchLineRateIds, setBatchLineRateIds] = useState<string[]>([]);
  const isNarrowScreen = useMediaQuery('(max-width: 1180px)');
  const { data: sourceWindows = [] } = useDrawingWindows(sourceDrawingId);
  const deferredQuoteName = useDeferredValue(quoteName);
  const deferredGlobalRateIds = useDeferredValue(globalRateIds);
  const deferredLines = useDeferredValue(lines);
  const debouncedQuoteName = useDebounce(deferredQuoteName, 120);
  const debouncedGlobalRateIds = useDebounce(deferredGlobalRateIds, 120);
  const debouncedLines = useDebounce(deferredLines, 120);

  useEffect(() => {
    if (!pricingDraft) return;
    const nextLine = createLineDraft({
      sourceName: pricingDraft.sourceName,
      width: Math.round(pricingDraft.width),
      height: Math.round(pricingDraft.height),
      quantity: pricingDraft.quantity || 1,
      productId: pricingDraft.productId || null,
    });
    setQuoteName((current) => current || `${pricingDraft.sourceName} 报价单`);
    setLines((current) => [...current, nextLine]);
    setSelectedLineId(nextLine.id);
    clearPricingDraft();
  }, [clearPricingDraft, pricingDraft]);

  useEffect(() => {
    if (!sourceWindowId) return;
    const selectedWindow = sourceWindows.find((item) => item.id === sourceWindowId);
    if (!selectedWindow) return;
    const nextLine = createLineDraft({
      sourceName: selectedWindow.name,
      width: Math.round(selectedWindow.width),
      height: Math.round(selectedWindow.height),
      quantity: 1,
    });
    setQuoteName((current) => current || `${selectedWindow.name} 报价单`);
    setLines((current) => [...current, nextLine]);
    setSelectedLineId(nextLine.id);
    setSourceWindowId(null);
  }, [sourceWindowId, sourceWindows]);

  const rateOptions = useMemo(
    () => rates.map((item) => ({ value: item.id || '', label: `${item.name} (${item.percentage}%)` })),
    [rates],
  );
  const productOptions = useMemo(
    () => products.map((item) => ({ value: item.id || '', label: item.name })),
    [products],
  );
  const categoryOptions = useMemo(
    () => categories.map((item) => ({ value: item.id || '', label: item.name })),
    [categories],
  );
  const productMap = useMemo(() => new Map(products.map((item) => [item.id || '', item])), [products]);
  const materialsByCategory = useMemo(() => {
    const group = new Map<string, MaterialItem[]>();
    materials.forEach((material) => {
      const key = material.categoryId || '';
      group.set(key, [...(group.get(key) || []), material]);
    });
    return group;
  }, [materials]);

  const quotePreview = useMemo(() => buildQuotePayload({
    quoteName: debouncedQuoteName,
    lines: debouncedLines,
    products,
    materials,
    categories,
    rates,
    globalRateIds: debouncedGlobalRateIds,
  }), [categories, debouncedGlobalRateIds, debouncedLines, debouncedQuoteName, materials, products, rates]);

  const quoteSummary = useMemo(() => ({
    comboCount: quotePreview.items.length,
    totalArea: quotePreview.area,
    totalPerimeter: quotePreview.perimeter,
    costTotal: quotePreview.costTotal,
    retailTotal: quotePreview.retailTotal,
    retailPerSquareMeter: quotePreview.area > 0 ? quotePreview.retailTotal / quotePreview.area : 0,
  }), [quotePreview]);

  const filteredLines = useMemo(() => {
    const keyword = lineKeyword.trim().toLowerCase();
    if (!keyword) return lines;
    return lines.filter((line) => {
      const productName = line.productId ? productMap.get(line.productId)?.name || '' : '';
      return `${line.sourceName} ${productName} ${line.width} ${line.height}`.toLowerCase().includes(keyword);
    });
  }, [lineKeyword, lines, productMap]);

  const LINE_PAGE_SIZE = 8;
  const lineTotalPages = Math.max(1, Math.ceil(filteredLines.length / LINE_PAGE_SIZE));
  const pagedLines = useMemo(() => {
    const start = (linePage - 1) * LINE_PAGE_SIZE;
    return filteredLines.slice(start, start + LINE_PAGE_SIZE);
  }, [filteredLines, linePage]);

  const allCurrentPageChecked = pagedLines.length > 0 && pagedLines.every((line) => selectedLineIds.includes(line.id));

  const effectiveSelectedLineId = useMemo(() => {
    if (selectedLineId && lines.some((line) => line.id === selectedLineId)) return selectedLineId;
    return lines[0]?.id || null;
  }, [lines, selectedLineId]);

  const selectedLineDraft = effectiveSelectedLineId ? lines.find((line) => line.id === effectiveSelectedLineId) || null : null;
  const editingMaterialsLine = editingMaterialsLineId ? lines.find((line) => line.id === editingMaterialsLineId) || null : null;

  const updateLine = useCallback((lineId: string, updater: (current: QuoteLineDraft) => QuoteLineDraft) => {
    setLines((current) => current.map((line) => (line.id === lineId ? updater(line) : line)));
  }, []);

  const handleRemoveLine = useCallback((lineId: string) => {
    setLines((current) => current.filter((item) => item.id !== lineId));
    setSelectedLineId((current) => (current === lineId ? null : current));
    setSelectedLineIds((current) => current.filter((item) => item !== lineId));
  }, []);

  const toggleCheckedLine = useCallback((lineId: string, checked: boolean) => {
    setSelectedLineIds((current) => (
      checked
        ? (current.includes(lineId) ? current : [...current, lineId])
        : current.filter((item) => item !== lineId)
    ));
  }, []);

  const toggleCurrentPageChecked = useCallback((checked: boolean) => {
    const pageIds = pagedLines.map((line) => line.id);
    setSelectedLineIds((current) => (
      checked
        ? [...new Set([...current, ...pageIds])]
        : current.filter((item) => !pageIds.includes(item))
    ));
  }, [pagedLines]);

  const handleBatchDelete = useCallback(() => {
    if (selectedLineIds.length === 0) return;
    setLines((current) => current.filter((line) => !selectedLineIds.includes(line.id)));
    setSelectedLineId((current) => (current && selectedLineIds.includes(current) ? null : current));
    setSelectedLineIds([]);
  }, [selectedLineIds]);

  const handleBatchApplyLineRates = useCallback(() => {
    if (selectedLineIds.length === 0) return;
    setLines((current) => current.map((line) => (
      selectedLineIds.includes(line.id)
        ? { ...line, lineRateIds: [...batchLineRateIds] }
        : line
    )));
  }, [batchLineRateIds, selectedLineIds]);

  useEffect(() => {
    setLinePage(1);
  }, [lineKeyword]);

  useEffect(() => {
    if (linePage > lineTotalPages) {
      setLinePage(lineTotalPages);
    }
  }, [linePage, lineTotalPages]);

  const removeQueueItemsForLines = (savedLines: PricingQuote['items']) => {
    savedLines.forEach((savedLine) => {
      const matched = pricingQueue.find((item) => (
        item.sourceName === savedLine.sourceName
        && Math.round(item.width) === Math.round(savedLine.width)
        && Math.round(item.height) === Math.round(savedLine.height)
        && item.quantity === savedLine.quantity
      ));
      if (matched?.id) removePricingQueueItem(matched.id);
    });
  };

  const savePayload = async (payload: Omit<PricingQuote, 'id' | 'createdAt'>, successMessage: string) => {
    if (!payload.name.trim()) {
      notifications.show({ title: '请输入报价名称', message: '保存前需要填写报价单名称。', color: 'red' });
      return;
    }
    if (payload.items.length === 0) {
      notifications.show({ title: '没有可保存的组合', message: '至少需要一条已选组合的明细。', color: 'red' });
      return;
    }
    await saveQuote.mutateAsync(payload);
    removeQueueItemsForLines(payload.items);
    notifications.show({ title: '已入库', message: successMessage, color: 'teal' });
  };

  const saveAll = useCallback(async () => {
    await savePayload(quotePreview, `报价单 ${quotePreview.name} 已保存，共 ${quotePreview.items.length} 条组合。`);
  }, [quotePreview]);

  const saveSingle = useCallback(async (lineId: string) => {
    const singleLine = lines.find((item) => item.id === lineId);
    if (!singleLine) return;
    const preview = buildQuotePayload({
      quoteName: `${quoteName.trim() || '报价单'} - ${singleLine.sourceName || '单项'}`,
      lines: [singleLine],
      products,
      materials,
      categories,
      rates,
      globalRateIds,
    });
    setSavingLineId(lineId);
    try {
      await savePayload(preview, `${preview.name} 已单独保存。`);
    } finally {
      setSavingLineId(null);
    }
  }, [categories, globalRateIds, lines, materials, products, quoteName, rates]);

  const exportCurrentQuote = () => {
    if (quotePreview.items.length === 0) {
      notifications.show({ title: '没有可导出的内容', message: '请先选择组合并填写尺寸。', color: 'yellow' });
      return;
    }

    const rows: Record<string, string | number>[] = [];
    rows.push({
      报价单: quotePreview.name,
      组合: '',
      来源: '',
      窗型: '',
      宽度: '',
      高度: '',
      上口宽: '',
      拱高: '',
      数量: '',
      面积: Number(quotePreview.area.toFixed(3)),
      周长: Number(quotePreview.perimeter.toFixed(3)),
      项目类型: '汇总',
      材料分类: '',
      项目名称: '总计',
      计价依据: '',
      基数: '',
      单位: '',
      成本单价: '',
      销售单价: '',
      成本小计: Number(quotePreview.costTotal.toFixed(2)),
      销售小计: Number(quotePreview.retailTotal.toFixed(2)),
      折算成本每平米: quotePreview.area > 0 ? Number((quotePreview.costTotal / quotePreview.area).toFixed(2)) : 0,
      折算销售每平米: quotePreview.area > 0 ? Number((quotePreview.retailTotal / quotePreview.area).toFixed(2)) : 0,
    });

    quotePreview.items.forEach((line) => {
      rows.push({
        报价单: quotePreview.name,
        组合: line.productName || '',
        来源: line.sourceName || '',
        窗型: shapeModeLabelMap[line.shapeMode],
        宽度: line.width,
        高度: line.height,
        上口宽: line.shapeTopWidth || '',
        拱高: line.shapeRise || '',
        数量: line.quantity,
        面积: Number(line.area.toFixed(3)),
        周长: Number(line.perimeter.toFixed(3)),
        项目类型: '组合汇总',
        材料分类: '',
        项目名称: '组合小计',
        计价依据: '',
        基数: '',
        单位: '',
        成本单价: '',
        销售单价: '',
        成本小计: Number(line.costTotal.toFixed(2)),
        销售小计: Number(line.retailTotal.toFixed(2)),
        折算成本每平米: line.area > 0 ? Number((line.costTotal / line.area).toFixed(2)) : 0,
        折算销售每平米: line.area > 0 ? Number((line.retailTotal / line.area).toFixed(2)) : 0,
      });
      line.details.forEach((detail) => {
        rows.push({
          报价单: quotePreview.name,
          组合: line.productName || '',
          来源: line.sourceName || '',
          窗型: shapeModeLabelMap[line.shapeMode],
          宽度: line.width,
          高度: line.height,
          上口宽: line.shapeTopWidth || '',
          拱高: line.shapeRise || '',
          数量: line.quantity,
          面积: Number(line.area.toFixed(3)),
          周长: Number(line.perimeter.toFixed(3)),
          项目类型: detail.sourceType || '',
          材料分类: detail.categoryName || '',
          项目名称: detail.name,
          计价依据: modeLabelMap[detail.basisMode || ''] || detail.basisMode || '',
          基数: Number((detail.baseValue || detail.quantity).toFixed(3)),
          单位: detail.unit,
          成本单价: Number(detail.costPrice.toFixed(2)),
          销售单价: Number(detail.retailPrice.toFixed(2)),
          成本小计: Number(detail.costSubtotal.toFixed(2)),
          销售小计: Number(detail.retailSubtotal.toFixed(2)),
          折算成本每平米: Number((detail.allocatedCostPerSquareMeter || 0).toFixed(2)),
          折算销售每平米: Number((detail.allocatedRetailPerSquareMeter || 0).toFixed(2)),
        });
      });
    });

    quotePreview.details
      .filter((detail) => detail.sourceType === 'global-rate')
      .forEach((detail) => {
        rows.push({
          报价单: quotePreview.name,
          组合: '',
          来源: '',
          窗型: '',
          宽度: '',
          高度: '',
          上口宽: '',
          拱高: '',
          数量: '',
          面积: Number(quotePreview.area.toFixed(3)),
          周长: Number(quotePreview.perimeter.toFixed(3)),
          项目类型: 'global-rate',
          材料分类: detail.categoryName || '',
          项目名称: detail.name,
          计价依据: '统一费率',
          基数: Number((detail.baseValue || detail.quantity).toFixed(3)),
          单位: detail.unit,
          成本单价: Number(detail.costPrice.toFixed(2)),
          销售单价: Number(detail.retailPrice.toFixed(2)),
          成本小计: Number(detail.costSubtotal.toFixed(2)),
          销售小计: Number(detail.retailSubtotal.toFixed(2)),
          折算成本每平米: '',
          折算销售每平米: '',
        });
      });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '报价明细');
    XLSX.writeFile(workbook, `${quotePreview.name || '报价单'}_明细.xlsx`);
  };

  return (
    <PageScaffold
      title="报价中心"
      description="一张报价单可以包含多个组合。每条明细独立设置规格、数量、组合费率和补充材料，顶部统一费率叠加到整单。"
    >
      <Stack gap="md" h="100%">
        <Box
          style={{
            display: 'grid',
            gridTemplateColumns: isNarrowScreen ? 'minmax(0, 1fr)' : 'minmax(280px, 1.1fr) minmax(260px, 1fr) minmax(280px, 1.2fr)',
            gap: 12,
          }}
        >
          <Paper withBorder radius={12} p="md" bg="var(--bg-subtle)">
            <Stack gap="sm">
              <Group justify="space-between" align="center">
                <Text fw={800}>报价单</Text>
                <Badge variant="light">{lines.length} 条明细</Badge>
              </Group>
              <TextInput
                label="报价单名称"
                value={quoteName}
                onChange={(event) => setQuoteName(event.currentTarget.value)}
                placeholder="例如：A栋外立面多组合报价单"
              />
              <MultiSelect
                label="统一费率"
                data={rateOptions}
                value={globalRateIds}
                onChange={setGlobalRateIds}
                placeholder="整单统一费率"
              />
            </Stack>
          </Paper>

          <Paper withBorder radius={12} p="md" bg="var(--bg-subtle)">
            <Stack gap="sm">
              <Text fw={800}>图纸带入</Text>
              <Select
                label="已保存图纸"
                placeholder="选择图纸"
                data={drawings.map((item) => ({ value: item.id || '', label: item.title }))}
                value={sourceDrawingId}
                onChange={(value) => {
                  setSourceDrawingId(value);
                  setSourceWindowId(null);
                }}
                searchable
              />
              <Select
                label="窗型"
                placeholder="带入一条明细"
                data={sourceWindows.map((item) => ({ value: item.id || '', label: `${item.name} (${Math.round(item.width)}×${Math.round(item.height)})` }))}
                value={sourceWindowId}
                onChange={setSourceWindowId}
                disabled={!sourceDrawingId}
                searchable
              />
            </Stack>
          </Paper>

          <Paper withBorder radius={12} p="md" bg="var(--bg-subtle)">
            <Stack gap="sm">
              <Group justify="space-between" align="center">
                <Text fw={800}>快捷操作</Text>
                <Group gap="xs">
                  <Button
                    variant="default"
                    leftSection={<IconPlus size={16} />}
                    onClick={() => {
                      const nextLine = createLineDraft();
                      setLines((current) => [...current, nextLine]);
                      setSelectedLineId(nextLine.id);
                    }}
                  >
                    新增明细
                  </Button>
                  <Button leftSection={<IconDeviceFloppy size={16} />} onClick={saveAll} loading={saveQuote.isPending && savingLineId === null}>
                    一键入库
                  </Button>
                  <Button variant="default" leftSection={<IconFileExport size={16} />} onClick={exportCurrentQuote}>
                    导出表格
                  </Button>
                </Group>
              </Group>
              {pricingQueue.length > 0 ? (
                <Group gap="xs">
                  {pricingQueue.slice(0, 6).map((item) => (
                    <Button
                      key={item.id}
                      size="compact-sm"
                      variant="light"
                      onClick={() => {
                        const nextLine = createLineDraft({
                          sourceName: item.sourceName,
                          width: Math.round(item.width),
                          height: Math.round(item.height),
                          quantity: item.quantity,
                        });
                        setLines((current) => [...current, nextLine]);
                        setSelectedLineId(nextLine.id);
                      }}
                    >
                      {item.sourceName} {Math.round(item.width)}×{Math.round(item.height)}
                    </Button>
                  ))}
                </Group>
              ) : (
                <Text size="sm" c="dimmed">暂无待报价队列</Text>
              )}
            </Stack>
          </Paper>
        </Box>

        <Box
          style={{
            display: 'grid',
            gridTemplateColumns: isNarrowScreen ? 'minmax(0, 1fr)' : 'minmax(320px, 1.2fr) minmax(300px, 0.8fr)',
            gap: 12,
            alignItems: 'start',
          }}
        >
          <Paper withBorder radius={14} p="md">
            <Stack gap="md">
              <Group justify="space-between" align="flex-end">
                <Title order={4}>报价单明细</Title>
                <Badge variant="light">{filteredLines.length} / {lines.length}</Badge>
              </Group>

              <Group align="flex-end">
                <TextInput
                  label="搜索明细"
                  placeholder="按来源、组合、尺寸筛选"
                  value={lineKeyword}
                  onChange={(event) => setLineKeyword(event.currentTarget.value)}
                  style={{ flex: 1 }}
                />
              </Group>

              <Paper withBorder radius={12} p="sm" bg="var(--bg-subtle)">
                <Stack gap="sm">
                  <Group justify="space-between" align="center">
                    <Group gap="sm">
                      <Checkbox
                        checked={allCurrentPageChecked}
                        onChange={(event) => toggleCurrentPageChecked(event.currentTarget.checked)}
                        label="本页全选"
                      />
                      <Badge variant="light">{selectedLineIds.length} 条已选</Badge>
                    </Group>
                    <Button size="compact-sm" variant="light" color="red" onClick={handleBatchDelete} disabled={selectedLineIds.length === 0}>
                      批量删除
                    </Button>
                  </Group>
                  <Group align="flex-end">
                    <MultiSelect
                      label="批量设置组合费率"
                      data={rateOptions}
                      value={batchLineRateIds}
                      onChange={setBatchLineRateIds}
                      placeholder="选中后应用到已勾选明细"
                      style={{ flex: 1 }}
                    />
                    <Button size="sm" variant="default" onClick={handleBatchApplyLineRates} disabled={selectedLineIds.length === 0}>
                      应用
                    </Button>
                  </Group>
                </Stack>
              </Paper>

              {pagedLines.length > 0 ? (
                <Box style={{ overflowX: 'auto' }}>
                  <Table
                    withTableBorder
                    withColumnBorders
                    stickyHeader
                    stickyHeaderOffset={0}
                    striped
                    highlightOnHover
                    style={{ minWidth: 1220 }}
                  >
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th ta="center" w={44}>
                          <Checkbox
                            checked={allCurrentPageChecked}
                            onChange={(event) => toggleCurrentPageChecked(event.currentTarget.checked)}
                          />
                        </Table.Th>
                        <Table.Th ta="center" w={170}>来源</Table.Th>
                        <Table.Th ta="center" w={210}>组合</Table.Th>
                        <Table.Th ta="center" w={110}>窗型</Table.Th>
                        <Table.Th ta="center" w={110}>宽度</Table.Th>
                        <Table.Th ta="center" w={110}>高度</Table.Th>
                        <Table.Th ta="center" w={90}>数量</Table.Th>
                        <Table.Th ta="center" w={160}>组合费率</Table.Th>
                        <Table.Th ta="center" w={130}>面积</Table.Th>
                        <Table.Th ta="center" w={130}>周长</Table.Th>
                        <Table.Th ta="center" w={90}>材料</Table.Th>
                        <Table.Th ta="center" w={160}>操作</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {pagedLines.map((line, index) => {
                        const isSelected = effectiveSelectedLineId === line.id;
                        const displayArea = effectiveAreaForLine(line);
                        const displayPerimeter = effectivePerimeterForLine(line);
                        return (
                          <Table.Tr
                            key={line.id}
                            bg={isSelected ? '#dbeafe' : undefined}
                            style={{
                              cursor: 'pointer',
                              boxShadow: isSelected ? 'inset 0 0 0 2px #2563eb' : undefined,
                            }}
                            onClick={() => setSelectedLineId(line.id)}
                          >
                            <Table.Td ta="center" onClick={(event) => event.stopPropagation()}>
                              <Checkbox
                                checked={selectedLineIds.includes(line.id)}
                                onChange={(event) => toggleCheckedLine(line.id, event.currentTarget.checked)}
                              />
                            </Table.Td>
                            <Table.Td onClick={(event) => event.stopPropagation()}>
                              <TextInput
                                value={line.sourceName}
                                onChange={(event) => updateLine(line.id, (current) => ({ ...current, sourceName: event.currentTarget.value }))}
                                placeholder={`明细 ${index + 1}`}
                                size="xs"
                              />
                            </Table.Td>
                            <Table.Td onClick={(event) => event.stopPropagation()}>
                              <Select
                                data={productOptions}
                                value={line.productId}
                                onChange={(value) => updateLine(line.id, (current) => ({ ...current, productId: value }))}
                                placeholder="选择组合"
                                searchable
                                size="xs"
                                comboboxProps={{ withinPortal: false }}
                                nothingFoundMessage="没有匹配组合"
                              />
                            </Table.Td>
                            <Table.Td onClick={(event) => event.stopPropagation()}>
                              <Select
                                data={[
                                  { value: 'rect', label: '矩形窗' },
                                  { value: 'triangle', label: '三角窗' },
                                  { value: 'trapezoid', label: '梯形窗' },
                                  { value: 'arch', label: '拱形窗' },
                                  { value: 'manual', label: '手动' },
                                ]}
                                value={line.shapeMode}
                                onChange={(value) => updateLine(line.id, (current) => ({ ...current, shapeMode: (value as QuoteLineDraft['shapeMode']) || 'rect' }))}
                                size="xs"
                                comboboxProps={{ withinPortal: false }}
                              />
                            </Table.Td>
                            <Table.Td ta="center" onClick={(event) => event.stopPropagation()}>
                              <NumberInput
                                value={line.width}
                                onChange={(value) => updateLine(line.id, (current) => ({ ...current, width: Number(value) || 0 }))}
                                min={1}
                                size="xs"
                                hideControls
                              />
                            </Table.Td>
                            <Table.Td ta="center" onClick={(event) => event.stopPropagation()}>
                              <NumberInput
                                value={line.height}
                                onChange={(value) => updateLine(line.id, (current) => ({ ...current, height: Number(value) || 0 }))}
                                min={1}
                                size="xs"
                                hideControls
                              />
                            </Table.Td>
                            <Table.Td ta="center" onClick={(event) => event.stopPropagation()}>
                              <NumberInput
                                value={line.quantity}
                                onChange={(value) => updateLine(line.id, (current) => ({ ...current, quantity: Number(value) || 1 }))}
                                min={1}
                                size="xs"
                                hideControls
                              />
                            </Table.Td>
                            <Table.Td onClick={(event) => event.stopPropagation()}>
                              <MultiSelect
                                data={rateOptions}
                                value={line.lineRateIds}
                                onChange={(value) => updateLine(line.id, (current) => ({ ...current, lineRateIds: value }))}
                                placeholder="费率"
                                size="xs"
                                comboboxProps={{ withinPortal: false }}
                              />
                            </Table.Td>
                            <Table.Td ta="center">
                              <Text size="sm">{displayArea.toFixed(3)}</Text>
                            </Table.Td>
                            <Table.Td ta="center">
                              <Text size="sm">{displayPerimeter.toFixed(3)}</Text>
                            </Table.Td>
                            <Table.Td ta="center">
                              <Button
                                size="compact-xs"
                                variant="subtle"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setSelectedLineId(line.id);
                                  setEditingMaterialsLineId(line.id);
                                }}
                              >
                                {line.extraMaterials.length} 项
                              </Button>
                            </Table.Td>
                            <Table.Td ta="center" onClick={(event) => event.stopPropagation()}>
                              <Group gap={6} justify="center" wrap="nowrap">
                                <Button
                                  size="compact-xs"
                                  variant="light"
                                  onClick={() => {
                                    setSelectedLineId(line.id);
                                    setDetailModalOpened(true);
                                  }}
                                >
                                  明细
                                </Button>
                                <Button
                                  size="compact-xs"
                                  variant="light"
                                  onClick={() => saveSingle(line.id)}
                                  loading={saveQuote.isPending && savingLineId === line.id}
                                >
                                  入库
                                </Button>
                                <ActionIcon
                                  color="red"
                                  variant="subtle"
                                  onClick={() => handleRemoveLine(line.id)}
                                >
                                  <IconTrash size={14} />
                                </ActionIcon>
                              </Group>
                            </Table.Td>
                          </Table.Tr>
                        );
                      })}
                    </Table.Tbody>
                  </Table>
                </Box>
              ) : (
                <Paper withBorder radius={12} p="lg" bg="var(--bg-subtle)">
                  <Text size="sm" c="dimmed">没有匹配的报价明细</Text>
                </Paper>
              )}
              {lineTotalPages > 1 ? (
                <Group justify="center">
                  <Pagination total={lineTotalPages} value={linePage} onChange={setLinePage} size="sm" radius="xl" />
                </Group>
              ) : null}
            </Stack>
          </Paper>

          <Paper withBorder radius={14} p="md">
            <Stack gap="md">
              <Group justify="space-between" wrap="wrap">
                <Title order={4}>汇总与结果</Title>
                {selectedLineDraft ? (
                  <Group gap="xs">
                    <Button size="compact-sm" variant="default" onClick={() => setEditingMaterialsLineId(selectedLineDraft.id)}>
                      编辑材料
                    </Button>
                    <Button size="compact-sm" variant="light" onClick={() => saveSingle(selectedLineDraft.id)} loading={saveQuote.isPending && savingLineId === selectedLineDraft.id}>
                      单独入库
                    </Button>
                  </Group>
                ) : null}
              </Group>

              {selectedLineDraft ? (
                <Paper withBorder radius={12} p="md" bg="var(--bg-subtle)">
                  <Group grow wrap="wrap">
                    <Box>
                      <Text size="sm" c="dimmed">当前明细</Text>
                      <Text fw={800} mt={4}>{selectedLineDraft.sourceName || '-'}</Text>
                    </Box>
                    <Box>
                      <Text size="sm" c="dimmed">组合</Text>
                      <Text fw={800} mt={4}>{selectedLineDraft.productId ? (productMap.get(selectedLineDraft.productId)?.name || '已选') : '未选择'}</Text>
                    </Box>
                    <Box>
                      <Text size="sm" c="dimmed">窗型</Text>
                      <Text fw={800} mt={4}>{shapeModeLabelMap[selectedLineDraft.shapeMode]}</Text>
                    </Box>
                  </Group>
                </Paper>
              ) : (
                <Paper withBorder radius={12} p="lg" bg="var(--bg-subtle)">
                  <Text size="sm" c="dimmed">左侧表格直接录入，右侧只保留汇总和项目结果。</Text>
                </Paper>
              )}

              <Paper withBorder radius={12} p="lg" bg="var(--bg-subtle)">
                <Stack gap="md">
                  <Box>
                    <Text size="sm" c="dimmed">销售总价</Text>
                    <Text fw={900} size="2rem" mt={6}>{currency(quoteSummary.retailTotal)}</Text>
                  </Box>
                  <Button
                    variant="default"
                    leftSection={<IconReceipt2 size={16} />}
                    onClick={() => setDetailModalOpened(true)}
                    disabled={quotePreview.items.length === 0}
                  >
                    组合数 {quoteSummary.comboCount}
                  </Button>
                  <Text size="sm" c="dimmed">点击查看每个组合的详细明细</Text>
                </Stack>
              </Paper>
            </Stack>
          </Paper>
        </Box>
      </Stack>
      <Modal
        opened={detailModalOpened}
        onClose={() => setDetailModalOpened(false)}
        title="组合详细明细"
        size="90%"
        centered
        fullScreen={isNarrowScreen}
      >
        <Box style={{ maxHeight: isNarrowScreen ? 'auto' : '78vh', overflow: 'auto', paddingRight: 4 }}>
          <Stack gap="md">
            {quotePreview.items.length === 0 ? (
              <Paper withBorder radius={12} p="xl" bg="var(--bg-subtle)" style={{ display: 'grid', placeItems: 'center' }}>
                <Stack gap="xs" align="center">
                  <IconReceipt2 size={28} color="#94a3b8" />
                  <Text c="dimmed">先为明细选择组合，才能看到组合详细明细。</Text>
                </Stack>
              </Paper>
            ) : (
              quotePreview.items.map((item) => (
                <Paper key={item.id} withBorder radius={12} p="md">
                  <Stack gap="sm">
                    <Group justify="space-between" align="flex-start" wrap="wrap">
                      <Box>
                        <Text fw={800}>{item.sourceName || item.productName || '未命名'}</Text>
                        <Text size="sm" c="dimmed" mt={4}>
                          {item.productName} / {item.width}×{item.height} / 数量 {item.quantity}
                        </Text>
                      </Box>
                      <Group gap="xs">
                        <Badge variant="light">窗型 {shapeModeLabelMap[item.shapeMode]}</Badge>
                        <Badge variant="light">销售 {currency(item.retailTotal)}</Badge>
                        <Badge variant="light">成本 {currency(item.costTotal)}</Badge>
                      </Group>
                    </Group>
                    <Group gap="xs" wrap="wrap">
                      <Badge variant="light">面积 {item.area.toFixed(3)} ㎡</Badge>
                      <Badge variant="light">周长 {item.perimeter.toFixed(3)} m</Badge>
                      <Badge variant="light">补充材料 {item.extraMaterials.length} 项</Badge>
                    </Group>
                    <Box style={{ overflowX: 'auto' }}>
                      <Table withTableBorder withColumnBorders striped>
                        <Table.Thead>
                          <Table.Tr>
                            <Table.Th w={260}>项目</Table.Th>
                            <Table.Th w={130}>分类</Table.Th>
                            <Table.Th w={110}>依据</Table.Th>
                            <Table.Th w={110}>数量</Table.Th>
                            <Table.Th w={80}>单位</Table.Th>
                            <Table.Th w={120}>成本单价</Table.Th>
                            <Table.Th w={120}>销售单价</Table.Th>
                            <Table.Th w={120}>成本小计</Table.Th>
                            <Table.Th w={120}>销售小计</Table.Th>
                          </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                          {item.details.map((detail, index) => (
                            <Table.Tr key={`${item.id}-${detail.name}-${index}`}>
                              <Table.Td><Text size="sm" truncate>{detail.name}</Text></Table.Td>
                              <Table.Td>{detail.categoryName || '-'}</Table.Td>
                              <Table.Td>{modeLabelMap[detail.basisMode || ''] || detail.basisMode || '-'}</Table.Td>
                              <Table.Td ta="right">{detail.quantity.toFixed(3)}</Table.Td>
                              <Table.Td ta="center">{detail.unit}</Table.Td>
                              <Table.Td ta="right">{currency(detail.costPrice)}</Table.Td>
                              <Table.Td ta="right">{currency(detail.retailPrice)}</Table.Td>
                              <Table.Td ta="right">{currency(detail.costSubtotal)}</Table.Td>
                              <Table.Td ta="right">{currency(detail.retailSubtotal)}</Table.Td>
                            </Table.Tr>
                          ))}
                        </Table.Tbody>
                      </Table>
                    </Box>
                  </Stack>
                </Paper>
              ))
            )}

            {quotePreview.details.some((detail) => detail.sourceType === 'global-rate') ? (
              <Paper withBorder radius={12} p="md" bg="var(--bg-subtle)">
                <Stack gap="sm">
                  <Text fw={700}>统一费率</Text>
                  <Table withTableBorder withColumnBorders>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>费率名称</Table.Th>
                        <Table.Th>百分比</Table.Th>
                        <Table.Th>成本增加</Table.Th>
                        <Table.Th>销售增加</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {quotePreview.details.filter((detail) => detail.sourceType === 'global-rate').map((detail, index) => (
                        <Table.Tr key={`${detail.name}-${index}`}>
                          <Table.Td>{detail.name}</Table.Td>
                          <Table.Td>{detail.quantity.toFixed(2)}%</Table.Td>
                          <Table.Td>{currency(detail.costSubtotal)}</Table.Td>
                          <Table.Td>{currency(detail.retailSubtotal)}</Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </Stack>
              </Paper>
            ) : null}
          </Stack>
        </Box>
      </Modal>

      <Modal
        opened={!!editingMaterialsLine}
        onClose={() => setEditingMaterialsLineId(null)}
        title="编辑补充材料"
        size="xl"
        centered
      >
        {editingMaterialsLine ? (
          <Stack gap="md">
            <Group justify="space-between" align="flex-start">
              <Box>
                <Text fw={700}>{editingMaterialsLine.sourceName || '当前明细'}</Text>
              </Box>
              <Button
                size="compact-sm"
                variant="default"
                onClick={() => updateLine(editingMaterialsLine.id, (current) => ({ ...current, extraMaterials: [...current.extraMaterials, emptyExtraMaterial()] }))}
              >
                添加材料
              </Button>
            </Group>

            {editingMaterialsLine.extraMaterials.length === 0 ? (
              <Paper withBorder radius={12} p="lg" bg="var(--bg-subtle)">
                <Text size="sm" c="dimmed">当前没有补充材料</Text>
              </Paper>
            ) : (
              <Table withTableBorder withColumnBorders>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>分类</Table.Th>
                    <Table.Th>材料</Table.Th>
                    <Table.Th>倍率</Table.Th>
                    <Table.Th>方式</Table.Th>
                    <Table.Th></Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {editingMaterialsLine.extraMaterials.map((extra) => {
                    const materialOptions = (extra.categoryId ? materialsByCategory.get(extra.categoryId) || [] : [])
                      .map((material) => ({ value: material.id || '', label: material.name }));
                    const selectedMaterial = extra.materialId ? materials.find((item) => item.id === extra.materialId) || null : null;
                    return (
                      <Table.Tr key={extra.id}>
                        <Table.Td>
                          <Select
                            data={categoryOptions}
                            value={extra.categoryId}
                            onChange={(value) => updateLine(editingMaterialsLine.id, (current) => ({
                              ...current,
                              extraMaterials: current.extraMaterials.map((item) => (
                                item.id === extra.id
                                  ? { ...item, categoryId: value, materialId: null }
                                  : item
                              )),
                            }))}
                            searchable
                            placeholder="选分类"
                          />
                        </Table.Td>
                        <Table.Td>
                          <Select
                            data={materialOptions}
                            value={extra.materialId}
                            onChange={(value) => updateLine(editingMaterialsLine.id, (current) => ({
                              ...current,
                              extraMaterials: current.extraMaterials.map((item) => (
                                item.id === extra.id
                                  ? { ...item, materialId: value }
                                  : item
                              )),
                            }))}
                            searchable
                            placeholder="选材料"
                            disabled={!extra.categoryId}
                          />
                        </Table.Td>
                        <Table.Td>
                          <NumberInput
                            value={extra.quantity}
                            min={0}
                            step={0.1}
                            decimalScale={2}
                            onChange={(value) => updateLine(editingMaterialsLine.id, (current) => ({
                              ...current,
                              extraMaterials: current.extraMaterials.map((item) => (
                                item.id === extra.id
                                  ? { ...item, quantity: Number(value) || 0 }
                                  : item
                              )),
                            }))}
                          />
                        </Table.Td>
                        <Table.Td>{selectedMaterial ? modeLabelMap[selectedMaterial.unitType] || selectedMaterial.unitType : '-'}</Table.Td>
                        <Table.Td>
                          <ActionIcon
                            color="red"
                            variant="subtle"
                            onClick={() => updateLine(editingMaterialsLine.id, (current) => ({
                              ...current,
                              extraMaterials: current.extraMaterials.filter((item) => item.id !== extra.id),
                            }))}
                          >
                            <IconTrash size={16} />
                          </ActionIcon>
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
            )}
          </Stack>
        ) : null}
      </Modal>
    </PageScaffold>
  );
};

export default PricingPage;
