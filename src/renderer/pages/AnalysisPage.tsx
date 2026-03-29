import React, { memo, useDeferredValue, useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Card,
  Center,
  Divider,
  Modal,
  Group,
  NumberInput,
  Pagination,
  Paper,
  ScrollArea,
  SegmentedControl,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
  Tooltip,
  FileButton,
  Checkbox,
  Flex,
  SimpleGrid,
} from '@mantine/core';
import {
  IconPlus,
  IconTrash,
  IconCalculator,
  IconDeviceFloppy,
  IconFileUpload,
  IconDownload,
  IconBox,
  IconTools,
  IconHierarchy2,
  IconListDetails,
  IconX,
  IconSquarePlus,
  IconArrowRight,
  IconCheck,
  IconRotateClockwise,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';

import { PageScaffold } from '../components/ui/PageScaffold';
import {
  useMaterialCategories,
  useMaterials,
  usePricingProducts,
  useCreateDrawingRecord,
  useQuotationProjects,
} from '../hooks/useWindowApi';
import { useWindowStore } from '../stores/windowStore';

const SHAPES = [
  { value: 'RECTANGLE', label: '矩形', params: ['width', 'height'] },
  { value: 'TRIANGLE', label: '三角形', params: ['width', 'height'] },
  { value: 'TRAPEZOID', label: '梯形', params: ['width', 'heightLeft', 'heightRight'] },
  { value: 'CIRCLE', label: '圆形', params: ['diameter'] },
  { value: 'CUSTOM', label: '异形', params: ['manualArea'] },
];

const SHAPE_LABEL_TO_VALUE: Record<string, string> = {
  矩形: 'RECTANGLE',
  三角形: 'TRIANGLE',
  三角: 'TRIANGLE',
  梯形: 'TRAPEZOID',
  圆形: 'CIRCLE',
  圆: 'CIRCLE',
  异形: 'CUSTOM',
};
const VALID_SHAPE_VALUES = new Set(['RECTANGLE', 'TRIANGLE', 'TRAPEZOID', 'CIRCLE', 'CUSTOM']);
type BreakdownBucket = 'profile' | 'glass' | 'hardware' | 'accessory';

const breakdownBucketMeta: Record<BreakdownBucket, { label: string; color: string }> = {
  profile: { label: '主材型材', color: 'teal' },
  glass: { label: '玻璃面材', color: 'cyan' },
  hardware: { label: '五金配件', color: 'orange' },
  accessory: { label: '辅材工艺', color: 'grape' },
};

const detectBreakdownBucket = (name: string) => {
  const text = String(name || '').toLowerCase();
  if (/(玻璃|中空|夹胶|钢化|百叶|面板|板材)/.test(text)) return 'glass';
  if (/(五金|锁|执手|合页|铰链|滑轮|地弹簧|闭门器)/.test(text)) return 'hardware';
  if (/(型材|边框|框料|扇料|铝材|钢材|立柱|横梁)/.test(text)) return 'profile';
  return 'accessory';
};
const IMPORT_BASE_HEADERS = new Set([
  '所属类型', '类型', '设计编号', '编号', '形状', '宽(mm)', '宽度', '宽', '高(mm)', '高度', '高',
  '左高(mm)', '右高(mm)', '直径(mm)', '自定义面积(㎡)', '面积(㎡)', '产品组合', '组合',
  '配件1分类', '配件1材料', '配件1数量',
  '配件2分类', '配件2材料', '配件2数量',
  '配件3分类', '配件3材料', '配件3数量',
  '配件4分类', '配件4材料', '配件4数量',
  '配件5分类', '配件5材料', '配件5数量',
  '配件6分类', '配件6材料', '配件6数量',
  '数量', '数量（樘）',
  '分配1标签', '分配1数量', '分配2标签', '分配2数量', '分配3标签', '分配3数量',
  '分配4标签', '分配4数量', '分配5标签', '分配5数量', '分配6标签', '分配6数量',
  '成本单价(自动)', '销售单价(自动)',
]);

const loadXLSX = async () => await import('xlsx');
const loadExcelExportUtils = async () => await import('../utils/excelExport');

type AnalysisRowProps = {
  win: any;
  isActive: boolean;
  isSelected: boolean;
  totalQuantity?: number;
  categories: any[];
  products: any[];
  materials: any[];
  onActivate: (id: number | null) => void;
  onToggleSelected: (id: number, checked: boolean) => void;
  onUpdateWindow: (id: number, updater: (win: any) => any) => void;
  onDeleteWindow: (id: number) => void;
};

const formatShapeSummary = (shape: string, params: Record<string, number>) => {
  if (shape === 'RECTANGLE') return `${params.width || 0} × ${params.height || 0}`;
  if (shape === 'TRIANGLE') return `三角 ${params.width || 0} × ${params.height || 0}`;
  if (shape === 'TRAPEZOID') return `梯形 ${params.width || 0} / ${params.heightLeft || 0}-${params.heightRight || 0}`;
  if (shape === 'CIRCLE') return `圆 ${params.diameter || 0}`;
  return `异形 ${params.manualArea || 0} ㎡`;
};

const AnalysisWindowCard = memo(({
  win,
  isActive,
  isSelected,
  totalQuantity,
  categories,
  products,
  materials,
  onActivate,
  onToggleSelected,
  onUpdateWindow,
  onDeleteWindow,
}: AnalysisRowProps) => {
  const [accessoryCategoryId, setAccessoryCategoryId] = useState<string | null>(null);
  const [accessoryMaterialId, setAccessoryMaterialId] = useState<string | null>(null);
  const [windowTypeDraft, setWindowTypeDraft] = useState(win.windowType || '');
  const [designNumberDraft, setDesignNumberDraft] = useState(win.designNumber || '');

  useEffect(() => {
    setWindowTypeDraft(win.windowType || '');
  }, [win.windowType]);

  useEffect(() => {
    setDesignNumberDraft(win.designNumber || '');
  }, [win.designNumber]);

  const filteredAccessoryMaterials = useMemo(
    () => materials.filter((material) => !accessoryCategoryId || material.categoryId === accessoryCategoryId),
    [materials, accessoryCategoryId],
  );

  const handleAddAccessory = () => {
    const material = materials.find((entry) => entry.id === accessoryMaterialId);
    if (!material) return;
    onUpdateWindow(win.id, (w) => ({
      ...w,
      accessories: [
        ...w.accessories,
        {
          id: Date.now(),
          materialId: material.id,
          name: material.name,
          unitType: material.unitType,
          unitLabel: material.unitLabel,
          costPrice: material.costPrice,
          retailPrice: material.retailPrice,
          quantity: 1,
        },
      ],
    }));
    setAccessoryMaterialId(null);
  };

  const commitWindowType = () => {
    if (windowTypeDraft === (win.windowType || '')) return;
    onUpdateWindow(win.id, (w) => ({ ...w, windowType: windowTypeDraft }));
  };

  const commitDesignNumber = () => {
    if (designNumberDraft === (win.designNumber || '')) return;
    const parsed = parseDesignNumber(designNumberDraft);
    onUpdateWindow(win.id, (w) => {
      const next = { ...w, designNumber: designNumberDraft };
      if (parsed && w.shape === 'RECTANGLE') next.params = { ...w.params, ...parsed };
      return next;
    });
  };

  return (
  <Paper
    withBorder
    radius="lg"
    p="md"
    style={{
      background: isActive ? '#f2fbf5' : '#ffffff',
      borderColor: isActive ? 'rgba(12, 166, 120, 0.28)' : 'rgba(148, 163, 184, 0.18)',
      boxShadow: isActive ? '0 10px 24px rgba(12, 166, 120, 0.08)' : '0 6px 18px rgba(15, 23, 42, 0.04)',
    }}
  >
    <Stack gap="sm">
      <Group justify="space-between" wrap="nowrap" align="flex-start">
        <Group gap="sm" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
          <Checkbox checked={isSelected} onChange={(e)=>onToggleSelected(win.id, e.currentTarget.checked)} />
          <Box style={{ minWidth: 0, flex: 1, cursor: 'pointer' }} onClick={() => onActivate(isActive ? null : win.id)}>
            <Group gap="xs" mb={6} wrap="wrap">
              <Badge color={isActive ? 'teal' : 'gray'} variant="light" size="sm">{SHAPES.find((shape) => shape.value === win.shape)?.label || '窗型'}</Badge>
              <Badge color="blue" variant="outline" size="sm">类型: {win.windowType || '未分类'}</Badge>
            </Group>
            <Text fw={900} size="md" mb={8} style={{ lineHeight: 1.2 }}>
              {win.designNumber || '未命名窗型'}
            </Text>
            <SimpleGrid cols={{ base: 2, md: 4 }} spacing={8}>
              <Paper radius="md" p="xs" style={{ background: '#f8fafc' }}>
                <Text size="10px" tt="uppercase" fw={800} c="dimmed">规格</Text>
                <Text size="xs" fw={700} mt={2}>{formatShapeSummary(win.shape, win.params)}</Text>
              </Paper>
              <Paper radius="md" p="xs" style={{ background: '#f8fafc' }}>
                <Text size="10px" tt="uppercase" fw={800} c="dimmed">组合</Text>
                <Text size="xs" fw={700} mt={2} lineClamp={2}>{products.find((product) => product.id === win.productId)?.name || '未选择'}</Text>
              </Paper>
              <Paper radius="md" p="xs" style={{ background: '#f8fafc' }}>
                <Text size="10px" tt="uppercase" fw={800} c="dimmed">数量</Text>
                <Text size="xs" fw={700} mt={2}>{totalQuantity ?? 0}</Text>
              </Paper>
              <Paper radius="md" p="xs" style={{ background: '#f8fafc' }}>
                <Text size="10px" tt="uppercase" fw={800} c="dimmed">配件</Text>
                <Text size="xs" fw={700} mt={2}>{win.accessories.length} 项</Text>
              </Paper>
            </SimpleGrid>
          </Box>
        </Group>
        <Group gap="xs" wrap="nowrap">
          <ActionIcon variant="light" color={isActive ? 'teal' : 'gray'} onClick={() => onActivate(isActive ? null : win.id)}>
            <IconArrowRight size={16} style={{ transform: isActive ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 120ms ease' }} />
          </ActionIcon>
          <ActionIcon color="red" variant="subtle" size="md" onClick={()=>onDeleteWindow(win.id)}><IconTrash size={18}/></ActionIcon>
        </Group>
      </Group>

      {isActive && (
        <SimpleGrid cols={{ base: 1, xl: 3 }} spacing="md">
          <Paper withBorder radius="md" p="sm" bg="#fbfdfb">
            <Stack gap="sm">
              <Text size="xs" fw={900} c="teal.9">基础信息</Text>
              <TextInput
                label="所属类型"
                size="sm"
                value={windowTypeDraft}
                onChange={(e) => setWindowTypeDraft(e.currentTarget.value)}
                onBlur={commitWindowType}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    commitWindowType();
                    e.currentTarget.blur();
                  }
                }}
              />
              <TextInput
                label="设计编号"
                size="sm"
                value={designNumberDraft}
                onChange={(e) => setDesignNumberDraft(e.currentTarget.value)}
                onBlur={commitDesignNumber}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    commitDesignNumber();
                    e.currentTarget.blur();
                  }
                }}
              />
              <Select label="形状" size="sm" data={SHAPES.map(s=>({value:s.value, label:s.label}))} value={win.shape} onChange={(val)=>onUpdateWindow(win.id, w => ({...w, shape: val}))} />
              <Group grow align="flex-end">
                {SHAPES.find(s=>s.value===win.shape)?.params.map(p => (
                  <NumberInput key={p} size="sm" label={p==='width'?'宽(mm)':p==='height'?'高(mm)':p==='heightLeft'?'左高(mm)':p==='heightRight'?'右高(mm)':p==='manualArea'?'面积(㎡)':'直径(mm)'} hideControls value={win.params[p]} onChange={(val)=>onUpdateWindow(win.id, w => ({...w, params: {...w.params, [p]: Number(val)}}))} />
                ))}
              </Group>
            </Stack>
          </Paper>

          <Paper withBorder radius="md" p="sm" bg="#fcfcff">
            <Stack gap="sm">
              <Text size="xs" fw={900} c="blue.9">组合与配件</Text>
              <Select label="产品组合" placeholder="选择组合" size="sm" data={products.map(p=>({value:p.id!, label:p.name}))} value={win.productId} onChange={(val)=>onUpdateWindow(win.id, w => ({...w, productId: val}))} searchable />
              <Group grow align="flex-end">
                <Select
                  label="配件分类"
                  placeholder="先选分类"
                  size="sm"
                  data={categories.map((category) => ({ value: category.id || '', label: category.name }))}
                  value={accessoryCategoryId}
                  onChange={(value) => {
                    setAccessoryCategoryId(value);
                    setAccessoryMaterialId(null);
                  }}
                  clearable
                />
                <Select
                  label="具体材料"
                  placeholder="再选材料"
                  size="sm"
                  searchable
                  data={filteredAccessoryMaterials.map((material) => ({ value: material.id!, label: material.name }))}
                  value={accessoryMaterialId}
                  onChange={setAccessoryMaterialId}
                />
                <Button variant="light" onClick={handleAddAccessory} disabled={!accessoryMaterialId}>加入配件</Button>
              </Group>
              <Stack gap={6}>
                {win.accessories.length === 0 && <Text size="xs" c="dimmed">暂无配件</Text>}
                {win.accessories.map((acc: any) => (
                  <Paper key={acc.id} px="xs" py={6} radius="sm" style={{ background: '#eef2ff', border: '1px solid #d0ebff' }}>
                    <Group justify="space-between" wrap="nowrap" align="center">
                      <Box style={{ minWidth: 0, flex: 1 }}>
                        <Text size="xs" fw={700} truncate>{acc.name}</Text>
                        <Text size="10px" c="dimmed">{acc.unitLabel}</Text>
                      </Box>
                      <NumberInput size="xs" w={72} value={acc.quantity} onChange={(val)=>onUpdateWindow(win.id, w => ({...w, accessories: w.accessories.map((ac:any)=>ac.id===acc.id?{...ac, quantity: Number(val)}:ac)}))} hideControls />
                      <ActionIcon size="sm" color="red" variant="subtle" onClick={()=>onUpdateWindow(win.id, w => ({...w, accessories: w.accessories.filter((ac:any)=>ac.id!==acc.id)}))}><IconX size={14}/></ActionIcon>
                    </Group>
                  </Paper>
                ))}
              </Stack>
            </Stack>
          </Paper>

          <Paper withBorder radius="md" p="sm" bg="#fbfffc">
            <Stack gap="sm">
              <Group justify="space-between">
                <Text size="xs" fw={900} c="teal.9">数量分配</Text>
                <ActionIcon size="sm" color="teal" variant="filled" onClick={()=>onUpdateWindow(win.id, w => ({...w, allocations: [...w.allocations, {id:Date.now(), label:'', quantity:0}]}))}><IconSquarePlus size={18}/></ActionIcon>
              </Group>
              <Stack gap={6}>
                {win.allocations.map((a: any) => (
                  <Paper key={a.id} p="xs" radius="sm" style={{ background: '#f8fafc', border: '1px solid #eef2f7' }}>
                    <Group gap="xs" wrap="nowrap" align="flex-end">
                      <TextInput label="维度" size="xs" style={{ flex: 1 }} value={a.label} onChange={(e)=>onUpdateWindow(win.id, w => ({...w, allocations: w.allocations.map((al:any)=>al.id===a.id?{...al, label:e.target.value}:al)}))} />
                      <NumberInput label="数量" size="xs" w={92} value={a.quantity} onChange={(val)=>onUpdateWindow(win.id, w => ({...w, allocations: w.allocations.map((al:any)=>al.id===a.id?{...al, quantity:Number(val)}:al)}))} hideControls />
                      <ActionIcon size="sm" color="red" variant="subtle" onClick={()=>onUpdateWindow(win.id, w => ({...w, allocations: w.allocations.filter((al:any)=>al.id!==a.id)}))}><IconX size={14}/></ActionIcon>
                    </Group>
                  </Paper>
                ))}
              </Stack>
              <Paper radius="md" p="sm" style={{ background: '#f1f8f3' }}>
                <Text size="xs" fw={900} c="teal.9">当前合计：{totalQuantity ?? 0}</Text>
              </Paper>
            </Stack>
          </Paper>
        </SimpleGrid>
      )}
    </Stack>
  </Paper>
  );
}, (prev, next) => (
  prev.win === next.win &&
  prev.isActive === next.isActive &&
  prev.isSelected === next.isSelected &&
  prev.totalQuantity === next.totalQuantity &&
  prev.products === next.products &&
  prev.materials === next.materials &&
  prev.categories === next.categories
));

