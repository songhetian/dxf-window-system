import React, { useEffect, useState, useMemo } from 'react';
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Card,
  Center,
  Checkbox,
  Group,
  Modal,
  NumberInput,
  Paper,
  ScrollArea,
  Select,
  SimpleGrid,
  Stack,
  Table,
  ThemeIcon,
  Text,
  TextInput,
  Title,
  Tabs,
  Divider,
  SegmentedControl,
} from '@mantine/core';
import {
  IconBuilding,
  IconChartBar,
  IconChevronRight,
  IconChevronDown,
  IconX,
  IconPlus,
  IconSearch,
  IconTrash,
  IconLayoutGrid,
  IconBuildingCommunity,
  IconGripVertical,
  IconTableExport,
  IconReportMoney,
  IconRuler2,
  IconStack2,
  IconSortDescending,
  IconTag,
  IconTrendingUp,
  IconRosetteDiscountCheck,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';

import { PageScaffold } from '../components/ui/PageScaffold';
import { EmptyPane } from '../components/ui/FeedbackPane';
import { QuotationProjectListPanel } from '../features/quotation/QuotationProjectListPanel';
import { QuotationInsightsPanel } from '../features/quotation/QuotationInsightsPanel';
import { QuotationRatePanel } from '../features/quotation/QuotationRatePanel';
import { QuotationSheetDetailModal } from '../features/quotation/QuotationSheetDetailModal';
import { QuotationSheetsPanel } from '../features/quotation/QuotationSheetsPanel';
import { QuotationStatsCards } from '../features/quotation/QuotationStatsCards';
import {
  useMaterials,
  usePricingRates,
  usePricingProducts,
  useQuotationProjects,
  useQuotationProject,
  useCreateQuotationProject,
  useDeleteQuotationProject,
  useUpdateQuotationProject,
  useDrawingRecord,
  useDeleteDrawingRecord,
  useDrawingRecordsDetails,
  useUpdateDrawingRecord,
} from '../hooks/useWindowApi';

type BreakdownBucket = 'profile' | 'glass' | 'hardware' | 'accessory';
type AppliedRateSetting = { rateId: string; name: string; percentage: number; enabled: boolean };
type ExportOptions = { includeReviewSheet: boolean; includeUsedProductSheets: boolean; includeEngineeringSheets: boolean };

const breakdownBucketMeta: Record<BreakdownBucket, { label: string; color: string }> = {
  profile: { label: '主材型材', color: 'teal' },
  glass: { label: '玻璃面材', color: 'cyan' },
  hardware: { label: '五金配件', color: 'orange' },
  accessory: { label: '辅材工艺', color: 'grape' },
};

const detectBreakdownBucket = (materialName: string, categoryName?: string) => {
  const text = `${categoryName || ''} ${materialName}`.toLowerCase();
  if (/(玻璃|中空|夹胶|钢化|百叶|面板|板材)/.test(text)) return 'glass';
  if (/(五金|锁|执手|合页|铰链|滑轮|地弹簧|闭门器)/.test(text)) return 'hardware';
  if (/(型材|边框|框料|扇料|铝材|钢材|立柱|横梁)/.test(text)) return 'profile';
  return 'accessory';
};

const parseRateSettings = (raw: unknown): AppliedRateSetting[] => {
  if (!raw) return [];
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Array.isArray(parsed) ? parsed.map((item: any) => ({
      rateId: String(item.rateId || ''),
      name: String(item.name || ''),
      percentage: Number(item.percentage || 0),
      enabled: Boolean(item.enabled),
    })).filter((item) => item.rateId) : [];
  } catch {
    return [];
  }
};

const mergeRateSettings = (templates: any[], current: AppliedRateSetting[]) => {
  const currentMap = new Map(current.map((item) => [item.rateId, item]));
  return templates.map((rate: any) => ({
    rateId: rate.id || '',
    name: rate.name,
    percentage: currentMap.get(rate.id || '')?.percentage ?? Number(rate.percentage || 0),
    enabled: currentMap.get(rate.id || '')?.enabled ?? Boolean(rate.isActive),
  }));
};

const summarizeEnabledRates = (rates: AppliedRateSetting[]) => {
  const enabled = rates.filter((item) => item.enabled);
  return {
    text: enabled.length > 0 ? enabled.map((item) => `${item.name} ${item.percentage}%`).join('、') : '未启用',
    totalPercentage: enabled.reduce((sum, item) => sum + Number(item.percentage || 0), 0),
  };
};

const sameRateSettings = (left: AppliedRateSetting[], right: AppliedRateSetting[]) => (
  left.length === right.length
  && left.every((item, index) => (
    item.rateId === right[index]?.rateId
    && item.name === right[index]?.name
    && Number(item.percentage || 0) === Number(right[index]?.percentage || 0)
    && item.enabled === right[index]?.enabled
  ))
);

const sameStringArray = (left: string[], right: string[]) => (
  left.length === right.length
  && left.every((item, index) => item === right[index])
);

const loadExcelExportUtils = async () => await import('../utils/excelExport');