const calculateGeometry = (shape: string, params: any) => {
  let area = 0; let perimeter = 0;
  const w = (params.width || 0) / 1000;
  const h = (params.height || 0) / 1000;
  const hl = (params.heightLeft || 0) / 1000;
  const hr = (params.heightRight || 0) / 1000;
  const d = (params.diameter || 0) / 1000;
  
  switch (shape) {
    case 'RECTANGLE': area = w * h; perimeter = 2 * (w + h); break;
    case 'TRIANGLE': area = 0.5 * w * h; perimeter = w + h + Math.sqrt(Math.pow(w, 2) + Math.pow(h, 2)); break;
    case 'TRAPEZOID': area = 0.5 * (hl + hr) * w; perimeter = w + hl + hr + Math.sqrt(Math.pow(w, 2) + Math.pow(Math.abs(hl - hr), 2)); break;
    case 'CIRCLE': area = Math.PI * Math.pow(d / 2, 2); perimeter = Math.PI * d; break;
    case 'CUSTOM': area = params.manualArea || 0; perimeter = 0; break;
  }
  return { area, perimeter };
};

const parseDesignNumber = (text: string) => {
  // 更加灵活的匹配：查找连续的4位数字，无视前后缀
  const match = text.match(/(\d{2})(\d{2})/);
  if (match) {
    return { width: parseInt(match[1]) * 100, height: parseInt(match[2]) * 100 };
  }
  return null;
};

const toNumeric = (value: unknown) => {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const normalized = String(value).replace(/,/g, '').trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeLookupText = (value: unknown) => String(value || '').trim().toLowerCase().replace(/\s+/g, '');

const resolveMaterialFromImport = (
  materialName: string,
  categoryName: string,
  materials: any[],
  categories: any[],
) => {
  const normalizedMaterial = normalizeLookupText(materialName);
  const normalizedCategory = normalizeLookupText(categoryName);
  if (!normalizedMaterial) return null;
  const categoryId = categories.find((entry) => normalizeLookupText(entry.name) === normalizedCategory)?.id;
  return materials.find((entry) => {
    const sameName =
      normalizeLookupText(entry.name) === normalizedMaterial ||
      entry.id === materialName ||
      normalizeLookupText(entry.name).includes(normalizedMaterial) ||
      normalizedMaterial.includes(normalizeLookupText(entry.name));
    if (!sameName) return false;
    if (!categoryId) return true;
    return entry.categoryId === categoryId;
  }) || null;
};

const buildImportedAccessory = (
  material: any,
  materialName: string,
  categoryName: string,
  quantity: number,
  id: number,
) => ({
  id,
  categoryId: material?.categoryId || null,
  importedCategoryName: categoryName,
  importedMaterialName: materialName,
  name: material?.name || materialName || '未匹配配件',
  materialId: material?.id || '',
  unitType: material?.unitType || 'fixed',
  unitLabel: material?.unitLabel || '项',
  costPrice: material?.costPrice || 0,
  retailPrice: material?.retailPrice || 0,
  quantity: quantity > 0 ? quantity : 1,
});

const AnalysisPage = () => {
  const { data: categories = [] } = useMaterialCategories();
  const { data: projects = [] } = useQuotationProjects();
  const { data: materials = [] } = useMaterials();
  const { data: products = [] } = usePricingProducts();
  const createRecord = useCreateDrawingRecord();

  const { analysisDraft, setAnalysisDraft, clearAnalysisDraft } = useWindowStore();
  const { projectId, sheetName, windows } = analysisDraft;
  const deferredWindows = useDeferredValue(windows);

  const [activeWinId, setActiveWinId] = useState<number | null>(null);
  const [selectedWinIds, setSelectedWinIds] = useState<number[]>([]);
  const [bulkType, setBulkType] = useState('');
  const [typeSearch, setTypeSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [importPreview, setImportPreview] = useState<{
    opened: boolean;
    windows: any[];
    fileName: string;
  }>({ opened: false, windows: [], fileName: '' });
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null);
  const [importSetupOpened, setImportSetupOpened] = useState(false);
  const [bulkImportMapping, setBulkImportMapping] = useState<Record<string, string>>({});
  const [bulkAccessoryMapping, setBulkAccessoryMapping] = useState<Record<string, string>>({});
  const [importPreviewFilter, setImportPreviewFilter] = useState<'all' | 'pending' | 'product_pending' | 'accessory_pending'>('all');
  const pageSize = 8;
  const unfinishedProjects = useMemo(() => projects.filter((project) => !project.isCompleted), [projects]);
  const categoryNameById = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories],
  );
  const importCardRefs = useRef<Record<string | number, HTMLDivElement | null>>({});
  const filteredImportPreviewWindows = useMemo(() => {
    if (importPreviewFilter === 'all') return importPreview.windows;
    return importPreview.windows.filter((item) => {
      const unresolvedProduct = !item.productId && item.importedProductName;
      const unresolvedAccessoryCount = (item.accessories || []).filter((accessory: any) => !accessory.materialId && accessory.importedMaterialName).length;
      if (importPreviewFilter === 'product_pending') return Boolean(unresolvedProduct);
      if (importPreviewFilter === 'accessory_pending') return unresolvedAccessoryCount > 0;
      return unresolvedProduct || unresolvedAccessoryCount > 0;
    });
  }, [importPreview.windows, importPreviewFilter]);
  const importPreviewSummary = useMemo(() => {
    const productPendingCount = filteredImportPreviewWindows.filter((item) => !item.productId && item.importedProductName).length;
    const accessoryPendingCount = filteredImportPreviewWindows.reduce((sum, item) => (
      sum + (item.accessories || []).filter((accessory: any) => !accessory.materialId && accessory.importedMaterialName).length
    ), 0);
    const matchedProductCount = filteredImportPreviewWindows.filter((item) => item.productId).length;
    return {
      windowCount: filteredImportPreviewWindows.length,
      matchedProductCount,
      productPendingCount,
      accessoryPendingCount,
      totalPendingCount: productPendingCount + accessoryPendingCount,
    };
  }, [filteredImportPreviewWindows]);
  const firstPendingImportId = useMemo(() => {
    const firstProductPending = filteredImportPreviewWindows.find((item) => !item.productId && item.importedProductName);
    if (firstProductPending) return firstProductPending.id;
    const firstAccessoryPending = filteredImportPreviewWindows.find((item) => (
      (item.accessories || []).some((accessory: any) => !accessory.materialId && accessory.importedMaterialName)
    ));
    return firstAccessoryPending?.id || null;
  }, [filteredImportPreviewWindows]);

  // 关键修复：使用函数式更新，避免多次 setState 导致的冲突
  const updateWindow = useCallback((id: number, updater: (win: any) => any) => {
    setAnalysisDraft({
      windows: windows.map(w => w.id === id ? updater(w) : w)
    });
  }, [windows, setAnalysisDraft]);

  const handleApplyBulkType = () => {
    if (!bulkType) return;
    setAnalysisDraft({
      windows: windows.map(w => selectedWinIds.includes(w.id) ? { ...w, windowType: bulkType } : w)
    });
    setBulkType('');
    setSelectedWinIds([]);
    notifications.show({ title: '批量设置成功', message: `已将选中项设为: ${bulkType}`, color: 'blue' });
  };

  const fullCalculation = useMemo(() => {
    let totalArea = 0; let totalCost = 0; let totalRetail = 0;
    const items = deferredWindows.map(win => {
      const { area, perimeter } = calculateGeometry(win.shape, win.params);
      const totalQty = win.allocations.reduce((sum: number, a: any) => sum + (Number(a.quantity) || 0), 0);
      let wc = 0; let wr = 0;
      const compDetails: any[] = []; 

      if (win.productId) {
        const product = products.find(p => p.id === win.productId);
        product?.items.forEach((pItem: any) => {
          if (!pItem.includeInComboTotal) return;
          const m = materials.find(mat => mat.id === pItem.materialId);
          if (!m) return;
          const cp = m.costPrice || 0; const rp = m.retailPrice || 0;
          let cost = 0; let retail = 0;
          if (pItem.calcMode === 'area') { cost = pItem.quantity * cp; retail = pItem.quantity * rp; }
          else if (pItem.calcMode === 'perimeter') { cost = (pItem.quantity * cp * perimeter) / (area || 1); retail = (pItem.quantity * rp * perimeter) / (area || 1); }
          else { cost = (pItem.quantity * cp) / (area || 1); retail = (pItem.quantity * rp) / (area || 1); }
          wc += cost; wr += retail;
          compDetails.push({ name: m.name, cost, retail, mode: pItem.calcMode });
        });
      }
      
      const accDetails: any[] = [];
      win.accessories.forEach((acc: any) => {
        let ac = 0; let ar = 0; const cp = acc.costPrice || 0; const rp = acc.retailPrice || cp;
        if (acc.unitType === 'area') { ac = acc.quantity * cp * area; ar = acc.quantity * rp * area; }
        else if (acc.unitType === 'perimeter') { ac = acc.quantity * cp * perimeter; ar = acc.quantity * rp * perimeter; }
        else { ac = acc.quantity * cp; ar = acc.quantity * rp; }
        const itemWc = ac / (area || 1); const itemWr = ar / (area || 1);
        wc += itemWc; wr += itemWr;
        accDetails.push({ name: acc.name, cost: itemWc, retail: itemWr, qty: acc.quantity, unit: acc.unitLabel });
      });

      const tc = wc * area * totalQty; const tr = wr * area * totalQty;
      totalArea += area * totalQty; totalCost += tc; totalRetail += tr;
      return { ...win, area, perimeter, totalQuantity: totalQty, unitPrice: wc, totalPrice: tc, unitRetailPrice: wr, totalRetailPrice: tr, compDetails, accDetails };
    });
    return { totalArea, totalCost, totalRetail, items, profit: totalRetail - totalCost };
  }, [deferredWindows, products, materials]);

  const filteredWindows = useMemo(() => {
    const keyword = typeSearch.trim().toLowerCase();
    if (!keyword) return windows;
    return windows.filter((win) => (win.windowType || '').toLowerCase().includes(keyword));
  }, [windows, typeSearch]);

  const totalPages = Math.max(1, Math.ceil(filteredWindows.length / pageSize));
  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  const pagedWindows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredWindows.slice(start, start + pageSize);
  }, [filteredWindows, currentPage]);

  const activeWin = useMemo(() => fullCalculation.items.find(w => w.id === activeWinId), [fullCalculation, activeWinId]);
  const activeWinBreakdown = useMemo(() => {
    if (!activeWin) return [];
    const totals = {
      profile: 0,
      glass: 0,
      hardware: 0,
      accessory: 0,
    } satisfies Record<BreakdownBucket, number>;

    [...(activeWin.compDetails || []), ...(activeWin.accDetails || [])].forEach((detail: any) => {
      const bucket = detectBreakdownBucket(detail.name);
      totals[bucket] += Number(detail.cost || 0);
    });

    return (Object.keys(totals) as BreakdownBucket[])
      .map((key) => ({
        key,
        label: breakdownBucketMeta[key].label,
        color: breakdownBucketMeta[key].color,
        cost: totals[key],
        share: activeWin.unitPrice > 0 ? (totals[key] / activeWin.unitPrice) * 100 : 0,
      }))
      .filter((item) => item.cost > 0)
      .sort((a, b) => b.cost - a.cost);
  }, [activeWin]);
  const activeWinTopDrivers = useMemo(() => {
    if (!activeWin) return [];
    return [...(activeWin.compDetails || []), ...(activeWin.accDetails || [])]
      .map((detail: any) => ({
        ...detail,
        share: activeWin.unitPrice > 0 ? (Number(detail.cost || 0) / activeWin.unitPrice) * 100 : 0,
      }))
      .sort((a, b) => Number(b.cost || 0) - Number(a.cost || 0))
      .slice(0, 3);
  }, [activeWin]);
  const quantitiesById = useMemo(() => new Map(fullCalculation.items.map((item) => [item.id, item.totalQuantity])), [fullCalculation.items]);
  const groupedWindows = useMemo(() => {
    const groups = new Map<string, any[]>();
    pagedWindows.forEach((win) => {
      const key = win.windowType?.trim() || '未分类';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(win);
    });
    return Array.from(groups.entries()).map(([groupName, groupItems]) => ({
      groupName,
      items: groupItems,
      totalCount: groupItems.reduce((sum, item) => sum + (quantitiesById.get(item.id) || 0), 0),
    }));
  }, [pagedWindows, quantitiesById]);

  const toggleSelectedWindow = useCallback((id: number, checked: boolean) => {
    setSelectedWinIds((prev) => checked ? [...prev, id] : prev.filter((itemId) => itemId !== id));
  }, []);

  const handleDeleteWindow = useCallback((id: number) => {
    modals.openConfirmModal({
      title: '确认删除',
      children: <Text size="sm">确定永久删除此行吗？</Text>,
      labels: { confirm: '确认删除', cancel: '取消' },
      onConfirm: () => setAnalysisDraft({ windows: windows.filter(w => w.id !== id) }),
    });
  }, [setAnalysisDraft, windows]);

  const handleSave = async () => {
    if (!projectId) return notifications.show({ title: '保存失败', message: '请先选择归属工程项目', color: 'red' });
    if (!sheetName.trim()) return notifications.show({ title: '保存失败', message: '请输入工作表名称', color: 'red' });
    
    try {
      notifications.show({ id: 'saving-notify', title: '正在保存', message: '数据同步中...', loading: true, autoClose: false });

      const allLabels = Array.from(new Set(fullCalculation.items.flatMap(i => i.allocations.map((a: any) => a.label || '默认'))));

      const finalPayload = { 
        projectId, 
        sheetName: sheetName.trim(), 
        allocationLabels: allLabels,
        totalArea: fullCalculation.totalArea, 
        totalCost: fullCalculation.totalCost, 
        totalRetail: fullCalculation.totalRetail, 
        items: fullCalculation.items.map(i => ({ 
          ...i, 
          productId: (i.productId && i.productId !== '') ? i.productId : null, // 强制空ID转为null，防止外键报错
          quantity: i.totalQuantity || 0, 
          allocations: i.allocations.map((a: any) => ({ label: a.label || '默认', quantity: a.quantity || 0 })) 
        })) 
      };

      await createRecord.mutateAsync(finalPayload);

      notifications.update({ id: 'saving-notify', title: '保存成功', message: `工作表 [${sheetName}] 已存入项目`, color: 'teal', icon: <IconCheck size={18} />, loading: false, autoClose: 3000 });
      modals.openConfirmModal({ title: '保存成功', children: <Text size="sm">工作表已归档。是否需要清空当前录入草稿？</Text>, labels: { confirm: '清空', cancel: '保留' }, onConfirm: clearAnalysisDraft });
    } catch (err: any) {
      notifications.update({ id: 'saving-notify', title: '保存失败', message: err.message || '网络或数据库异常', color: 'red', icon: <IconX size={18} />, loading: false, autoClose: 5000 });
    }
  };

  const handleImportTemplate = async (file: File | null) => {
    if (!file) return;
    if (!projectId) {
      notifications.show({ title: '导入失败', message: '请先选择归属报价项目', color: 'red' });
      return;
    }
    if (!sheetName.trim()) {
      notifications.show({ title: '导入失败', message: '请先填写工作表名', color: 'red' });
      return;
    }

    try {
      notifications.show({ id: 'import-template', title: '正在导入模板', message: `正在解析 ${file.name} ...`, loading: true, autoClose: false });

      const XLSX = await loadXLSX();
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array', raw: false });
      const sheet = workbook.Sheets['录入模板'] || workbook.Sheets[workbook.SheetNames[0]];
      if (!sheet) throw new Error('未找到可读取的工作表');

      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
      const productByName = new Map(products.map((product) => [normalizeLookupText(product.name), product]));
      const unmatchedProducts = new Set<string>();
      const unmatchedAccessories = new Set<string>();

      const importedWindows = rows.flatMap((rawRow, index) => {
        const row = Object.fromEntries(Object.entries(rawRow).map(([key, value]) => [String(key).trim(), value]));
        const hasValue = Object.values(row).some((value) => String(value ?? '').trim() !== '');
        if (!hasValue) return [];

        const designNumber = String(row['设计编号'] || row['编号'] || '').trim();
        const windowType = String(row['所属类型'] || row['类型'] || '').trim();
        const shapeRaw = String(row['形状'] || '').trim();
        const normalizedShape = SHAPE_LABEL_TO_VALUE[shapeRaw] || shapeRaw.toUpperCase();
        const shape = VALID_SHAPE_VALUES.has(normalizedShape) ? normalizedShape : 'RECTANGLE';
        const parsedFromDesign = parseDesignNumber(designNumber);

        const width = toNumeric(row['宽(mm)'] || row['宽度'] || row['宽']) || parsedFromDesign?.width || 0;
        const height = toNumeric(row['高(mm)'] || row['高度'] || row['高']) || parsedFromDesign?.height || 0;
        const heightLeft = toNumeric(row['左高(mm)']);
        const heightRight = toNumeric(row['右高(mm)']);
        const diameter = toNumeric(row['直径(mm)']);
        const manualArea = toNumeric(row['自定义面积(㎡)'] || row['面积(㎡)']);
        const quantity = toNumeric(row['数量'] || row['数量（樘）']);

        const productName = String(row['产品组合'] || row['组合'] || '').trim();
        const normalizedProductName = normalizeLookupText(productName);
        const product =
          productByName.get(normalizedProductName) ||
          products.find((entry) => entry.id === productName) ||
          products.find((entry) => normalizeLookupText(entry.name).includes(normalizedProductName) || normalizedProductName.includes(normalizeLookupText(entry.name)));
        if (productName && !product) unmatchedProducts.add(productName);

        const accessoryIndexes = new Set<number>([1, 2, 3, 4, 5, 6]);
        Object.keys(row).forEach((header) => {
          const match = header.match(/^配件(\d+)(分类|材料|数量)$/);
          if (match) accessoryIndexes.add(Number(match[1]));
        });
        const accessories = Array.from(accessoryIndexes)
          .sort((a, b) => a - b)
          .flatMap((accessoryIndex) => {
            const categoryName = String(row[`配件${accessoryIndex}分类`] || '').trim();
            const materialName = String(row[`配件${accessoryIndex}材料`] || '').trim();
            const accessoryQuantity = toNumeric(row[`配件${accessoryIndex}数量`]);
            if (!categoryName && !materialName && accessoryQuantity <= 0) return [];
            const material = resolveMaterialFromImport(materialName, categoryName, materials, categories);
            if (!material && materialName) unmatchedAccessories.add(materialName);
            return [buildImportedAccessory(
              material,
              materialName,
              categoryName,
              accessoryQuantity,
              Date.now() + index * 1000 + accessoryIndex,
            )];
          });

        const allocations: any[] = [];
        for (let allocationIndex = 1; allocationIndex <= 6; allocationIndex += 1) {
          const label = String(row[`分配${allocationIndex}标签`] || '').trim();
          const qty = toNumeric(row[`分配${allocationIndex}数量`]);
          if (label || qty > 0) {
            allocations.push({
              id: Date.now() + index * 10 + allocationIndex,
              label: label || `分配${allocationIndex}`,
              quantity: qty,
            });
          }
        }

        Object.entries(row).forEach(([header, value]) => {
          if (IMPORT_BASE_HEADERS.has(header)) return;
          const qty = toNumeric(value);
          if (!header || qty <= 0) return;
          allocations.push({
            id: Date.now() + index * 100 + allocations.length + 10,
            label: header,
            quantity: qty,
          });
        });

        if (allocations.length === 0 && quantity > 0) {
          allocations.push({ id: Date.now() + index * 1000 + 1, label: '默认', quantity });
        }
        if (allocations.length === 0) {
          allocations.push({ id: Date.now() + index * 1000 + 2, label: '默认', quantity: 1 });
        }

        if (!designNumber && !windowType && !productName) return [];

        return [{
          id: Date.now() + index,
          windowType,
          designNumber,
          shape,
          importedProductName: productName,
          params: { width, height, heightLeft, heightRight, diameter, manualArea },
          productId: product?.id || '',
          accessories,
          allocations,
        }];
      });

      if (importedWindows.length === 0) throw new Error('模板中没有可导入的数据行');

      notifications.update({
        id: 'import-template',
        title: '模板解析完成',
        message: `已识别 ${importedWindows.length} 条窗型数据${unmatchedProducts.size || unmatchedAccessories.size ? `，未完全匹配 ${unmatchedProducts.size + unmatchedAccessories.size} 项` : ''}，请确认后导入`,
        color: 'blue',
        icon: <IconCheck size={18} />,
        loading: false,
        autoClose: 2500,
      });
      setImportPreview({
        opened: true,
        windows: importedWindows,
        fileName: file.name,
      });
      setBulkImportMapping({});
      setBulkAccessoryMapping({});
    } catch (err: any) {
      notifications.update({
        id: 'import-template',
        title: '导入失败',
        message: err?.message || '无法解析该文件，请优先使用系统导出的模板',
        color: 'red',
        icon: <IconX size={18} />,
        loading: false,
        autoClose: 5000,
      });
    }
  };

  const handleImportTemplateSelect = (file: File | null) => {
    if (!file) return;
    setPendingImportFile(file);
    setImportSetupOpened(true);
  };

  const handleConfirmImportSetup = async () => {
    if (!projectId) {
      notifications.show({ title: '导入失败', message: '请先选择归属报价项目', color: 'red' });
      return;
    }
    if (!sheetName.trim()) {
      notifications.show({ title: '导入失败', message: '请先填写工作表名', color: 'red' });
      return;
    }
    const file = pendingImportFile;
    setImportSetupOpened(false);
    setPendingImportFile(null);
    await handleImportTemplate(file);
  };

  return (
    <PageScaffold title="窗型测算" description="在这里选组合、录尺寸、看每樘窗的成本价和销售价" actions={
      <Group gap="sm">
        <Button variant="subtle" size="sm" color="orange" leftSection={<IconRotateClockwise size={16}/>} onClick={() => {
          modals.openConfirmModal({ title: '重置确认', children: <Text size="sm">确定清空当前录入的数据吗？</Text>, labels: { confirm: '确认清空', cancel: '取消' }, onConfirm: clearAnalysisDraft });
        }}>清空重置</Button>
        <FileButton onChange={handleImportTemplateSelect} accept=".xlsx,.xls,.xlsm,.xlsb,.csv,.ods,.numbers">
          {(props) => (
            <Button {...props} variant="subtle" size="sm" color="blue" leftSection={<IconFileUpload size={16}/>}>
              模板导入
            </Button>
          )}
        </FileButton>
        <Button
          variant="subtle"
          size="sm"
          color="gray"
          leftSection={<IconDownload size={16}/>}
          onClick={async () => {
            const { downloadCalculationTemplate } = await loadExcelExportUtils();
            await downloadCalculationTemplate(products, materials);
          }}
        >
          模板下载
        </Button>
        <Button color="teal" size="sm" onClick={handleSave} loading={createRecord.isPending} leftSection={<IconDeviceFloppy size={16}/>}>保存到工作表</Button>
      </Group>
    }>
      <Stack h="100%" gap="sm">
        <div className="app-stat-grid">
          <div className="app-stat-card">
            <div className="app-stat-label">当前草稿</div>
            <div className="app-stat-value">{windows.length}</div>
            <div className="app-stat-note">已录入的窗型条目数</div>
          </div>
          <div className="app-stat-card">
            <div className="app-stat-label">已选条目</div>
            <div className="app-stat-value">{selectedWinIds.length}</div>
            <div className="app-stat-note">可批量设置所属类型</div>
          </div>
          <div className="app-stat-card">
            <div className="app-stat-label">工程总面积</div>
            <div className="app-stat-value">{fullCalculation.totalArea.toFixed(1)}</div>
            <div className="app-stat-note">按当前草稿汇总，单位为平方米</div>
          </div>
          <div className="app-stat-card">
            <div className="app-stat-label">预估净利润</div>
            <div className="app-stat-value">{fullCalculation.profit.toFixed(0)}</div>
            <div className="app-stat-note">销售减成本后的当前估算值</div>
          </div>
        </div>

      <Group align="stretch" h="100%" gap="xs" wrap="nowrap">
        <Box style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <Paper
            withBorder
            radius="xl"
            mb="xs"
            className="app-surface app-section"
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxShadow: '0 14px 36px rgba(15, 23, 42, 0.06)',
            }}
          >
            <div className="app-section-header">
              <Group justify="space-between" align="flex-start" wrap="nowrap">
                <Box style={{ minWidth: 0 }}>
                  <Group gap="xs" mb={6}>
                    <IconHierarchy2 size={18} color="#087f5b" />
                    <Text fw={800} size="sm" c="teal.9">工作表录入区</Text>
                  </Group>
                  <Text size="xs" c="dimmed">仅优化左侧录入结构，按“项目 / 工作表 / 窗型明细”组织，减少横向拥挤。</Text>
                </Box>
                <Button size="sm" color="teal" radius="xl" leftSection={<IconPlus size={16}/>} onClick={()=>{
                  const newId = Date.now();
                  setAnalysisDraft({ windows: [{ id: newId, windowType: '', designNumber: '', shape: 'RECTANGLE', params: { width: 1500, height: 1500, manualArea: 0 }, productId: '', accessories: [], allocations: [{id:Date.now()+1, label:'1F', quantity:1}] }, ...windows] });
                  setActiveWinId(newId);
                }}>新增窗型</Button>
              </Group>
            </div>

            <Box px="lg" py="md" style={{ borderBottom: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.76)', backdropFilter: 'blur(8px)' }}>
              <Stack gap="sm">
                <Group align="flex-end" gap="md" wrap="wrap">
                  <Select
                    label="归属报价项目"
                    placeholder="选择报价中心项目"
                    size="sm"
                    w={280}
                    data={unfinishedProjects.map(p=>({value:p.id!, label:p.name}))}
                    value={projectId}
                    onChange={(v)=>setAnalysisDraft({projectId: v})}
                    clearable
                    searchable
                    nothingFoundMessage="没有匹配的未完成项目"
                    styles={{ label: { fontWeight: 800, marginBottom: 6 }, input: { background: '#fff' } }}
                  />
                  <TextInput
                    label="工作表名"
                    placeholder="如：1#楼南立面"
                    size="sm"
                    w={240}
                    value={sheetName}
                    onChange={(e)=>setAnalysisDraft({sheetName: e.target.value})}
                    styles={{ label: { fontWeight: 800, marginBottom: 6 }, input: { background: '#fff' } }}
                  />
                  <Paper
                    radius="lg"
                    px="sm"
                    py={8}
                    style={{
                      marginLeft: 'auto',
                      minWidth: 180,
                      background: '#ffffff',
                      border: '1px solid var(--border-color)',
                    }}
                  >
                    <Text size="10px" tt="uppercase" fw={800} c="dimmed">当前草稿</Text>
                    <Group gap="md" mt={4}>
                      <Box>
                        <Text size="lg" fw={900} c="teal.8">{windows.length}</Text>
                        <Text size="10px" c="dimmed">窗型行</Text>
                      </Box>
                      <Box>
                        <Text size="lg" fw={900} c="blue.8">{selectedWinIds.length}</Text>
                        <Text size="10px" c="dimmed">已选中</Text>
                      </Box>
                    </Group>
                  </Paper>
                </Group>

                {selectedWinIds.length > 0 && (
                  <div className="selection-strip">
                    <Group gap="xs" wrap="wrap">
                      <Badge color="teal" variant="light">已选 {selectedWinIds.length} 项</Badge>
                      <TextInput placeholder="输入所属类型" size="xs" w={160} value={bulkType} onChange={(e)=>setBulkType(e.target.value)} styles={{ input: { background: '#fff' } }} />
                      <Button size="xs" radius="xl" leftSection={<IconCheck size={14}/>} onClick={handleApplyBulkType}>设为选中类型</Button>
                    </Group>
                  </div>
                )}
              </Stack>
            </Box>

            <Box style={{ flex: 1, overflow: 'hidden', background: '#f8fbf8' }}>
              <ScrollArea h="100%">
                <Stack gap="md" p="md">
                  <div className="page-toolbar">
                    <Group justify="space-between" wrap="wrap">
                      <Group gap="xs">
                        <Checkbox size="sm" checked={windows.length > 0 && selectedWinIds.length === windows.length} indeterminate={selectedWinIds.length > 0 && selectedWinIds.length < windows.length} onChange={(e)=>setSelectedWinIds(e.currentTarget.checked ? windows.map(w=>w.id) : [])} />
                        <Text size="sm" fw={800}>按窗型分组展示</Text>
                      </Group>
                      <Group gap="md">
                      <Text size="xs" c="dimmed">分组数 {groupedWindows.length}</Text>
                        <Text size="xs" c="dimmed">当前 {filteredWindows.length} / 总窗型 {windows.length}</Text>
                        <Text size="xs" c="dimmed">第 {currentPage}/{totalPages} 页</Text>
                      </Group>
                    </Group>
                    <TextInput
                      mt="sm"
                      size="xs"
                      placeholder="按类型搜索，例如：平开窗、推拉窗"
                      value={typeSearch}
                      onChange={(e) => {
                        setTypeSearch(e.currentTarget.value);
                        setCurrentPage(1);
                      }}
                    />
                  </div>

                  {groupedWindows.map((group) => (
                    <Paper key={group.groupName} withBorder radius="xl" p="sm" className="app-surface">
                      <Stack gap="sm">
                        <Group justify="space-between" wrap="wrap">
                          <Group gap="xs">
                            <Badge color="teal" variant="light">{group.groupName}</Badge>
                            <Text size="sm" fw={700}>{group.items.length} 个窗型</Text>
                          </Group>
                          <Text size="xs" c="dimmed">分组总数量 {group.totalCount}</Text>
                        </Group>

                        <Stack gap="sm">
                          {group.items.map((win) => (
                            <AnalysisWindowCard
                              key={win.id}
                              win={win}
                              isActive={activeWinId === win.id}
                              isSelected={selectedWinIds.includes(win.id)}
                              totalQuantity={quantitiesById.get(win.id)}
                              categories={categories}
                              products={products}
                              materials={materials}
                              onActivate={setActiveWinId}
                              onToggleSelected={toggleSelectedWindow}
                              onUpdateWindow={updateWindow}
                              onDeleteWindow={handleDeleteWindow}
                            />
                          ))}
                        </Stack>
                      </Stack>
                    </Paper>
                  ))}

                  {filteredWindows.length === 0 && (
                    <Paper withBorder radius="xl" p="xl" ta="center" bg="#ffffff">
                      <Stack gap="xs" align="center">
                        <IconHierarchy2 size={28} color="#94a3b8" />
                        <Text size="sm" fw={700}>{windows.length === 0 ? '还没有窗型' : '没有匹配的类型'}</Text>
                        <Text size="xs" c="dimmed">{windows.length === 0 ? '先在上方点击“新增窗型”，再按卡片方式逐项完善。' : '换个类型关键词试试，或清空搜索条件。'}</Text>
                      </Stack>
                    </Paper>
                  )}

                  {filteredWindows.length > pageSize && (
                    <Group justify="center" pt="xs">
                      <Pagination value={currentPage} onChange={setCurrentPage} total={totalPages} color="teal" radius="xl" />
                    </Group>
                  )}
                </Stack>
              </ScrollArea>
            </Box>
          </Paper>
        </Box>

        {/* 右侧：看板 */}
        <Box style={{ width: 440, display: 'flex', flexDirection: 'column' }}>
          <Paper withBorder radius="md" p="md" mb="xs" shadow="md" className="app-surface" style={{ background: 'linear-gradient(135deg, #0ca678 0%, #099268 100%)', color: '#fff' }}>
            <Title order={6} mb="md" style={{ color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}><IconCalculator size={20}/>工程全案汇总核算</Title>
            <SimpleGrid cols={2} spacing="lg">
              <Box><Text size="xs" opacity={0.8}>工程总面积</Text><Text fw={900} size="22px">{fullCalculation.totalArea.toFixed(3)} ㎡</Text></Box>
              <Box ta="right"><Text size="xs" opacity={0.8}>预估净利润</Text><Text fw={900} size="22px" c="yellow.2">¥ {fullCalculation.profit.toFixed(0)}</Text></Box>
              <Box><Text size="xs" opacity={0.8}>预估总成本</Text><Text fw={700} size="lg">¥ {fullCalculation.totalCost.toFixed(0)}</Text></Box>
              <Box ta="right"><Text size="xs" opacity={0.8}>预估总销售</Text><Text fw={700} size="lg">¥ {fullCalculation.totalRetail.toFixed(0)}</Text></Box>
            </SimpleGrid>
            <Divider my="md" color="rgba(255,255,255,0.2)" />
            <Group justify="space-between" align="center">
              <Box><Text size="xs" opacity={0.8}>预估综合毛利率</Text><Text fw={900} size="28px" c="yellow.2">{((fullCalculation.profit / (fullCalculation.totalRetail || 1)) * 100).toFixed(1)}%</Text></Box>
              <Badge size="xl" color="white" variant="white" styles={{ label: { color: '#099268', fontWeight: 900 } }}>均价: ¥{(fullCalculation.totalRetail / (fullCalculation.totalArea || 1)).toFixed(0)}/㎡</Badge>
            </Group>
          </Paper>

          <Paper withBorder radius="md" p={0} className="app-surface app-section" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
            <Box p="sm" style={{ background: '#f8f9fa', borderBottom: '1px solid var(--border-color)' }}>
                <Group justify="space-between">
                  <Group gap="xs"><IconListDetails size={20} color="teal" /><Text fw={900} size="sm">{activeWin ? `[${activeWin.designNumber}] 明细` : '点击左侧行查看明细'}</Text></Group>
                {activeWin && <Badge color="teal" variant="light">面积:{activeWin.area.toFixed(2)}㎡</Badge>}
              </Group>
            </Box>
            <ScrollArea style={{ flex: 1 }}>
              {activeWin ? (
                <Stack gap={0}>
                  <Box p="md" style={{ background: '#ffffff', borderBottom: '1px solid #eef2f7' }}>
                    <SimpleGrid cols={2} spacing="sm">
                      <Paper withBorder radius="md" p="sm">
                        <Text size="10px" c="dimmed" fw={800}>当前窗型最贵的分项</Text>
                        <Text fw={900} size="lg" c={activeWinBreakdown[0] ? `${activeWinBreakdown[0].color}.7` : 'dark'}>
                          {activeWinBreakdown[0]?.label || '暂无'}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {activeWinBreakdown[0] ? `占成本 ${activeWinBreakdown[0].share.toFixed(1)}%` : '请先选择组合'}
                        </Text>
                      </Paper>
                      <Paper withBorder radius="md" p="sm">
                        <Text size="10px" c="dimmed" fw={800}>最影响成本的材料/配件</Text>
                        <Text fw={900} size="lg" truncate>{activeWinTopDrivers[0]?.name || '暂无'}</Text>
                        <Text size="xs" c="dimmed">
                          {activeWinTopDrivers[0] ? `占成本 ${activeWinTopDrivers[0].share.toFixed(1)}%` : '请先选择组合'}
                        </Text>
                      </Paper>
                    </SimpleGrid>
                  </Box>

                  <Box p="md" style={{ background: '#fffaf0', borderBottom: '1px solid #f3e8d7' }}>
                    <Group gap={4} mb={12}><IconCalculator size={16} color="#d97706" /><Text size="xs" fw={900} c="orange.9">0. 造价拆解</Text></Group>
                    {activeWinBreakdown.length > 0 ? (
                      <Stack gap={8}>
                        {activeWinBreakdown.map((item) => (
                          <Paper key={item.key} withBorder radius="md" p="sm" style={{ background: '#fff' }}>
                            <Group justify="space-between" align="flex-start" wrap="nowrap">
                              <Box>
                                <Badge color={item.color} variant="light">{item.label}</Badge>
                                <Text size="xs" c="dimmed" mt={6}>单方成本占比 {item.share.toFixed(1)}%</Text>
                              </Box>
                              <Text fw={800} size="sm" c="teal">¥{item.cost.toFixed(1)}/㎡</Text>
                            </Group>
                          </Paper>
                        ))}
                      </Stack>
                    ) : (
                      <Center py="md"><Text size="xs" c="dimmed">当前窗型还没有可分析的成本构成</Text></Center>
                    )}
                  </Box>

                  <Box px="md" py={6} style={{ background: '#343a40', color: '#fff' }}>
                    <Group justify="space-between" wrap="nowrap">
                      <Text size="10px" fw={700} style={{ flex: 1 }}>構成成分明细项</Text>
                      <Group gap={30} w={160} justify="flex-end"><Text size="10px" fw={700}>成本/㎡</Text><Text size="10px" fw={700}>销售/㎡</Text></Group>
                    </Group>
                  </Box>
                  <Box p="md" style={{ background: '#f0fff4' }}>
                    <Group gap={4} mb={12}><IconBox size={16} color="teal"/><Text size="xs" fw={900} c="teal.9">1. 产品组合深度構成</Text></Group>
                    <Stack gap={10}>
                      {activeWin.compDetails.map((det: any, idx: number) => (
                        <Group key={idx} justify="space-between" wrap="nowrap">
                          <Box style={{ flex: 1 }}><Text size="sm" fw={600} truncate>{det.name}</Text><Text size="9px" c="dimmed">逻辑: {det.mode==='area'?'按面积':det.mode==='perimeter'?'按周长':'固定'}</Text></Box>
                          <Group gap={20} w={160} justify="flex-end"><Text size="sm" fw={800} c="teal">¥{det.cost.toFixed(1)}</Text><Text size="sm" fw={800} c="blue">¥{det.retail.toFixed(1)}</Text></Group>
                        </Group>
                      ))}
                    </Stack>
                  </Box>
                  <Divider />
                  <Box p="md">
                    <Group gap={4} mb={12}><IconTools size={16} color="blue"/><Text size="xs" fw={900} c="blue.9">2. 额外叠加配件明细</Text></Group>
                    {activeWin.accDetails.length > 0 ? (
                      <Stack gap={10}>
                        {activeWin.accDetails.map((det: any, idx: number) => (
                          <Group key={idx} justify="space-between" wrap="nowrap">
                            <Box style={{ flex: 1 }}><Text size="sm" fw={600} truncate>{det.name}</Text><Text size="10px" c="dimmed">叠加: {det.qty} {det.unit}</Text></Box>
                            <Group gap={20} w={160} justify="flex-end"><Text size="sm" fw={800} c="teal">¥{det.cost.toFixed(1)}</Text><Text size="sm" fw={800} c="blue">¥{det.retail.toFixed(1)}</Text></Group>
                          </Group>
                        ))}
                      </Stack>
                    ) : <Center py="xl"><Text size="xs" c="dimmed">无额外配件</Text></Center>}
                  </Box>
                  <Box p="md" mt="auto" style={{ borderTop: '2px solid #eee', background: '#fff' }}>
                    <Group justify="space-between" mb={10}><Text size="xs" fw={900} c="dimmed">单窗最终核算对比 (¥/㎡)</Text><Badge variant="filled" color="orange" size="sm">利润率:{(( (activeWin.unitRetailPrice - activeWin.unitPrice) / (activeWin.unitRetailPrice || 1) ) * 100).toFixed(1)}%</Badge></Group>
                    <Group justify="space-between" align="center" p="sm" style={{ background: '#f8f9fa', borderRadius: 8, border: '1px solid #eee' }}>
                      <Box><Text size="10px" c="dimmed" fw={800}>单位综合成本</Text><Text fw={900} size="26px" c="teal">¥{activeWin.unitPrice.toFixed(1)}</Text></Box>
                      <IconArrowRight size={24} color="#dee2e6" />
                      <Box ta="right"><Text size="10px" c="dimmed" fw={800}>单位建议销售</Text><Text fw={900} size="26px" c="blue">¥{activeWin.unitRetailPrice.toFixed(1)}</Text></Box>
                    </Group>
                  </Box>
                </Stack>
              ) : (
                <Center h={300}><Stack align="center" gap="md"><IconListDetails size={64} color="#e9ecef" /><Text size="sm" c="dimmed" fw={700}>请选择左侧任意窗型行<br/>查看双价明细对比</Text></Stack></Center>
              )}
            </ScrollArea>
          </Paper>
        </Box>
      </Group>
      </Stack>

      <Modal
        opened={importSetupOpened}
        onClose={() => {
          setImportSetupOpened(false);
          setPendingImportFile(null);
        }}
        title="导入到工作表"
        centered
        size="lg"
      >
        <Stack gap="md">
          <Paper withBorder radius="xl" p="md" style={{ background: 'linear-gradient(135deg, rgba(20,184,166,0.08) 0%, rgba(255,255,255,1) 100%)' }}>
            <Text size="xs" c="dimmed">待导入文件</Text>
            <Text fw={800} size="sm" mt={4}>{pendingImportFile?.name || '未选择文件'}</Text>
          </Paper>
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
            <Select
              label="归属报价项目"
              placeholder="选择未完成报价项目"
              data={unfinishedProjects.map((project) => ({ value: project.id!, label: project.name }))}
              value={projectId}
              onChange={(value) => setAnalysisDraft({ projectId: value })}
              searchable
              clearable
              nothingFoundMessage="没有匹配的未完成项目"
            />
            <TextInput
              label="工作表名"
              placeholder="例如：1#楼南立面"
              value={sheetName}
              onChange={(event) => setAnalysisDraft({ sheetName: event.currentTarget.value })}
            />
          </SimpleGrid>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => {
              setImportSetupOpened(false);
              setPendingImportFile(null);
            }}>
              取消
            </Button>
            <Button color="teal" onClick={handleConfirmImportSetup}>
              下一步：导入预览
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={importPreview.opened}
        onClose={() => {
          setImportPreview((prev) => ({ ...prev, opened: false }));
          setBulkImportMapping({});
          setBulkAccessoryMapping({});
          setImportPreviewFilter('all');
        }}
        title="导入预览"
        centered
        size="85%"
        overlayProps={{ backgroundOpacity: 0.2, blur: 10 }}
        styles={{
          content: {
            background: 'rgba(248, 250, 252, 0.76)',
            backdropFilter: 'blur(18px)',
            WebkitBackdropFilter: 'blur(18px)',
            border: '1px solid rgba(255,255,255,0.58)',
            boxShadow: '0 28px 90px rgba(15, 23, 42, 0.2)',
          },
        }}
      >
        <Stack gap="md">
          {(() => {
            const unmatchedNames = Array.from(new Set(filteredImportPreviewWindows.filter((item) => !item.productId && item.importedProductName).map((item) => item.importedProductName)));
            const unmatchedAccessoryNames = Array.from(new Set(filteredImportPreviewWindows.flatMap((item) => (item.accessories || []).filter((accessory: any) => !accessory.materialId && accessory.importedMaterialName).map((accessory: any) => accessory.importedMaterialName))));
            return (
          <Paper withBorder radius="xl" p="xl" style={{ background: 'linear-gradient(135deg, rgba(20,184,166,0.12) 0%, rgba(240,253,250,0.92) 36%, rgba(255,255,255,0.84) 100%)', borderColor: 'rgba(255,255,255,0.58)' }}>
            <Group justify="space-between" align="flex-start" wrap="nowrap">
              <Box>
                <Group gap="sm" mb={6} wrap="wrap">
                  <Text fw={900} size="xl">导入预览</Text>
                  {importPreviewSummary.productPendingCount > 0 ? (
                    <Badge color="red" variant="filled">需处理组合</Badge>
                  ) : importPreviewSummary.accessoryPendingCount > 0 ? (
                    <Badge color="orange" variant="filled">需处理配件</Badge>
                  ) : (
                    <Badge color="teal" variant="filled">可直接导入</Badge>
                  )}
                </Group>
                <Text size="sm" c="dimmed">确认项目、工作表、组合和配件映射后，再导入到当前计算草稿。</Text>
                <Group gap="sm" mt="md" wrap="wrap">
                  <Badge color="teal" variant="light">项目：{unfinishedProjects.find((project) => project.id === projectId)?.name || '未选择'}</Badge>
                  <Badge color="blue" variant="light">工作表：{sheetName || '未填写'}</Badge>
                </Group>
              </Box>
              <Stack gap="sm" align="stretch" style={{ minWidth: 280 }}>
                <Paper
                  radius="lg"
                  px="md"
                  py="sm"
                  withBorder
                  style={{
                    background: importPreviewSummary.productPendingCount > 0
                      ? 'linear-gradient(135deg, rgba(254,226,226,0.96) 0%, rgba(255,255,255,0.9) 100%)'
                      : importPreviewSummary.accessoryPendingCount > 0
                        ? 'linear-gradient(135deg, rgba(255,237,213,0.96) 0%, rgba(255,255,255,0.9) 100%)'
                        : 'linear-gradient(135deg, rgba(220,252,231,0.96) 0%, rgba(255,255,255,0.9) 100%)',
                    borderColor: importPreviewSummary.productPendingCount > 0
                      ? 'rgba(220,38,38,0.22)'
                      : importPreviewSummary.accessoryPendingCount > 0
                        ? 'rgba(245,158,11,0.22)'
                        : 'rgba(5,150,105,0.22)',
                  }}
                >
                  <Text size="xs" c="dimmed">当前导入状态</Text>
                  <Text
                    fw={900}
                    size="lg"
                    mt={4}
                    c={
                      importPreviewSummary.productPendingCount > 0
                        ? 'red.7'
                        : importPreviewSummary.accessoryPendingCount > 0
                          ? 'orange.7'
                          : 'teal.7'
                    }
                  >
                    {importPreviewSummary.productPendingCount > 0
                      ? `还有 ${importPreviewSummary.productPendingCount} 条组合待处理`
                      : importPreviewSummary.accessoryPendingCount > 0
                        ? `还有 ${importPreviewSummary.accessoryPendingCount} 个配件待处理`
                        : '当前内容可直接导入'}
                  </Text>
                  {firstPendingImportId && (
                    <Button
                      size="xs"
                      mt="sm"
                      variant="light"
                      color={importPreviewSummary.productPendingCount > 0 ? 'red' : 'orange'}
                      onClick={() => {
                        importCardRefs.current[firstPendingImportId]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      }}
                    >
                      跳到首个待处理项
                    </Button>
                  )}
                </Paper>
                <Paper radius="lg" px="md" py="sm" withBorder style={{ background: 'rgba(255,255,255,0.78)' }}>
                  <Text size="xs" c="dimmed">文件来源</Text>
                  <Text fw={800} size="sm" mt={4} truncate>{importPreview.fileName || '-'}</Text>
                </Paper>
              </Stack>
            </Group>

            <SimpleGrid cols={{ base: 2, xl: 5 }} spacing="sm" mt="lg">
              <Card withBorder radius="xl" padding="md">
                <Text size="xs" c="dimmed">窗型条数</Text>
                <Text fw={900} size="xl">{importPreviewSummary.windowCount}</Text>
              </Card>
              <Card withBorder radius="xl" padding="md">
                <Text size="xs" c="dimmed">已匹配组合</Text>
                <Text fw={900} size="xl" c="teal.7">{importPreviewSummary.matchedProductCount}</Text>
              </Card>
              <Card withBorder radius="xl" padding="md">
                <Text size="xs" c="dimmed">未匹配组合</Text>
                <Text fw={900} size="xl" c={importPreviewSummary.productPendingCount > 0 ? 'red.7' : 'gray.7'}>{importPreviewSummary.productPendingCount}</Text>
              </Card>
              <Card withBorder radius="xl" padding="md">
                <Text size="xs" c="dimmed">未匹配配件</Text>
                <Text fw={900} size="xl" c={importPreviewSummary.accessoryPendingCount > 0 ? 'orange.7' : 'gray.7'}>{importPreviewSummary.accessoryPendingCount}</Text>
              </Card>
              <Card withBorder radius="xl" padding="md">
                <Text size="xs" c="dimmed">待确认项</Text>
                <Text fw={900} size="xl">{importPreviewSummary.totalPendingCount}</Text>
              </Card>
            </SimpleGrid>
          </Paper>
            );
          })()}

          {Array.from(new Set(importPreview.windows.filter((item) => !item.productId && item.importedProductName).map((item) => item.importedProductName))).length > 0 && (
            <Paper withBorder radius="xl" p="md" bg="#fff5f5">
              <Text size="sm" fw={700} c="red.7" mb={6}>以下组合未匹配成功</Text>
              <Text size="xs" c="dimmed">
                {Array.from(new Set(importPreview.windows.filter((item) => !item.productId && item.importedProductName).map((item) => item.importedProductName))).join('、')}
              </Text>
            </Paper>
          )}

          {Array.from(new Set(importPreview.windows.flatMap((item) => (item.accessories || []).filter((accessory: any) => !accessory.materialId && accessory.importedMaterialName).map((accessory: any) => accessory.importedMaterialName)))).length > 0 && (
            <Paper withBorder radius="xl" p="md" bg="#fff8f1">
              <Text size="sm" fw={700} c="orange.7" mb={6}>以下配件材料未匹配成功</Text>
              <Text size="xs" c="dimmed">
                {Array.from(new Set(importPreview.windows.flatMap((item) => (item.accessories || []).filter((accessory: any) => !accessory.materialId && accessory.importedMaterialName).map((accessory: any) => accessory.importedMaterialName)))).join('、')}
              </Text>
            </Paper>
          )}

          {(() => {
            const unmatchedNames = Array.from(new Set(importPreview.windows.filter((item) => !item.productId && item.importedProductName).map((item) => item.importedProductName)));
            if (unmatchedNames.length === 0) return null;
            return (
              <Paper withBorder radius="xl" p="md" bg="#f8fbff">
                <Stack gap="sm">
                  <Text size="sm" fw={700} c="blue.7">批量映射未匹配组合</Text>
                  <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
                    {unmatchedNames.map((name) => (
                      <Select
                        key={name}
                        size="xs"
                        label={name}
                        placeholder="为这个导入组合选择系统组合"
                        data={products.map((product) => ({ value: product.id!, label: product.name }))}
                        value={bulkImportMapping[name] || null}
                        onChange={(value) => {
                          setBulkImportMapping((prev) => ({ ...prev, [name]: value || '' }));
                          if (!value) return;
                          setImportPreview((prev) => ({
                            ...prev,
                            windows: prev.windows.map((entry) => entry.importedProductName === name ? { ...entry, productId: value } : entry),
                          }));
                        }}
                        searchable
                        clearable
                      />
                    ))}
                  </SimpleGrid>
                </Stack>
              </Paper>
            );
          })()}

          {(() => {
            const unmatchedAccessoryNames = Array.from(new Set(importPreview.windows.flatMap((item) => (item.accessories || []).filter((accessory: any) => !accessory.materialId && accessory.importedMaterialName).map((accessory: any) => accessory.importedMaterialName))));
            if (unmatchedAccessoryNames.length === 0) return null;
            return (
              <Paper withBorder radius="xl" p="md" bg="#fffaf0">
                <Stack gap="sm">
                  <Text size="sm" fw={700} c="orange.7">批量映射未匹配配件</Text>
                  <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
                    {unmatchedAccessoryNames.map((name) => (
                      <Select
                        key={name}
                        size="xs"
                        label={name}
                        placeholder="为这个导入配件选择系统材料"
                        data={materials.map((material) => ({ value: material.id!, label: `${categoryNameById.get(material.categoryId) || '未分类'} / ${material.name}` }))}
                        value={bulkAccessoryMapping[name] || null}
                        onChange={(value) => {
                          setBulkAccessoryMapping((prev) => ({ ...prev, [name]: value || '' }));
                          const material = materials.find((entry) => entry.id === value);
                          if (!material) return;
                          setImportPreview((prev) => ({
                            ...prev,
                            windows: prev.windows.map((entry) => ({
                              ...entry,
                              accessories: (entry.accessories || []).map((accessory: any) => (
                                accessory.importedMaterialName === name
                                  ? buildImportedAccessory(material, accessory.importedMaterialName, accessory.importedCategoryName, accessory.quantity, accessory.id)
                                  : accessory
                              )),
                            })),
                          }));
                        }}
                        searchable
                        clearable
                      />
                    ))}
                  </SimpleGrid>
                </Stack>
              </Paper>
            );
          })()}

          <Paper withBorder radius="xl" p="md" style={{ background: 'rgba(255,255,255,0.88)' }}>
            <Group justify="space-between" align="center" mb="sm">
              <Group gap="sm">
                <Text fw={800} size="sm">导入明细预览</Text>
                <Badge color="gray" variant="light">显示前 12 条</Badge>
              </Group>
              <SegmentedControl
                size="xs"
                value={importPreviewFilter}
                onChange={(value) => setImportPreviewFilter(value as 'all' | 'pending' | 'product_pending' | 'accessory_pending')}
                data={[
                  { value: 'all', label: '全部' },
                  { value: 'pending', label: '全部待处理' },
                  { value: 'product_pending', label: '组合待处理' },
                  { value: 'accessory_pending', label: '配件待处理' },
                ]}
              />
            </Group>
            <SimpleGrid cols={{ base: 1, xl: 2 }} spacing="md">
              {filteredImportPreviewWindows.slice(0, 12).map((item) => {
                const unresolvedProduct = !item.productId && item.importedProductName;
                const unresolvedAccessoryCount = (item.accessories || []).filter((accessory: any) => !accessory.materialId && accessory.importedMaterialName).length;
                const resolvedAccessoryCount = (item.accessories || []).filter((accessory: any) => accessory.materialId).length;
                const cardTone = unresolvedProduct || unresolvedAccessoryCount > 0
                  ? {
                      borderColor: unresolvedProduct ? 'rgba(220, 38, 38, 0.28)' : 'rgba(245, 158, 11, 0.3)',
                      background: unresolvedProduct
                        ? 'linear-gradient(180deg, rgba(255,245,245,1) 0%, rgba(255,255,255,0.96) 100%)'
                        : 'linear-gradient(180deg, rgba(255,247,237,1) 0%, rgba(255,255,255,0.96) 100%)',
                    }
                  : {
                      borderColor: 'rgba(5, 150, 105, 0.22)',
                      background: 'linear-gradient(180deg, rgba(240,253,244,1) 0%, rgba(255,255,255,0.96) 100%)',
                    };

                return (
                <Paper
                  key={item.id}
                  ref={(node) => {
                    importCardRefs.current[item.id] = node;
                  }}
                  withBorder
                  radius="xl"
                  p="md"
                  style={cardTone}
                >
                  <Stack gap="sm">
                    <Group justify="space-between" align="flex-start" wrap="nowrap">
                      <Box style={{ minWidth: 0, flex: 1 }}>
                        <Group gap="xs" mb={6} wrap="wrap">
                          <Badge color="teal" variant="light">{item.windowType || '未分类'}</Badge>
                          <Badge color="gray" variant="outline">{SHAPES.find((shape) => shape.value === item.shape)?.label || item.shape}</Badge>
                        </Group>
                        <Text fw={900} size="md">{item.designNumber || '未命名窗型'}</Text>
                      </Box>
                      <Stack gap={6} align="flex-end">
                        <Badge color="blue" variant="light">分配 {item.allocations?.length || 0}</Badge>
                        {unresolvedProduct ? (
                          <Badge color="red" variant="filled">组合待处理</Badge>
                        ) : unresolvedAccessoryCount > 0 ? (
                          <Badge color="orange" variant="filled">配件待处理 {unresolvedAccessoryCount}</Badge>
                        ) : (
                          <Badge color="teal" variant="filled">已完成映射</Badge>
                        )}
                      </Stack>
                    </Group>

                    <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
                      <Paper radius="md" p="xs" style={{ background: '#f8fafc' }}>
                        <Text size="10px" tt="uppercase" fw={800} c="dimmed">导入组合</Text>
                        <Text size="xs" fw={700} mt={2}>{item.importedProductName || '未填写'}</Text>
                      </Paper>
                      <Paper radius="md" p="xs" style={{ background: '#f8fafc' }}>
                        <Text size="10px" tt="uppercase" fw={800} c="dimmed">尺寸</Text>
                        <Text size="xs" fw={700} mt={2}>
                          {item.params?.width || 0} × {item.params?.height || 0}
                        </Text>
                      </Paper>
                      <Paper radius="md" p="xs" style={{ background: '#f8fafc' }}>
                        <Text size="10px" tt="uppercase" fw={800} c="dimmed">配件状态</Text>
                        <Text size="xs" fw={700} mt={2}>
                          已匹配 {resolvedAccessoryCount} / 共 {(item.accessories || []).length}
                        </Text>
                      </Paper>
                    </SimpleGrid>

                    <Select
                      size="sm"
                      label="系统组合"
                      placeholder="选择系统组合"
                      data={products.map((product) => ({ value: product.id!, label: product.name }))}
                      value={item.productId || null}
                      onChange={(value) => {
                        setImportPreview((prev) => ({
                          ...prev,
                          windows: prev.windows.map((entry) => entry.id === item.id ? { ...entry, productId: value || '' } : entry),
                        }));
                        if (item.importedProductName) {
                          setBulkImportMapping((prev) => ({ ...prev, [item.importedProductName]: value || '' }));
                        }
                      }}
                      searchable
                      clearable
                    />

                    <Stack gap={6}>
                      <Text size="xs" fw={800} c="dimmed">配件映射</Text>
                      {(item.accessories || []).length > 0 ? (
                        (item.accessories || []).slice(0, 3).map((accessory: any) => (
                          <Paper key={accessory.id} withBorder radius="md" px="xs" py={6} style={{ background: accessory.materialId ? '#f0fdf4' : '#fff7ed' }}>
                            <Group justify="space-between" align="center" wrap="nowrap">
                              <Box style={{ minWidth: 0, flex: 1 }}>
                                <Text size="xs" fw={700} truncate>{accessory.importedMaterialName || accessory.name}</Text>
                                <Text size="10px" c="dimmed" truncate>{accessory.importedCategoryName || '未分类'}</Text>
                              </Box>
                              {accessory.materialId ? (
                                <Badge size="sm" color="teal" variant="light">已匹配</Badge>
                              ) : (
                                <Select
                                  size="xs"
                                  w={180}
                                  placeholder="选择材料"
                                  data={materials.map((material) => ({ value: material.id!, label: `${categoryNameById.get(material.categoryId) || '未分类'} / ${material.name}` }))}
                                  value={accessory.materialId || null}
                                  onChange={(value) => {
                                    const material = materials.find((entry) => entry.id === value);
                                    if (!material) return;
                                    setImportPreview((prev) => ({
                                      ...prev,
                                      windows: prev.windows.map((entry) => (
                                        entry.id === item.id
                                          ? {
                                              ...entry,
                                              accessories: (entry.accessories || []).map((currentAccessory: any) => (
                                                currentAccessory.id === accessory.id
                                                  ? buildImportedAccessory(material, currentAccessory.importedMaterialName, currentAccessory.importedCategoryName, currentAccessory.quantity, currentAccessory.id)
                                                  : currentAccessory
                                              )),
                                            }
                                          : entry
                                      )),
                                    }));
                                    if (accessory.importedMaterialName) {
                                      setBulkAccessoryMapping((prev) => ({ ...prev, [accessory.importedMaterialName]: value || '' }));
                                    }
                                  }}
                                  searchable
                                  clearable
                                />
                              )}
                            </Group>
                          </Paper>
                        ))
                      ) : (
                        <Text size="xs" c="dimmed">无配件</Text>
                      )}
                      {(item.accessories || []).length > 3 && (
                        <Text size="10px" c="dimmed">还有 {(item.accessories || []).length - 3} 项配件未展开</Text>
                      )}
                    </Stack>
                  </Stack>
                </Paper>
              )})}
            </SimpleGrid>
            {filteredImportPreviewWindows.length === 0 && (
              <Center py="xl">
                <Text size="sm" c="dimmed">当前筛选条件下没有待处理项</Text>
              </Center>
            )}
          </Paper>
          {filteredImportPreviewWindows.length > 12 && (
            <Text size="xs" c="dimmed">当前筛选结果仅展示前 12 条，确认后将全部导入当前工作表草稿。</Text>
          )}

          <Group justify="flex-end">
            <Button variant="default" onClick={() => setImportPreview((prev) => ({ ...prev, opened: false }))}>取消</Button>
            <Button
              color={
                importPreview.windows.filter((item) => !item.productId && item.importedProductName).length > 0
                  ? 'red'
                  : importPreview.windows.flatMap((item) => (item.accessories || []).filter((accessory: any) => !accessory.materialId && accessory.importedMaterialName)).length > 0
                    ? 'orange'
                    : 'teal'
              }
              onClick={() => {
                const unresolved = importPreview.windows.filter((item) => !item.productId && item.importedProductName);
                const unresolvedAccessories = importPreview.windows.flatMap((item) => (item.accessories || []).filter((accessory: any) => !accessory.materialId && accessory.importedMaterialName));
                if (unresolved.length > 0) {
                  notifications.show({
                    title: '仍有未匹配组合',
                    message: `还有 ${unresolved.length} 条窗型未选择系统组合，请先处理后再导入`,
                    color: 'orange',
                  });
                  return;
                }
                if (unresolvedAccessories.length > 0) {
                  notifications.show({
                    title: '仍有未匹配配件',
                    message: `还有 ${unresolvedAccessories.length} 个配件材料未匹配，请先处理后再导入`,
                    color: 'orange',
                  });
                  return;
                }
                setAnalysisDraft({
                  projectId,
                  sheetName: sheetName.trim(),
                  windows: importPreview.windows.map(({ importedProductName, ...rest }) => ({
                    ...rest,
                    accessories: (rest.accessories || []).map(({ importedMaterialName, importedCategoryName, ...accessoryRest }: any) => accessoryRest),
                  })),
                });
                setActiveWinId(importPreview.windows[0]?.id || null);
                setSelectedWinIds([]);
                setCurrentPage(1);
                setImportPreview({ opened: false, windows: [], fileName: '' });
                setBulkImportMapping({});
                setBulkAccessoryMapping({});
                setImportPreviewFilter('all');
                notifications.show({
                  title: '导入成功',
                  message: `已导入 ${importPreview.windows.length} 条窗型数据，并自动进入计算`,
                  color: 'teal',
                });
              }}
            >
              {(() => {
                const unresolved = importPreview.windows.filter((item) => !item.productId && item.importedProductName).length;
                const unresolvedAccessories = importPreview.windows.flatMap((item) => (item.accessories || []).filter((accessory: any) => !accessory.materialId && accessory.importedMaterialName)).length;
                if (unresolved > 0) return `仍有 ${unresolved} 条组合待处理`;
                if (unresolvedAccessories > 0) return `仍有 ${unresolvedAccessories} 个配件待处理`;
                return '确认导入并计算';
              })()}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </PageScaffold>
  );
};

export default AnalysisPage;