const QuotationPage = () => {
  const { data: projects = [] } = useQuotationProjects();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data: project } = useQuotationProject(selectedId);
  
  const { data: materials = [] } = useMaterials();
  const { data: rateTemplates = [] } = usePricingRates();
  const { data: products = [] } = usePricingProducts();

  const createProject = useCreateQuotationProject();
  const deleteProject = useDeleteQuotationProject();
  const updateProject = useUpdateQuotationProject();
  const deleteDrawingRecord = useDeleteDrawingRecord();
  const updateDrawingRecord = useUpdateDrawingRecord();

  const [projectSearch, setProjectSearch] = useState('');
  const [newProjectModal, setNewProjectModal] = useState(false);
  const [selectedSheetId, setSelectedSheetId] = useState<string | null>(null);
  const [sheetDetailOpened, setSheetDetailOpened] = useState(false);
  const [exportModalOpened, setExportModalOpened] = useState(false);
  const [rateScope, setRateScope] = useState<'project' | 'sheet'>('project');
  const [sheetSort, setSheetSort] = useState<'custom' | 'created_desc' | 'created_asc' | 'name_asc' | 'cost_desc'>('custom');
  const [breakdownView, setBreakdownView] = useState<'project' | 'sheet'>('project');
  const [sheetDetailFilter, setSheetDetailFilter] = useState<string>('all');
  const [sheetDetailSearch, setSheetDetailSearch] = useState('');
  const [sheetDetailView, setSheetDetailView] = useState<'table' | 'grouped'>('grouped');
  const [expandedTypeGroups, setExpandedTypeGroups] = useState<string[]>([]);
  const [draggingSheetId, setDraggingSheetId] = useState<string | null>(null);
  const [sheetOrder, setSheetOrder] = useState<string[]>([]);
  const { data: sheetDetail } = useDrawingRecord(selectedSheetId);
  const sheetDetailQueries = useDrawingRecordsDetails((project?.sheets || []).map((sheet: any) => sheet.id).filter(Boolean));

  const [projectForm, setProjectForm] = useState({ name: '', buildingName: '', isCompleted: 0 });
  const [quoteFactor, setQuoteFactor] = useState<number>(1);
  const [discountRate, setDiscountRate] = useState<number>(0);
  const [projectRateSettings, setProjectRateSettings] = useState<AppliedRateSetting[]>([]);
  const [sheetRateSettings, setSheetRateSettings] = useState<AppliedRateSetting[]>([]);
  const [selectedBreakdownBucket, setSelectedBreakdownBucket] = useState<BreakdownBucket | null>(null);
  const [breakdownDetailsOpen, setBreakdownDetailsOpen] = useState(true);
  const [selectedConfigName, setSelectedConfigName] = useState<string | null>(null);
  const [configSourcesOpen, setConfigSourcesOpen] = useState(true);
  const [configSourceSheetFilter, setConfigSourceSheetFilter] = useState<string>('all');
  const [configSourceTypeFilter, setConfigSourceTypeFilter] = useState<string>('all');
  const [configSourceSort, setConfigSourceSort] = useState<'cost_desc' | 'quantity_desc' | 'sheet_asc'>('cost_desc');
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    includeReviewSheet: true,
    includeUsedProductSheets: true,
    includeEngineeringSheets: true,
  });

  const filteredProjects = projects.filter(p => 
    p.name.toLowerCase().includes(projectSearch.toLowerCase())
  );

  const projectStats = useMemo(() => {
    if (!project) return null;
    const sheetQuantity = (project.sheets || []).reduce((sum: number, item: any) => sum + Number(item.itemCount || 0), 0);
    const sheetArea = (project.sheets || []).reduce((sum: number, item: any) => sum + Number(item.totalArea || 0), 0);
    const sheetCost = (project.sheets || []).reduce((sum: number, item: any) => sum + Number(item.totalCost || 0), 0);
    const sheetRetail = (project.sheets || []).reduce((sum: number, item: any) => sum + Number(item.totalRetail || 0), 0);

    return {
      sheetCount: project.sheets?.length || 0,
      itemCount: sheetQuantity,
      totalArea: sheetArea,
      totalCost: sheetCost,
      totalRetail: sheetRetail,
    };
  }, [project]);

  const selectedSheetSummary = useMemo(
    () => (project?.sheets || []).find((sheet: any) => sheet.id === selectedSheetId) || null,
    [project?.sheets, selectedSheetId],
  );

  useEffect(() => {
    if (!project?.id) {
      setQuoteFactor(1);
      setDiscountRate(0);
      return;
    }
    try {
      const stored = JSON.parse(window.localStorage.getItem(`quotation-settings:${project.id}`) || '{}');
      setQuoteFactor(typeof stored.quoteFactor === 'number' && Number.isFinite(stored.quoteFactor) ? stored.quoteFactor : 1);
      setDiscountRate(typeof stored.discountRate === 'number' && Number.isFinite(stored.discountRate) ? stored.discountRate : 0);
    } catch {
      setQuoteFactor(1);
      setDiscountRate(0);
    }
  }, [project?.id]);

  useEffect(() => {
    if (!project?.id) return;
    window.localStorage.setItem(
      `quotation-settings:${project.id}`,
      JSON.stringify({ quoteFactor, discountRate }),
    );
  }, [discountRate, project?.id, quoteFactor]);

  useEffect(() => {
    const nextSettings = !project
      ? []
      : mergeRateSettings(rateTemplates, parseRateSettings((project as any).rateSettings));

    setProjectRateSettings((current) => (
      sameRateSettings(current, nextSettings) ? current : nextSettings
    ));
  }, [project, rateTemplates]);

  useEffect(() => {
    const nextSettings = !selectedSheetSummary
      ? mergeRateSettings(rateTemplates, [])
      : mergeRateSettings(rateTemplates, parseRateSettings((selectedSheetSummary as any).rateSettings));

    setSheetRateSettings((current) => (
      sameRateSettings(current, nextSettings) ? current : nextSettings
    ));
  }, [rateTemplates, selectedSheetSummary]);

  const quoteSummary = useMemo(() => {
    if (!projectStats) return null;
    const totalCost = Number(projectStats.totalCost || 0);
    const projectRates = mergeRateSettings(rateTemplates, parseRateSettings((project as any)?.rateSettings));
    const sheetSummaries = (project?.sheets || []).map((sheet: any) => {
      const baseRetail = Number(sheet.totalRetail || 0);
      const effectiveRates = (() => {
        const raw = parseRateSettings(sheet.rateSettings);
        return raw.length > 0 ? mergeRateSettings(rateTemplates, raw) : projectRates;
      })();
      const ratePercent = effectiveRates.filter((rate) => rate.enabled).reduce((sum, rate) => sum + Number(rate.percentage || 0), 0);
      const adjustedRetail = baseRetail * quoteFactor;
      const rateAmount = adjustedRetail * (ratePercent / 100);
      const quoteBeforeDiscount = adjustedRetail + rateAmount;
      const finalSheetQuote = quoteBeforeDiscount * (1 - discountRate / 100);
      return { adjustedRetail, rateAmount, finalSheetQuote };
    });
    const baseRetail = Number(projectStats.totalRetail || 0);
    const adjustedRetail = sheetSummaries.reduce((sum, item) => sum + item.adjustedRetail, 0);
    const totalRateAmount = sheetSummaries.reduce((sum, item) => sum + item.rateAmount, 0);
    const finalQuote = sheetSummaries.reduce((sum, item) => sum + item.finalSheetQuote, 0);
    const grossProfit = finalQuote - totalCost;
    const grossMargin = finalQuote > 0 ? (grossProfit / finalQuote) * 100 : 0;
    const quotePerSqm = projectStats.totalArea > 0 ? finalQuote / projectStats.totalArea : 0;
    const costPerSqm = projectStats.totalArea > 0 ? totalCost / projectStats.totalArea : 0;

    return {
      baseRetail,
      adjustedRetail,
      totalRateAmount,
      finalQuote,
      grossProfit,
      grossMargin,
      quotePerSqm,
      costPerSqm,
    };
  }, [discountRate, project, projectStats, quoteFactor, rateTemplates]);

  const projectBreakdownData = useMemo(() => {
    const totals = {
      profile: { cost: 0, retail: 0 },
      glass: { cost: 0, retail: 0 },
      hardware: { cost: 0, retail: 0 },
      accessory: { cost: 0, retail: 0 },
    } satisfies Record<BreakdownBucket, { cost: number; retail: number }>;
    const detailMap = {
      profile: new Map<string, { name: string; cost: number; retail: number }>(),
      glass: new Map<string, { name: string; cost: number; retail: number }>(),
      hardware: new Map<string, { name: string; cost: number; retail: number }>(),
      accessory: new Map<string, { name: string; cost: number; retail: number }>(),
    } satisfies Record<BreakdownBucket, Map<string, { name: string; cost: number; retail: number }>>;

    sheetDetailQueries.forEach((query) => {
      const record = query.data;
      if (!record?.items) return;
      record.items.forEach((item: any) => {
        const area = Number(item.area || item.calculatedArea || 0) || (Number(item.width || 0) * Number(item.height || 0)) / 1000000;
        const quantity = Number(item.quantity || 0);
        const itemDetails = [
          ...(Array.isArray(item.compDetails) ? item.compDetails : []),
          ...(Array.isArray(item.accDetails) ? item.accDetails : []),
        ];

        itemDetails.forEach((detail: any) => {
          const bucket = detectBreakdownBucket(String(detail.name || ''));
          const totalCost = Number(detail.cost || 0) * area * quantity;
          const totalRetail = Number(detail.retail || 0) * area * quantity;
          totals[bucket].cost += totalCost;
          totals[bucket].retail += totalRetail;
          const current = detailMap[bucket].get(String(detail.name || '')) || { name: String(detail.name || '未命名'), cost: 0, retail: 0 };
          current.cost += totalCost;
          current.retail += totalRetail;
          detailMap[bucket].set(String(detail.name || ''), current);
        });
      });
    });

    return {
      summary: (Object.keys(totals) as BreakdownBucket[]).map((key) => ({
        key,
        label: breakdownBucketMeta[key].label,
        color: breakdownBucketMeta[key].color,
        cost: totals[key].cost,
        retail: totals[key].retail,
      })),
      details: Object.fromEntries(
        (Object.keys(detailMap) as BreakdownBucket[]).map((key) => [
          key,
          Array.from(detailMap[key].values()).sort((a, b) => b.cost - a.cost),
        ]),
      ) as Record<BreakdownBucket, Array<{ name: string; cost: number; retail: number }>>,
    };
  }, [sheetDetailQueries]);

  const breakdownHasData = projectBreakdownData.summary.some((item) => item.cost > 0 || item.retail > 0);

  const breakdownSummary = useMemo(() => {
    if (!projectStats) return [];
    const totalCost = Number(projectStats.totalCost || 0);
    const totalRetail = Number(projectStats.totalRetail || 0);
    const totalArea = Number(projectStats.totalArea || 0);

    return projectBreakdownData.summary.map((item) => ({
      ...item,
      costShare: totalCost > 0 ? (item.cost / totalCost) * 100 : 0,
      retailShare: totalRetail > 0 ? (item.retail / totalRetail) * 100 : 0,
      costPerSqm: totalArea > 0 ? item.cost / totalArea : 0,
      retailPerSqm: totalArea > 0 ? item.retail / totalArea : 0,
    })).sort((a, b) => b.cost - a.cost);
  }, [projectBreakdownData.summary, projectStats]);

  const topCostSheets = useMemo(() => (
    [...(project?.sheets || [])]
      .sort((a: any, b: any) => Number(b.totalCost || 0) - Number(a.totalCost || 0))
      .slice(0, 3)
      .map((sheet: any) => ({
        ...sheet,
        costShare: Number(projectStats?.totalCost || 0) > 0 ? (Number(sheet.totalCost || 0) / Number(projectStats?.totalCost || 0)) * 100 : 0,
        grossMargin: Number(sheet.totalRetail || 0) > 0
          ? ((Number(sheet.totalRetail || 0) - Number(sheet.totalCost || 0)) / Number(sheet.totalRetail || 0)) * 100
          : 0,
      }))
  ), [project?.sheets, projectStats?.totalCost]);

  useEffect(() => {
    if (!project?.id) {
      setSheetOrder((current) => (current.length === 0 ? current : []));
      return;
    }
    const ids = (project.sheets || []).map((sheet: any) => sheet.id).filter(Boolean);
    const storageKey = `quotation-sheet-order:${project.id}`;
    try {
      const stored = JSON.parse(window.localStorage.getItem(storageKey) || '[]');
      if (Array.isArray(stored) && stored.length > 0) {
        const merged = [...stored.filter((id: string) => ids.includes(id)), ...ids.filter((id: string) => !stored.includes(id))];
        setSheetOrder((current) => (sameStringArray(current, merged) ? current : merged));
        return;
      }
    } catch (error) {
      console.warn('failed to read stored sheet order', error);
    }
    setSheetOrder((current) => (sameStringArray(current, ids) ? current : ids));
  }, [project?.id, project?.sheets]);

  useEffect(() => {
    if (!project?.id || sheetOrder.length === 0) return;
    try {
      window.localStorage.setItem(`quotation-sheet-order:${project.id}`, JSON.stringify(sheetOrder));
    } catch (error) {
      console.warn('failed to persist sheet order', error);
    }
  }, [project?.id, sheetOrder]);

  const sortedSheets = useMemo(() => {
    const sheets = [...(project?.sheets || [])];
    if (sheetSort === 'custom') {
      const orderMap = new Map(sheetOrder.map((id, index) => [id, index]));
      return sheets.sort((a: any, b: any) => {
        const aIndex = orderMap.get(a.id) ?? Number.MAX_SAFE_INTEGER;
        const bIndex = orderMap.get(b.id) ?? Number.MAX_SAFE_INTEGER;
        return aIndex - bIndex;
      });
    }
    if (sheetSort === 'created_asc') {
      return sheets.sort((a: any, b: any) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
    }
    if (sheetSort === 'name_asc') {
      return sheets.sort((a: any, b: any) => String(a.sheetName || '').localeCompare(String(b.sheetName || ''), 'zh-CN'));
    }
    if (sheetSort === 'cost_desc') {
      return sheets.sort((a: any, b: any) => Number(b.totalCost || 0) - Number(a.totalCost || 0));
    }
    return sheets.sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  }, [project?.sheets, sheetSort, sheetOrder]);

  const sheetAllocationSummary = useMemo(() => {
    if (!sheetDetail?.items) return [] as Array<{ label: string; quantity: number }>;
    const counts = new Map<string, number>();
    sheetDetail.items.forEach((item: any) => {
      (item.allocations || []).forEach((allocation: any) => {
        const label = allocation.label || '默认';
        counts.set(label, (counts.get(label) || 0) + Number(allocation.quantity || 0));
      });
    });
    return Array.from(counts.entries())
      .map(([label, quantity]) => ({ label, quantity }))
      .sort((a, b) => b.quantity - a.quantity);
  }, [sheetDetail]);

  const filteredSheetItems = useMemo(() => {
    if (!sheetDetail?.items) return [];
    return sheetDetail.items.filter((item: any) => {
      const matchesAllocation = sheetDetailFilter === 'all'
        ? true
        : (item.allocations || []).some((allocation: any) => allocation.label === sheetDetailFilter);
      const keyword = sheetDetailSearch.trim().toLowerCase();
      const matchesSearch = keyword
        ? String(item.designNumber || '').toLowerCase().includes(keyword)
        : true;
      return matchesAllocation && matchesSearch;
    });
  }, [sheetDetail, sheetDetailFilter, sheetDetailSearch]);

  const groupedSheetItems = useMemo(() => {
    const groups = new Map<string, any[]>();
    filteredSheetItems.forEach((item: any) => {
      const key = item.windowType || '未分类';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(item);
    });
    return Array.from(groups.entries()).map(([type, items]) => ({
      type,
      items,
      quantity: items.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
      totalCost: items.reduce((sum, item) => sum + Number(item.totalPrice || 0), 0),
    }));
  }, [filteredSheetItems]);

  const sheetBreakdownData = useMemo(() => {
    if (!sheetDetail?.items) {
      return {
        summary: [] as Array<{ key: BreakdownBucket; label: string; color: string; cost: number; retail: number; costShare: number; costPerSqm: number }>,
        details: { profile: [], glass: [], hardware: [], accessory: [] } as Record<BreakdownBucket, Array<{ name: string; cost: number; retail: number }>>,
      };
    }
    const totals = {
      profile: { cost: 0, retail: 0 },
      glass: { cost: 0, retail: 0 },
      hardware: { cost: 0, retail: 0 },
      accessory: { cost: 0, retail: 0 },
    } satisfies Record<BreakdownBucket, { cost: number; retail: number }>;
    const detailMap = {
      profile: new Map<string, { name: string; cost: number; retail: number }>(),
      glass: new Map<string, { name: string; cost: number; retail: number }>(),
      hardware: new Map<string, { name: string; cost: number; retail: number }>(),
      accessory: new Map<string, { name: string; cost: number; retail: number }>(),
    } satisfies Record<BreakdownBucket, Map<string, { name: string; cost: number; retail: number }>>;

    sheetDetail.items.forEach((item: any) => {
      const area = Number(item.area || item.calculatedArea || 0) || (Number(item.width || 0) * Number(item.height || 0)) / 1000000;
      const quantity = Number(item.quantity || 0);
      const itemDetails = [
        ...(Array.isArray(item.compDetails) ? item.compDetails : []),
        ...(Array.isArray(item.accDetails) ? item.accDetails : []),
      ];

      itemDetails.forEach((detail: any) => {
        const bucket = detectBreakdownBucket(String(detail.name || ''));
        const totalCost = Number(detail.cost || 0) * area * quantity;
        const totalRetail = Number(detail.retail || 0) * area * quantity;
        totals[bucket].cost += totalCost;
        totals[bucket].retail += totalRetail;
        const current = detailMap[bucket].get(String(detail.name || '')) || { name: String(detail.name || '未命名'), cost: 0, retail: 0 };
        current.cost += totalCost;
        current.retail += totalRetail;
        detailMap[bucket].set(String(detail.name || ''), current);
      });
    });

    const totalCost = Number(sheetDetail.totalCost || 0);
    const totalArea = Number(sheetDetail.totalArea || 0);
    return {
      summary: (Object.keys(totals) as BreakdownBucket[])
        .map((key) => ({
          key,
          label: breakdownBucketMeta[key].label,
          color: breakdownBucketMeta[key].color,
          cost: totals[key].cost,
          retail: totals[key].retail,
          costShare: totalCost > 0 ? (totals[key].cost / totalCost) * 100 : 0,
          costPerSqm: totalArea > 0 ? totals[key].cost / totalArea : 0,
        }))
        .sort((a, b) => b.cost - a.cost),
      details: Object.fromEntries(
        (Object.keys(detailMap) as BreakdownBucket[]).map((key) => [
          key,
          Array.from(detailMap[key].values()).sort((a, b) => b.cost - a.cost),
        ]),
      ) as Record<BreakdownBucket, Array<{ name: string; cost: number; retail: number }>>,
    };
  }, [sheetDetail]);

  const topWindowItems = useMemo(() => (
    [...filteredSheetItems]
      .sort((a: any, b: any) => Number(b.totalPrice || 0) - Number(a.totalPrice || 0))
      .slice(0, 3)
      .map((item: any) => ({
        ...item,
        costShare: Number(sheetDetail?.totalCost || 0) > 0 ? (Number(item.totalPrice || 0) / Number(sheetDetail?.totalCost || 0)) * 100 : 0,
      }))
  ), [filteredSheetItems, sheetDetail?.totalCost]);

  const topProductsInSheet = useMemo(() => {
    const grouped = new Map<string, { name: string; count: number; cost: number; retail: number }>();
    filteredSheetItems.forEach((item: any) => {
      const key = String(item.productId || item.productName || '未选组合');
      const current = grouped.get(key) || {
        name: item.productName || '未选组合',
        count: 0,
        cost: 0,
        retail: 0,
      };
      current.count += Number(item.quantity || 0);
      current.cost += Number(item.totalPrice || 0);
      current.retail += Number(item.totalRetailPrice || 0);
      grouped.set(key, current);
    });
    return Array.from(grouped.values()).sort((a, b) => b.cost - a.cost).slice(0, 5);
  }, [filteredSheetItems]);

  const currentBreakdownSummary = breakdownView === 'sheet' ? sheetBreakdownData.summary : breakdownSummary;
  const currentBreakdownDetails = breakdownView === 'sheet' ? sheetBreakdownData.details : projectBreakdownData.details;
  const currentBreakdownTitle = breakdownView === 'sheet'
    ? `工作表占比${selectedSheetSummary ? ` · ${selectedSheetSummary.sheetName}` : ''}`
    : '项目总占比';
  const currentBreakdownHint = breakdownView === 'sheet'
    ? '点击工作表卡片即可切换到单张工作表的成本构成。'
    : '这里展示整个项目的成本构成汇总。';
  const selectedBreakdownTotalCost = selectedBreakdownBucket
    ? currentBreakdownSummary.find((item: any) => item.key === selectedBreakdownBucket)?.cost || 0
    : 0;
  const currentBreakdownTotalCost = currentBreakdownSummary.reduce((sum: number, item: any) => sum + Number(item.cost || 0), 0);
  const selectedBreakdownItems = selectedBreakdownBucket
    ? (currentBreakdownDetails[selectedBreakdownBucket] || []).map((item: any) => ({
        ...item,
        share: selectedBreakdownTotalCost > 0 ? (Number(item.cost || 0) / selectedBreakdownTotalCost) * 100 : 0,
        overallShare: currentBreakdownTotalCost > 0 ? (Number(item.cost || 0) / currentBreakdownTotalCost) * 100 : 0,
      }))
    : [];
  const selectedConfigSources = useMemo(() => {
    if (!selectedBreakdownBucket || !selectedConfigName) return [];
    const sourceMap = new Map<string, { sheetName: string; designNumber: string; windowType: string; quantity: number; cost: number; retail: number }>();
    const records = breakdownView === 'sheet'
      ? (sheetDetail ? [{ sheetName: sheetDetail.sheetName || selectedSheetSummary?.sheetName || '当前工作表', items: sheetDetail.items || [] }] : [])
      : sheetDetailQueries.map((query) => query.data).filter(Boolean).map((record: any) => ({
          sheetName: record.sheetName || '未命名工作表',
          items: record.items || [],
        }));

    records.forEach((record: any) => {
      (record.items || []).forEach((item: any) => {
        const area = Number(item.area || item.calculatedArea || 0) || (Number(item.width || 0) * Number(item.height || 0)) / 1000000;
        const quantity = Number(item.quantity || 0);
        const details = [
          ...(Array.isArray(item.compDetails) ? item.compDetails : []),
          ...(Array.isArray(item.accDetails) ? item.accDetails : []),
        ];
        details.forEach((detail: any) => {
          const bucket = detectBreakdownBucket(String(detail.name || ''));
          if (bucket !== selectedBreakdownBucket || String(detail.name || '') !== selectedConfigName) return;
          const key = `${record.sheetName}::${item.designNumber || '未命名'}::${item.windowType || '未分类'}`;
          const current = sourceMap.get(key) || {
            sheetName: record.sheetName || '未命名工作表',
            designNumber: item.designNumber || '未命名',
            windowType: item.windowType || '未分类',
            quantity: 0,
            cost: 0,
            retail: 0,
          };
          current.quantity += quantity;
          current.cost += Number(detail.cost || 0) * area * quantity;
          current.retail += Number(detail.retail || 0) * area * quantity;
          sourceMap.set(key, current);
        });
      });
    });

    const totalCost = Array.from(sourceMap.values()).reduce((sum, item) => sum + item.cost, 0);
    return Array.from(sourceMap.values())
      .sort((a, b) => b.cost - a.cost)
      .map((item) => ({
        ...item,
        share: totalCost > 0 ? (item.cost / totalCost) * 100 : 0,
      }));
  }, [breakdownView, selectedBreakdownBucket, selectedConfigName, selectedSheetSummary?.sheetName, sheetDetail, sheetDetailQueries]);
  const configSourceSheetOptions = useMemo(() => (
    ['all', ...Array.from(new Set(selectedConfigSources.map((item) => item.sheetName)))]
      .map((value) => ({ value, label: value === 'all' ? '全部工作表' : value }))
  ), [selectedConfigSources]);
  const configSourceTypeOptions = useMemo(() => (
    ['all', ...Array.from(new Set(selectedConfigSources.map((item) => item.windowType)))]
      .map((value) => ({ value, label: value === 'all' ? '全部窗型' : value }))
  ), [selectedConfigSources]);
  const visibleConfigSources = useMemo(() => {
    const filtered = selectedConfigSources.filter((item) => (
      (configSourceSheetFilter === 'all' || item.sheetName === configSourceSheetFilter)
      && (configSourceTypeFilter === 'all' || item.windowType === configSourceTypeFilter)
    ));
    if (configSourceSort === 'quantity_desc') {
      return [...filtered].sort((a, b) => b.quantity - a.quantity);
    }
    if (configSourceSort === 'sheet_asc') {
      return [...filtered].sort((a, b) => {
        const sheetCompare = a.sheetName.localeCompare(b.sheetName, 'zh-CN');
        if (sheetCompare !== 0) return sheetCompare;
        return a.designNumber.localeCompare(b.designNumber, 'zh-CN');
      });
    }
    return [...filtered].sort((a, b) => b.cost - a.cost);
  }, [configSourceSheetFilter, configSourceSort, configSourceTypeFilter, selectedConfigSources]);

  useEffect(() => {
    if (currentBreakdownSummary.length === 0) {
      setSelectedBreakdownBucket(null);
      return;
    }
    if (!selectedBreakdownBucket || !currentBreakdownSummary.some((item: any) => item.key === selectedBreakdownBucket)) {
      setSelectedBreakdownBucket(currentBreakdownSummary[0].key);
      setBreakdownDetailsOpen(true);
    }
  }, [currentBreakdownSummary, selectedBreakdownBucket]);

  useEffect(() => {
    if (selectedBreakdownItems.length === 0) {
      setSelectedConfigName(null);
      return;
    }
    if (!selectedConfigName || !selectedBreakdownItems.some((item: any) => item.name === selectedConfigName)) {
      setSelectedConfigName(selectedBreakdownItems[0].name);
      setConfigSourcesOpen(true);
    }
  }, [selectedBreakdownItems, selectedConfigName]);

  useEffect(() => {
    setConfigSourceSheetFilter('all');
    setConfigSourceTypeFilter('all');
    setConfigSourceSort('cost_desc');
  }, [selectedConfigName, breakdownView, selectedBreakdownBucket]);

  const currentRateSettings = rateScope === 'sheet' ? sheetRateSettings : projectRateSettings;
  const currentRateTitle = rateScope === 'sheet'
    ? `工作表费率${selectedSheetSummary ? ` · ${selectedSheetSummary.sheetName}` : ''}`
    : '项目整体费率';
  const enabledProjectRates = projectRateSettings.filter((item) => item.enabled);
  const enabledSheetRates = sheetRateSettings.filter((item) => item.enabled);
  const projectRateSummary = summarizeEnabledRates(projectRateSettings);
  const sheetRateSummary = summarizeEnabledRates(sheetRateSettings);
  const sheetRateMetaMap = useMemo(() => {
    const projectMerged = mergeRateSettings(rateTemplates, parseRateSettings((project as any)?.rateSettings));
    return new Map(
      (project?.sheets || []).map((sheet: any) => {
        const raw = parseRateSettings(sheet.rateSettings);
        const effectiveRates = raw.length > 0 ? mergeRateSettings(rateTemplates, raw) : projectMerged;
        const summary = summarizeEnabledRates(effectiveRates);
        return [
          sheet.id,
          {
            isOverride: raw.length > 0,
            text: summary.text,
            totalPercentage: summary.totalPercentage,
            sourceLabel: raw.length > 0 ? '单独费率' : '整体费率',
          },
        ];
      }),
    );
  }, [project, rateTemplates]);

  const saveProjectRates = async () => {
    if (!project?.id) return;
    await updateProject.mutateAsync({
      id: project.id,
      data: { rateSettings: JSON.stringify(projectRateSettings) },
    });
    notifications.show({ title: '已保存', message: '项目整体费率已更新', color: 'teal' });
  };

  const saveSheetRates = async () => {
    if (!selectedSheetSummary?.id) return;
    await updateDrawingRecord.mutateAsync({
      id: selectedSheetSummary.id,
      projectId: project?.id || null,
      data: { rateSettings: sheetRateSettings },
    });
    notifications.show({ title: '已保存', message: '工作表费率覆盖已更新', color: 'teal' });
  };

  const clearSheetRates = async () => {
    if (!selectedSheetSummary?.id) return;
    await updateDrawingRecord.mutateAsync({
      id: selectedSheetSummary.id,
      projectId: project?.id || null,
      data: { rateSettings: [] },
    });
    setSheetRateSettings(mergeRateSettings(rateTemplates, []));
    notifications.show({ title: '已清除', message: '该工作表已恢复使用项目整体费率', color: 'teal' });
  };

  const openSheetDetailFromConfigSource = (source: { sheetName: string; designNumber: string }) => {
    const targetSheet = (project?.sheets || []).find((sheet: any) => sheet.sheetName === source.sheetName);
    if (!targetSheet?.id) return;
    setSelectedSheetId(targetSheet.id);
    setBreakdownView('sheet');
    setSheetDetailOpened(true);
    setSheetDetailFilter('all');
    setSheetDetailSearch(source.designNumber || '');
    setSheetDetailView('grouped');
    setExpandedTypeGroups([]);
  };

  const handleDeleteSheet = (sheet: any) => {
    modals.openConfirmModal({
      title: '删除工作表',
      children: <Text size="sm">确定删除工作表“{sheet.sheetName}”吗？删除后无法恢复。</Text>,
      labels: { confirm: '确认删除', cancel: '取消' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        await deleteDrawingRecord.mutateAsync({ id: sheet.id, projectId: project?.id || null });
        if (selectedSheetId === sheet.id) setSelectedSheetId(null);
        notifications.show({ title: '删除成功', message: `工作表 [${sheet.sheetName}] 已删除`, color: 'teal' });
      },
    });
  };

  const handleSheetDrop = (targetSheetId: string) => {
    if (!draggingSheetId || draggingSheetId === targetSheetId) return;
    setSheetOrder((current) => {
      const next = current.filter((id) => id !== draggingSheetId);
      const targetIndex = next.indexOf(targetSheetId);
      if (targetIndex === -1) return current;
      next.splice(targetIndex, 0, draggingSheetId);
      return next;
    });
    setDraggingSheetId(null);
    setSheetSort('custom');
  };

  const handleDeleteProject = (targetProject: any) => {
    if (confirm('确定删除整个项目及其所有计算记录吗？')) {
      deleteProject.mutate(targetProject.id!);
    }
  };

  // 聚合导出逻辑：仅导出已保存的计算中心工作表
  const handleExportAll = async (options: ExportOptions) => {
    if (!project) return;
    if (!project.sheets || project.sheets.length === 0) {
      notifications.show({ title: '无法导出', message: '当前项目下还没有已保存的计算工作表', color: 'orange' });
      return;
    }
    notifications.show({ title: '导出中', message: '正在聚合工程全案数据...', color: 'blue', loading: true });

    const queryMap = new Map(
      (project.sheets || []).map((sheet: any, index: number) => [sheet.id, sheetDetailQueries[index]]),
    );

    const sheetRecords = await Promise.all((project.sheets || []).map(async (sheet: any) => {
      const query = queryMap.get(sheet.id);
      const detail = query?.data || (await query?.refetch?.())?.data;
      if (!detail) {
        throw new Error(`工作表“${sheet.sheetName}”明细读取失败`);
      }
      return {
        id: sheet.id,
        sheetName: detail.sheetName || sheet.sheetName,
        items: detail.items || [],
        allocationLabels: detail.allocationLabels,
        totalArea: Number(detail.totalArea || sheet.totalArea || 0),
        totalCost: Number(detail.totalCost || sheet.totalCost || 0),
        totalRetail: Number(detail.totalRetail || sheet.totalRetail || 0),
        rateSettings: detail.rateSettings || sheet.rateSettings || '[]',
      };
    }));

    const { exportProjectRecordsToExcel } = await loadExcelExportUtils();
    await exportProjectRecordsToExcel({
      projectName: project.name,
      buildingName: project.buildingName,
      records: sheetRecords,
      materials,
      products,
      projectRateSettings: (project as any).rateSettings || '[]',
      rateTemplates,
      quoteFactor,
      discountRate,
      options,
    });

    notifications.clean();
    notifications.show({ title: '成功', message: '工程项目全案 Excel 已生成', color: 'teal' });
  };

  return (
    <PageScaffold
      title="项目报价"
      description="按项目汇总工作表、查看测算结果，并统一导出报价资料。"
      actions={
        <Button variant="light" color="teal" size="xs" leftSection={<IconPlus size={14} />} onClick={() => setNewProjectModal(true)}>
          新建工程项目
        </Button>
      }
    >
      <Group align="stretch" h="100%" gap="sm" wrap="nowrap">
        <QuotationProjectListPanel
          projects={filteredProjects}
          selectedId={selectedId}
          search={projectSearch}
          onSearchChange={setProjectSearch}
          onSelect={setSelectedId}
          onDelete={handleDeleteProject}
        />

        {/* 右侧详情看板 */}
        <Paper withBorder p={0} className="app-surface app-section app-surface-strong" style={{ flex: 1 }}>
          {project ? (
            <ScrollArea className="app-section-body soft-scroll">
              <Box p="lg" style={{ background: 'linear-gradient(180deg, rgba(20,184,166,0.07) 0%, rgba(255,255,255,0) 100%)' }}>
                <Group justify="space-between" mb="md">
                  <Box>
                    <Group gap="xs" mb={4}>
                      <ThemeIcon radius="md" size={34} color="teal" variant="light">
                        <IconBuildingCommunity size={18}/>
                      </ThemeIcon>
                      <Title order={4}>{project.name}</Title>
                      <Badge color={project.isCompleted ? 'gray' : 'teal'} variant="light">{project.isCompleted ? '已完成' : '未完成'}</Badge>
                    </Group>
                    <Text size="sm" c="dimmed" ml={42}>{project.buildingName || '全案总览'}</Text>
                  </Box>
                  <Group gap="xs">
                    <Button
                      variant={project.isCompleted ? 'light' : 'default'}
                      color={project.isCompleted ? 'gray' : 'teal'}
                      size="xs"
                      onClick={() => updateProject.mutate({ id: project.id!, data: { isCompleted: project.isCompleted ? 0 : 1 } })}
                    >
                      {project.isCompleted ? '标记为未完成' : '标记为已完成'}
                    </Button>
                    <Button variant="filled" color="teal" size="xs" leftSection={<IconTableExport size={14}/>} onClick={() => setExportModalOpened(true)}>一键导出全案 Excel</Button>
                  </Group>
                </Group>

                <QuotationStatsCards stats={projectStats} />

                {projectStats && quoteSummary && (
                  <Paper
                    withBorder
                    radius="xl"
                    p="md"
                    mb="md"
                    style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.96) 0%, rgba(248,250,252,0.96) 100%)' }}
                  >
                    <Group justify="space-between" align="flex-start" wrap="wrap" mb="md">
                      <Box>
                        <Group gap="xs" mb={4}>
                          <ThemeIcon radius="xl" size={34} color="orange" variant="light">
                            <IconRosetteDiscountCheck size={18} />
                          </ThemeIcon>
                          <Box>
                            <Text fw={800} size="sm">报价测算台</Text>
                            <Text size="xs" c="dimmed">按项目快速试算报价系数、下浮后报价和毛利率</Text>
                          </Box>
                        </Group>
                      </Box>
                      <Group gap="sm" align="flex-end" wrap="wrap">
                        <NumberInput
                          size="sm"
                          label="报价系数"
                          value={quoteFactor}
                          onChange={(value) => setQuoteFactor(typeof value === 'number' ? value : 1)}
                          min={0}
                          step={0.01}
                          decimalScale={2}
                          w={120}
                        />
                        <NumberInput
                          size="sm"
                          label="下浮点数 %"
                          value={discountRate}
                          onChange={(value) => setDiscountRate(typeof value === 'number' ? value : 0)}
                          min={0}
                          max={100}
                          step={0.5}
                          decimalScale={1}
                          w={120}
                        />
                      </Group>
                    </Group>

                    <SimpleGrid cols={{ base: 2, lg: 6 }} spacing="sm">
                      <Card withBorder radius="lg" padding="md">
                        <Text size="xs" c="dimmed">成本合计</Text>
                        <Text fw={900} size="xl" c="teal.7">¥{projectStats.totalCost.toFixed(0)}</Text>
                        <Text size="xs" c="dimmed">成本均价 ¥{quoteSummary.costPerSqm.toFixed(0)}/㎡</Text>
                      </Card>
                      <Card withBorder radius="lg" padding="md">
                        <Text size="xs" c="dimmed">测算销售</Text>
                        <Text fw={900} size="xl" c="blue.7">¥{quoteSummary.baseRetail.toFixed(0)}</Text>
                        <Text size="xs" c="dimmed">系统原始建议值</Text>
                      </Card>
                      <Card withBorder radius="lg" padding="md">
                        <Text size="xs" c="dimmed">系数后报价</Text>
                        <Text fw={900} size="xl" c="grape.7">¥{quoteSummary.adjustedRetail.toFixed(0)}</Text>
                        <Text size="xs" c="dimmed">测算销售 × {quoteFactor.toFixed(2)}</Text>
                      </Card>
                      <Card withBorder radius="lg" padding="md" style={{ background: 'linear-gradient(180deg, rgba(255,247,237,0.9) 0%, rgba(255,255,255,1) 100%)' }}>
                        <Text size="xs" c="dimmed">下浮后报价</Text>
                        <Text fw={900} size="xl" c="orange.7">¥{quoteSummary.finalQuote.toFixed(0)}</Text>
                        <Text size="xs" c="dimmed">报价均价 ¥{quoteSummary.quotePerSqm.toFixed(0)}/㎡</Text>
                      </Card>
                      <Card withBorder radius="lg" padding="md">
                        <Text size="xs" c="dimmed">附加费率金额</Text>
                        <Text fw={900} size="xl" c="grape.7">¥{quoteSummary.totalRateAmount.toFixed(0)}</Text>
                        <Text size="xs" c="dimmed">按整体/工作表费率计算</Text>
                      </Card>
                      <Card withBorder radius="lg" padding="md">
                        <Text size="xs" c="dimmed">预估毛利</Text>
                        <Text fw={900} size="xl" c={quoteSummary.grossProfit >= 0 ? 'teal.7' : 'red.7'}>
                          ¥{quoteSummary.grossProfit.toFixed(0)}
                        </Text>
                        <Text size="xs" c="dimmed">报价减成本</Text>
                      </Card>
                      <Card withBorder radius="lg" padding="md">
                        <Text size="xs" c="dimmed">毛利率</Text>
                        <Text fw={900} size="xl">{quoteSummary.grossMargin.toFixed(1)}%</Text>
                        <Text size="xs" c="dimmed">按下浮后报价计算</Text>
                      </Card>
                    </SimpleGrid>
                  </Paper>
                )}

                <QuotationRatePanel
                  rateScope={rateScope}
                  onRateScopeChange={setRateScope}
                  currentRateTitle={currentRateTitle}
                  currentRateSettings={currentRateSettings}
                  selectedSheetSummary={selectedSheetSummary}
                  enabledSheetRates={enabledSheetRates}
                  projectRateSummary={projectRateSummary}
                  sheetRateSummary={sheetRateSummary}
                  onToggleRateEnabled={(rateId, enabled) => {
                    const updater = (current: AppliedRateSetting[]) => current.map((item) => item.rateId === rateId ? { ...item, enabled } : item);
                    if (rateScope === 'sheet') setSheetRateSettings(updater);
                    else setProjectRateSettings(updater);
                  }}
                  onChangeRatePercentage={(rateId, value) => {
                    const updater = (current: AppliedRateSetting[]) => current.map((item) => item.rateId === rateId ? { ...item, percentage: value } : item);
                    if (rateScope === 'sheet') setSheetRateSettings(updater);
                    else setProjectRateSettings(updater);
                  }}
                  onSave={rateScope === 'sheet' ? saveSheetRates : saveProjectRates}
                  onResetSheetRates={clearSheetRates}
                />

                <QuotationInsightsPanel
                  breakdownView={breakdownView}
                  setBreakdownView={setBreakdownView}
                  currentBreakdownHint={currentBreakdownHint}
                  currentBreakdownTitle={currentBreakdownTitle}
                  breakdownHasData={breakdownHasData}
                  currentBreakdownSummary={currentBreakdownSummary}
                  selectedSheetSummary={selectedSheetSummary}
                  selectedBreakdownBucket={selectedBreakdownBucket}
                  setSelectedBreakdownBucket={setSelectedBreakdownBucket}
                  breakdownDetailsOpen={breakdownDetailsOpen}
                  setBreakdownDetailsOpen={setBreakdownDetailsOpen}
                  selectedBreakdownItems={selectedBreakdownItems}
                  breakdownBucketMeta={breakdownBucketMeta}
                  selectedConfigName={selectedConfigName}
                  setSelectedConfigName={setSelectedConfigName}
                  configSourcesOpen={configSourcesOpen}
                  setConfigSourcesOpen={setConfigSourcesOpen}
                  configSourceSheetFilter={configSourceSheetFilter}
                  setConfigSourceSheetFilter={setConfigSourceSheetFilter}
                  configSourceTypeFilter={configSourceTypeFilter}
                  setConfigSourceTypeFilter={setConfigSourceTypeFilter}
                  configSourceSort={configSourceSort}
                  setConfigSourceSort={setConfigSourceSort}
                  configSourceSheetOptions={configSourceSheetOptions}
                  configSourceTypeOptions={configSourceTypeOptions}
                  visibleConfigSources={visibleConfigSources}
                  openSheetDetailFromConfigSource={openSheetDetailFromConfigSource}
                  topCostSheets={topCostSheets}
                  selectedSheetId={selectedSheetId}
                  setSelectedSheetId={setSelectedSheetId}
                  sheetRateMetaMap={sheetRateMetaMap}
                />

                <Tabs defaultValue="sheets" color="teal">
                  <Tabs.List>
                    <Tabs.Tab value="sheets" leftSection={<IconLayoutGrid size={14}/>}>工作表清单 ({project.sheets?.length || 0})</Tabs.Tab>
                  </Tabs.List>

                  <Tabs.Panel value="sheets" pt="md">
                    <QuotationSheetsPanel
                      sheets={sortedSheets}
                      selectedSheetId={selectedSheetId}
                      draggingSheetId={draggingSheetId}
                      sheetSort={sheetSort}
                      sheetRateMetaMap={sheetRateMetaMap}
                      onSortChange={setSheetSort}
                      onSelect={(id) => {
                        setSelectedSheetId(id);
                        setBreakdownView('sheet');
                      }}
                      onOpenDetail={(id) => {
                        setSelectedSheetId(id);
                        setSheetDetailOpened(true);
                      }}
                      onDelete={handleDeleteSheet}
                      onDragStart={setDraggingSheetId}
                      onDragEnd={() => setDraggingSheetId(null)}
                      onDrop={handleSheetDrop}
                    />
                  </Tabs.Panel>
                </Tabs>
              </Box>
            </ScrollArea>
          ) : (
            <EmptyPane label="请选择或创建一个工程项目" />
          )}
        </Paper>
      </Group>

      {/* Modals */}
      <Modal opened={newProjectModal} onClose={() => setNewProjectModal(false)} title="新建工程项目"><Stack>
        <TextInput label="项目名称" placeholder="例如：岳里小区二期" value={projectForm.name} onChange={(e) => setProjectForm({ ...projectForm, name: e.currentTarget.value })} required />
        <TextInput label="备注信息" placeholder="例如：红橡木材质" value={projectForm.buildingName} onChange={(e) => setProjectForm({ ...projectForm, buildingName: e.currentTarget.value })} />
        <Select label="项目状态" data={[{ value: '0', label: '未完成' }, { value: '1', label: '已完成' }]} value={String(projectForm.isCompleted)} onChange={(value) => setProjectForm({ ...projectForm, isCompleted: Number(value || 0) })} />
        <Button onClick={async () => { await createProject.mutateAsync(projectForm); setNewProjectModal(false); setProjectForm({ name: '', buildingName: '', isCompleted: 0 }); }} color="teal" fullWidth mt="md">创建项目</Button>
      </Stack></Modal>
      <Modal opened={exportModalOpened} onClose={() => setExportModalOpened(false)} title="导出选项" centered>
        <Stack gap="md">
          <Text size="sm" c="dimmed">默认会全部导出。你也可以只导出复核表，或者只导出项目总览和已用组合价格表。</Text>
          <Checkbox
            checked={exportOptions.includeReviewSheet}
            onChange={(event) => setExportOptions((current) => ({ ...current, includeReviewSheet: event.currentTarget.checked }))}
            label="导出造价复核"
            description="包含单方造价、费率、分项配置来源"
          />
          <Checkbox
            checked={exportOptions.includeUsedProductSheets}
            onChange={(event) => setExportOptions((current) => ({ ...current, includeUsedProductSheets: event.currentTarget.checked }))}
            label="导出已用组合价格表"
            description="包含已用组合汇总和已用组合价格表"
          />
          <Checkbox
            checked={exportOptions.includeEngineeringSheets}
            onChange={(event) => setExportOptions((current) => ({ ...current, includeEngineeringSheets: event.currentTarget.checked }))}
            label="导出完整工程量表"
            description="包含汇总、工程量表、设计编号目录"
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setExportModalOpened(false)}>取消</Button>
            <Button
              color="teal"
              onClick={async () => {
                setExportModalOpened(false);
                await handleExportAll(exportOptions);
              }}
            >
              开始导出
            </Button>
          </Group>
        </Stack>
      </Modal>
      <QuotationSheetDetailModal
        opened={sheetDetailOpened && !!selectedSheetId}
        onClose={() => {
          setSheetDetailOpened(false);
          setSheetDetailFilter('all');
          setSheetDetailSearch('');
          setSheetDetailView('grouped');
          setExpandedTypeGroups([]);
        }}
        sheetDetail={sheetDetail}
        sheetAllocationSummary={sheetAllocationSummary}
        sheetDetailFilter={sheetDetailFilter}
        setSheetDetailFilter={setSheetDetailFilter}
        sheetDetailSearch={sheetDetailSearch}
        setSheetDetailSearch={setSheetDetailSearch}
        sheetDetailView={sheetDetailView}
        setSheetDetailView={setSheetDetailView}
        groupedSheetItems={groupedSheetItems}
        expandedTypeGroups={expandedTypeGroups}
        setExpandedTypeGroups={setExpandedTypeGroups}
        filteredSheetItems={filteredSheetItems}
        sheetBreakdownData={sheetBreakdownData}
        topWindowItems={topWindowItems}
        topProductsInSheet={topProductsInSheet}
      />
    </PageScaffold>
  );
};

export default QuotationPage;
