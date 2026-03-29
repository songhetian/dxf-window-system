import React, { memo, useDeferredValue, useEffect, useMemo, useState } from 'react';
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Checkbox,
  Group,
  NumberInput,
  Paper,
  ScrollArea,
  SegmentedControl,
  Stack,
  Switch,
  Text,
  TextInput,
  ThemeIcon,
  Title,
} from '@mantine/core';
import {
  IconArrowDown,
  IconArrowUp,
  IconChevronDown,
  IconChevronUp,
  IconDroplet,
  IconGripVertical,
  IconLock,
  IconPlus,
  IconRulerMeasure,
  IconSearch,
  IconSquareRounded,
  IconTool,
  IconTrash,
  IconWindow,
  IconLayersIntersect,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';

import { PageScaffold } from '../components/ui/PageScaffold';
import {
  useCreatePricingProduct,
  useMaterialCategories,
  useMaterialPricingModes,
  useMaterials,
  usePricingProducts,
  useUpdatePricingProduct,
} from '../hooks/useWindowApi';

type CalcMode = 'area' | 'perimeter' | 'fixed';
type PriceView = 'cost' | 'retail';
type ProductDraftItem = {
  localId: string;
  materialId: string;
  calcMode: CalcMode;
  quantity: number;
  includeInComboTotal: boolean;
};

const defaultModeByUnit: Record<string, CalcMode> = {
  area: 'area',
  perimeter: 'perimeter',
  fixed: 'fixed',
};

const laneMeta: Record<CalcMode, { title: string; description: string; color: string; icon: any }> = {
  area: { title: '按平米项', description: '玻璃、面板、面材等按面积展开', color: 'teal', icon: IconSquareRounded },
  perimeter: { title: '按长度项', description: '胶条、压条、边框等按长度换算', color: 'blue', icon: IconRulerMeasure },
  fixed: { title: '按固定项', description: '五金、工艺、辅件等按件数计入', color: 'orange', icon: IconLock },
};

const summaryBadgeMeta: Record<CalcMode, { label: string; color: string }> = {
  area: { label: '平米', color: 'teal' },
  perimeter: { label: '长度', color: 'blue' },
  fixed: { label: '固定', color: 'orange' },
};

const laneTintMap: Record<CalcMode, { bg: string; border: string; emptyBg: string }> = {
  area: { bg: 'rgba(236, 253, 245, 0.76)', border: 'rgba(52, 211, 153, 0.30)', emptyBg: 'rgba(255, 255, 255, 0.78)' },
  perimeter: { bg: 'rgba(239, 246, 255, 0.76)', border: 'rgba(96, 165, 250, 0.30)', emptyBg: 'rgba(255, 255, 255, 0.78)' },
  fixed: { bg: 'rgba(255, 247, 237, 0.78)', border: 'rgba(251, 146, 60, 0.30)', emptyBg: 'rgba(255, 255, 255, 0.80)' },
};

const keywordIconMap = [
  { keywords: ['玻璃'], icon: IconWindow, color: 'cyan' },
  { keywords: ['胶', '密封'], icon: IconDroplet, color: 'blue' },
  { keywords: ['五金', '锁', '执手'], icon: IconLock, color: 'orange' },
  { keywords: ['型材', '框', '铝'], icon: IconLayersIntersect, color: 'teal' },
  { keywords: ['辅料', '配件', '工艺'], icon: IconTool, color: 'grape' },
];

const categoryTintPalette = [
  { bg: 'rgba(239, 246, 255, 0.72)', border: 'rgba(96, 165, 250, 0.30)', chip: 'blue' },
  { bg: 'rgba(236, 253, 245, 0.72)', border: 'rgba(52, 211, 153, 0.30)', chip: 'teal' },
  { bg: 'rgba(255, 247, 237, 0.76)', border: 'rgba(251, 146, 60, 0.30)', chip: 'orange' },
  { bg: 'rgba(250, 245, 255, 0.76)', border: 'rgba(168, 85, 247, 0.24)', chip: 'grape' },
  { bg: 'rgba(254, 242, 242, 0.76)', border: 'rgba(248, 113, 113, 0.24)', chip: 'red' },
  { bg: 'rgba(240, 253, 250, 0.76)', border: 'rgba(45, 212, 191, 0.24)', chip: 'cyan' },
] as const;

const createDraftItem = (materialId: string, calcMode: CalcMode, quantity = 1, includeInComboTotal = false): ProductDraftItem => ({
  localId: `${materialId}-${calcMode}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  materialId,
  calcMode,
  quantity,
  includeInComboTotal,
});

const detectCategoryVisual = (name: string) => {
  const matched = keywordIconMap.find((item) => item.keywords.some((keyword) => name.includes(keyword)));
  return matched || { icon: IconWindow, color: 'gray' };
};

const getExpectedCalcMode = (unitType?: string | null): CalcMode => defaultModeByUnit[unitType || ''] || 'area';

const getCategoryTint = (key: string) => {
  const seed = Array.from(key).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return categoryTintPalette[seed % categoryTintPalette.length];
};

const buildAutoProductName = (
  items: ProductDraftItem[],
  materialMap: Map<string, any>,
) => items
  .map((item) => materialMap.get(item.materialId)?.name?.trim())
  .filter((name): name is string => Boolean(name))
  .join('+');

const deriveProductPricingMode = (items: ProductDraftItem[]): CalcMode => {
  const includedItems = items.filter((item) => item.includeInComboTotal);
  const sourceItems = includedItems.length > 0 ? includedItems : items;
  const modeCount = sourceItems.reduce<Record<CalcMode, number>>((sum, item) => {
    sum[item.calcMode] += 1;
    return sum;
  }, { area: 0, perimeter: 0, fixed: 0 });

  return (['area', 'perimeter', 'fixed'] as const).reduce((current, mode) => (
    modeCount[mode] > modeCount[current] ? mode : current
  ), 'area');
};

const DraftItemCard = memo(({
  item,
  priceView,
  laneColor,
  checked,
  onToggleChecked,
  onToggleInclude,
  onChangeQuantity,
  onMove,
  onRemove,
}: {
  item: any;
  priceView: PriceView;
  laneColor: string;
  checked: boolean;
  onToggleChecked: () => void;
  onToggleInclude: () => void;
  onChangeQuantity: (value: number) => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
}) => {
  const unitPrice = priceView === 'cost' ? (item.material?.costPrice || 0) : (item.material?.retailPrice || 0);

  return (
    <Paper withBorder radius={10} p="sm" bg="#fff">
      <Group justify="space-between" align="center" wrap="nowrap">
        <Group gap="xs" align="center" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
          <Checkbox checked={checked} onChange={onToggleChecked} />
          <ThemeIcon variant="light" color={laneColor} size="sm">
            <IconGripVertical size={14} />
          </ThemeIcon>
          <Box style={{ flex: 1, minWidth: 0 }}>
            <Text fw={700} size="sm" truncate>{item.material?.name || '未命名材料'}</Text>
            <Text size="11px" c="dimmed" truncate>
              {item.category?.name || '未分类'} · {item.material?.unitLabel || '-'} · 单价 {unitPrice.toFixed(2)}
            </Text>
          </Box>
        </Group>

        <Group gap="xs" wrap="nowrap">
          <Switch
            size="sm"
            checked={item.includeInComboTotal}
            onLabel="总价"
            offLabel="排除"
            onChange={onToggleInclude}
          />
          <NumberInput
            size="xs"
            value={item.quantity}
            onChange={(value) => onChangeQuantity(Number(value) || 0.01)}
            min={0.01}
            step={0.1}
            decimalScale={2}
            fixedDecimalScale={false}
            allowNegative={false}
            w={112}
          />
          <ActionIcon size="sm" variant="light" onClick={() => onMove(-1)}>
            <IconArrowUp size={14} />
          </ActionIcon>
          <ActionIcon size="sm" variant="light" onClick={() => onMove(1)}>
            <IconArrowDown size={14} />
          </ActionIcon>
          <ActionIcon size="sm" variant="light" color="red" onClick={onRemove}>
            <IconTrash size={14} />
          </ActionIcon>
        </Group>
      </Group>
    </Paper>
  );
});

const MaterialRow = memo(({
  material,
  categoryName,
  isSelected,
  displayPrice,
  dragIds,
  defaultMode,
  tint,
  onToggle,
  onAdd,
}: {
  material: any;
  categoryName: string;
  isSelected: boolean;
  displayPrice: number;
  dragIds: string[];
  defaultMode: CalcMode;
  tint: { chip: string };
  onToggle: () => void;
  onAdd: (mode: CalcMode) => void;
}) => (
  <Paper
    withBorder
    radius={10}
    p={6}
    bg={isSelected ? 'rgba(219, 234, 254, 0.92)' : 'rgba(255, 255, 255, 0.72)'}
    draggable
    style={{ borderColor: isSelected ? 'rgba(96, 165, 250, 0.42)' : 'rgba(148, 163, 184, 0.18)' }}
    onDragStart={(event) => {
      event.dataTransfer.setData('application/material-ids', JSON.stringify(dragIds));
    }}
    onDoubleClick={() => onAdd(defaultMode)}
  >
    <Group justify="space-between" align="center" wrap="nowrap">
      <Group gap="xs" wrap="nowrap" style={{ minWidth: 0, flex: 1 }}>
        <Checkbox size="xs" checked={isSelected} onChange={onToggle} />
        <Box style={{ minWidth: 0, flex: 1 }}>
          <Text size="xs" fw={700} truncate>{material.name}</Text>
          <Group gap={4} mt={4} wrap="wrap">
            <Badge size="xs" variant="light" color={tint.chip}>{categoryName}</Badge>
            <Badge size="xs" variant="dot" color="gray">{material.unitLabel}</Badge>
            <Badge size="xs" variant="light" color="dark">¥ {displayPrice.toFixed(2)}</Badge>
          </Group>
        </Box>
      </Group>
      <ActionIcon size="xs" variant="light" color="gray" onClick={() => onAdd(defaultMode)}>
        <IconPlus size={14} />
      </ActionIcon>
    </Group>
  </Paper>
));

const ProductsPage = () => {
  const { data: categories = [] } = useMaterialCategories();
  const { data: pricingModes = [] } = useMaterialPricingModes();
  const { data: materials = [] } = useMaterials();
  const { data: products = [] } = usePricingProducts();
  const createProduct = useCreatePricingProduct();
  const updateProduct = useUpdatePricingProduct();

  const [materialKeyword, setMaterialKeyword] = useState('');
  const [productName, setProductName] = useState('');
  const [isProductNameCustomized, setIsProductNameCustomized] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [productItems, setProductItems] = useState<ProductDraftItem[]>([]);
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<string[]>([]);
  const [selectedDraftIds, setSelectedDraftIds] = useState<string[]>([]);
  const [collapsedCategoryIds, setCollapsedCategoryIds] = useState<string[]>([]);
  const [priceView, setPriceView] = useState<PriceView>('retail');
  const [maxPrice, setMaxPrice] = useState<number | ''>('');
  const deferredKeyword = useDeferredValue(materialKeyword);

  useEffect(() => {
    const raw = window.localStorage.getItem('product-builder-load');
    if (!raw || products.length === 0) return;
    try {
      const parsed = JSON.parse(raw) as { productId?: string; copyMode?: boolean };
      const product = products.find((item) => item.id === parsed.productId);
      if (!product) return;
      const loadedName = parsed.copyMode ? `${product.name} 副本` : product.name;
      setEditingProductId(parsed.copyMode ? null : product.id || null);
      setProductName(loadedName);
      setIsProductNameCustomized(Boolean(loadedName.trim()));
      setProductItems(
        product.items
          .slice()
          .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
          .map((item) => ({
            localId: `${item.materialId}-${item.calcMode || 'area'}-${Math.random().toString(36).slice(2, 8)}`,
            materialId: item.materialId,
            calcMode: (item.calcMode as CalcMode) || 'area',
            quantity: item.quantity,
            includeInComboTotal: Boolean(item.includeInComboTotal),
          })),
      );
    } finally {
      window.localStorage.removeItem('product-builder-load');
    }
  }, [products]);

  const materialMap = useMemo(() => new Map(materials.map((item) => [item.id || '', item] as const)), [materials]);
  const categoryMap = useMemo(() => new Map(categories.map((item) => [item.id || '', item] as const)), [categories]);
  const pricingModeMap = useMemo(() => new Map(pricingModes.map((mode) => [mode.id || '', mode] as const)), [pricingModes]);

  const normalizedKeyword = deferredKeyword.trim().toLowerCase();

  const groupedMaterials = useMemo(() => {
    const groups = new Map<string, typeof materials>();
    materials.forEach((item) => {
      const price = priceView === 'cost' ? item.costPrice : item.retailPrice;
      const matchesKeyword = !normalizedKeyword
        || item.name.toLowerCase().includes(normalizedKeyword)
        || (categoryMap.get(item.categoryId)?.name || '').toLowerCase().includes(normalizedKeyword);
      const matchesPrice = maxPrice === '' || price <= Number(maxPrice);
      if (!matchesKeyword || !matchesPrice) return;
      const bucket = groups.get(item.categoryId) || [];
      bucket.push(item);
      groups.set(item.categoryId, bucket);
    });

    return categories
      .map((category) => ({
        category,
        items: groups.get(category.id || '') || [],
      }))
      .filter((group) => group.items.length > 0);
  }, [categories, categoryMap, materials, maxPrice, normalizedKeyword, priceView]);

  const currentItems = useMemo(
    () => productItems.map((item, index) => {
      const material = materialMap.get(item.materialId);
      return {
        ...item,
        index,
        material,
        category: categoryMap.get(material?.categoryId || ''),
      };
    }),
    [categoryMap, materialMap, productItems],
  );

  const autoProductName = useMemo(
    () => buildAutoProductName(productItems, materialMap),
    [materialMap, productItems],
  );

  useEffect(() => {
    if (isProductNameCustomized) return;
    setProductName(autoProductName);
  }, [autoProductName, isProductNameCustomized]);

  const laneItemsMap = useMemo(
    () => ({
      area: currentItems.filter((item) => item.calcMode === 'area'),
      perimeter: currentItems.filter((item) => item.calcMode === 'perimeter'),
      fixed: currentItems.filter((item) => item.calcMode === 'fixed'),
    }),
    [currentItems],
  );
  const selectedMaterialSet = useMemo(() => new Set(selectedMaterialIds), [selectedMaterialIds]);
  const selectedDraftSet = useMemo(() => new Set(selectedDraftIds), [selectedDraftIds]);

  const totalsByMode = useMemo(() => {
    const getPrice = (material: any) => priceView === 'cost' ? (material?.costPrice || 0) : (material?.retailPrice || 0);
    const area = laneItemsMap.area.reduce((sum, item) => sum + (item.includeInComboTotal ? getPrice(item.material) * item.quantity : 0), 0);
    const perimeter = laneItemsMap.perimeter.reduce((sum, item) => sum + (item.includeInComboTotal ? getPrice(item.material) * item.quantity : 0), 0);
    const fixed = laneItemsMap.fixed.reduce((sum, item) => sum + (item.includeInComboTotal ? getPrice(item.material) * item.quantity : 0), 0);
    return { area, perimeter, fixed, total: area + perimeter + fixed };
  }, [laneItemsMap, priceView]);

  const includedSummaryModes = useMemo(
    () => (['area', 'perimeter', 'fixed'] as const).filter((mode) => laneItemsMap[mode].some((item) => item.includeInComboTotal)),
    [laneItemsMap],
  );

  const toggleSelectedMaterial = (id: string) => {
    setSelectedMaterialIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  const toggleSelectedDraft = (id: string) => {
    setSelectedDraftIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  const addMaterialsToLane = (calcMode: CalcMode, explicitIds?: string[]) => {
    const ids = explicitIds && explicitIds.length > 0 ? explicitIds : selectedMaterialIds;
    if (ids.length === 0) return;

    const nextItems = [...productItems];
    const blockedCategories: string[] = [];
    const blockedUnits: string[] = [];

    ids.forEach((id) => {
      const material = materialMap.get(id);
      if (!material) return;
      const expectedMode = getExpectedCalcMode(material.unitType);
      if (expectedMode !== calcMode) {
        blockedUnits.push(`${material.name} 只能加入${laneMeta[expectedMode].title}`);
        return;
      }
      const category = categoryMap.get(material.categoryId);
      const allowMultiple = Boolean(category?.allowMultipleInProduct);
      const sameCategoryExists = nextItems.some((item) => {
        const currentMaterial = materialMap.get(item.materialId);
        return currentMaterial?.categoryId === material.categoryId;
      });

      if (!allowMultiple && sameCategoryExists) {
        blockedCategories.push(category?.name || material.name);
        return;
      }

      nextItems.push(createDraftItem(id, calcMode, 1, Boolean(pricingModeMap.get(material.unitType)?.includeInComboTotal)));
    });

    setProductItems(nextItems);
    if (!explicitIds) setSelectedMaterialIds([]);

    if (blockedCategories.length > 0) {
      notifications.show({
        title: '已阻止重复分类',
        message: `${Array.from(new Set(blockedCategories)).join('、')} 默认不能在同一组合里出现多次。若确实需要，请去分类管理打开“允许组合重复”。`,
        color: 'orange',
      });
    }
    if (blockedUnits.length > 0) {
      notifications.show({
        title: '单位不匹配，未加入',
        message: Array.from(new Set(blockedUnits)).join('；'),
        color: 'orange',
      });
    }
  };

  const moveDraftItem = (index: number, direction: -1 | 1) => {
    const lane = productItems[index]?.calcMode;
    if (!lane) return;
    const laneIndexes = productItems
      .map((item, currentIndex) => ({ item, currentIndex }))
      .filter((entry) => entry.item.calcMode === lane)
      .map((entry) => entry.currentIndex);
    const lanePosition = laneIndexes.indexOf(index);
    const swapIndex = laneIndexes[lanePosition + direction];
    if (swapIndex === undefined) return;
    setProductItems((items) => {
      const cloned = [...items];
      [cloned[index], cloned[swapIndex]] = [cloned[swapIndex], cloned[index]];
      return cloned;
    });
  };

  const moveSelectedDraftsToLane = (sourceMode: CalcMode, targetMode: CalcMode) => {
    const sourceItems = currentItems.filter((item) => item.calcMode === sourceMode && selectedDraftIds.includes(item.localId));
    if (sourceItems.length === 0) return;

    const blockedCategories: string[] = [];
    const blockedUnits: string[] = [];
    setProductItems((items) => items.map((item) => {
      if (!selectedDraftIds.includes(item.localId) || item.calcMode !== sourceMode) return item;
      const material = materialMap.get(item.materialId);
      if (!material) return item;
      const expectedMode = getExpectedCalcMode(material.unitType);
      if (expectedMode !== targetMode) {
        blockedUnits.push(`${material.name} 只能移动到${laneMeta[expectedMode].title}`);
        return item;
      }
      const category = categoryMap.get(material.categoryId);
      const allowMultiple = Boolean(category?.allowMultipleInProduct);
      const sameCategoryExists = items.some((entry) => {
        if (entry.localId === item.localId) return false;
        const currentMaterial = materialMap.get(entry.materialId);
        return entry.calcMode === targetMode && currentMaterial?.categoryId === material.categoryId;
      });
      if (!allowMultiple && sameCategoryExists) {
        blockedCategories.push(category?.name || material.name);
        return item;
      }
      return { ...item, calcMode: targetMode };
    }));
    setSelectedDraftIds([]);

    if (blockedCategories.length > 0) {
      notifications.show({
        title: '部分材料未移动',
        message: `${Array.from(new Set(blockedCategories)).join('、')} 在目标单位区中已存在同分类材料。`,
        color: 'orange',
      });
    }
    if (blockedUnits.length > 0) {
      notifications.show({
        title: '单位不匹配，未移动',
        message: Array.from(new Set(blockedUnits)).join('；'),
        color: 'orange',
      });
    }
  };

  const removeSelectedDrafts = (laneMode: CalcMode) => {
    setProductItems((items) => items.filter((item) => !(item.calcMode === laneMode && selectedDraftIds.includes(item.localId))));
    setSelectedDraftIds([]);
  };

  const saveProduct = async () => {
    const finalProductName = productName.trim() || autoProductName.trim();
    if (!finalProductName || productItems.length === 0) {
      notifications.show({ title: '信息不完整', message: '请至少加入一个材料。', color: 'red' });
      return;
    }

    const payload = {
      name: finalProductName,
      pricingMode: deriveProductPricingMode(productItems),
      items: productItems.map((item, index) => ({
        materialId: item.materialId,
        calcMode: item.calcMode,
        quantity: item.quantity,
        includeInComboTotal: item.includeInComboTotal ? 1 : 0,
        sortOrder: index,
      })),
    };

    try {
      if (editingProductId) {
        await updateProduct.mutateAsync({ id: editingProductId, ...payload });
      } else {
        await createProduct.mutateAsync(payload);
      }
    } catch (error: any) {
      notifications.show({
        title: '保存失败',
        message: error?.message || '组合保存失败，请稍后重试。',
        color: 'red',
      });
      return;
    }

    notifications.show({ title: '组合已保存', message: '组合已保存到组合库。', color: 'blue' });
    setEditingProductId(null);
    setProductName('');
    setIsProductNameCustomized(false);
    setProductItems([]);
    setSelectedDraftIds([]);
  };

  return (
    <PageScaffold
      title="新建组合"
      description="把材料搭成一个可复用的产品组合；每一项都能单独决定是否计入组合总价。"
    >
      <Stack h="100%" gap="sm">
        <div className="app-stat-grid">
          <div className="app-stat-card">
            <div className="app-stat-label">材料分组</div>
            <div className="app-stat-value">{groupedMaterials.length}</div>
            <div className="app-stat-note">按分类组织材料，方便快速拖拽成组合</div>
          </div>
          <div className="app-stat-card">
            <div className="app-stat-label">当前组合项</div>
            <div className="app-stat-value">{productItems.length}</div>
            <div className="app-stat-note">已加入三个计价通道的材料条目总数</div>
          </div>
          <div className="app-stat-card">
            <div className="app-stat-label">已计入总价</div>
            <div className="app-stat-value">{includedSummaryModes.length}</div>
            <div className="app-stat-note">当前有 {includedSummaryModes.length} 个计价通道参与组合总价</div>
          </div>
          <div className="app-stat-card">
            <div className="app-stat-label">组合总计</div>
            <div className="app-stat-value">{totalsByMode.total.toFixed(2)}</div>
            <div className="app-stat-note">{priceView === 'cost' ? '当前查看成本口径' : '当前查看销售口径'}</div>
          </div>
        </div>

        <Paper withBorder radius={12} p="xs" className="app-surface">
          <Group justify="space-between" align="center">
            <Box>
              <Title order={5}>{editingProductId ? '编辑组合' : '新建组合'}</Title>
            </Box>
            <SegmentedControl
              size="xs"
              value={priceView}
              onChange={(value) => setPriceView(value as PriceView)}
              data={[
                { label: '显示销售价', value: 'retail' },
                { label: '显示成本价', value: 'cost' },
              ]}
            />
          </Group>

          <Group mt="xs" align="flex-end" wrap="nowrap">
            <TextInput
              size="sm"
              label="组合名称"
              placeholder={autoProductName || '加入材料后自动生成'}
              value={productName}
              onChange={(event) => {
                const nextValue = event.currentTarget.value;
                setProductName(nextValue);
                setIsProductNameCustomized(nextValue.trim() !== '' && nextValue !== autoProductName);
              }}
              style={{ flex: 1 }}
            />
            <Button size="sm" onClick={saveProduct}>保存到组合库</Button>
          </Group>

          <Group mt="xs" gap="xs" wrap="nowrap">
            {includedSummaryModes.map((mode) => (
              <Badge key={mode} size="lg" radius="sm" color={summaryBadgeMeta[mode].color} variant="light">
                {summaryBadgeMeta[mode].label} {totalsByMode[mode].toFixed(2)}
              </Badge>
            ))}
            <Badge size="lg" radius="sm" color="dark" variant="filled">总计 {totalsByMode.total.toFixed(2)}</Badge>
          </Group>
        </Paper>

        <Box style={{ display: 'grid', gridTemplateColumns: '460px minmax(0, 1fr)', gap: 12, flex: 1, minHeight: 0 }}>
          <Paper withBorder radius={12} p="sm" className="app-surface app-section">
            <Stack gap="xs" style={{ flex: 1, minHeight: 0 }}>
              <div className="app-section-header">
                <div>
                  <div className="app-section-title">材料库</div>
                  <div className="app-section-subtitle">双击、点 + 或拖拽到右侧通道，快速搭建组合。</div>
                </div>
                <Group gap="xs">
                  <Badge variant="light">{materials.length} 条</Badge>
                  <Text size="10px" c="dimmed">支持批量加入</Text>
                </Group>
              </div>

              <div className="page-toolbar">
                <div className="page-toolbar-main">
                  <TextInput
                    size="xs"
                    leftSection={<IconSearch size={16} />}
                    placeholder="搜索材料"
                    value={materialKeyword}
                    onChange={(event) => setMaterialKeyword(event.currentTarget.value)}
                    className="page-toolbar-fill"
                  />
                  <div className="page-toolbar-meta">
                    <NumberInput
                      size="xs"
                      label={priceView === 'cost' ? '最高成本价' : '最高销售价'}
                      value={maxPrice}
                      onChange={(value) => setMaxPrice(typeof value === 'number' ? value : '')}
                      min={0}
                    />
                  </div>
                </div>
              </div>

              {selectedMaterialIds.length > 0 && (
                <div className="selection-strip">
                  <Text size="xs" fw={700}>已选中 {selectedMaterialIds.length} 项</Text>
                  <Group gap="xs">
                    <Button size="compact-xs" color="teal" onClick={() => addMaterialsToLane('area')}>平米</Button>
                    <Button size="compact-xs" color="blue" onClick={() => addMaterialsToLane('perimeter')}>长度</Button>
                    <Button size="compact-xs" color="orange" onClick={() => addMaterialsToLane('fixed')}>固定</Button>
                    <Button size="xs" variant="subtle" onClick={() => setSelectedMaterialIds([])}>清空</Button>
                  </Group>
                </div>
              )}

              <ScrollArea className="soft-scroll" style={{ flex: 1 }}>
                <Stack gap="xs">
                  {groupedMaterials.map(({ category, items }) => {
                    const visual = detectCategoryVisual(category.name);
                    const tint = getCategoryTint(category.id || category.name);
                    const Icon = visual.icon;
                    const categoryIds = items.map((item) => item.id || '');
                    const allSelected = categoryIds.length > 0 && categoryIds.every((id) => selectedMaterialIds.includes(id));
                    const someSelected = !allSelected && categoryIds.some((id) => selectedMaterialIds.includes(id));
                    const collapsed = collapsedCategoryIds.includes(category.id || '');

                    return (
                      <Paper
                        key={category.id}
                        withBorder
                        radius={12}
                        p="xs"
                        bg={tint.bg}
                        style={{ borderColor: tint.border, backdropFilter: 'blur(6px)' }}
                      >
                        <Stack gap="xs">
                          <Group justify="space-between">
                            <Group gap="sm">
                              <ThemeIcon variant="light" color={visual.color} size="sm">
                                <Icon size={15} />
                              </ThemeIcon>
                              <Group gap={6}>
                                <Text fw={700} size="sm">{category.name}</Text>
                                <Badge size="xs" variant="dot" color={category.allowMultipleInProduct ? 'teal' : 'gray'}>
                                  {category.allowMultipleInProduct ? '可重复' : '单次'}
                                </Badge>
                              </Group>
                            </Group>
                            <Group gap="xs">
                              <Checkbox
                                size="xs"
                                checked={allSelected}
                                indeterminate={someSelected}
                                onChange={() => {
                                  setSelectedMaterialIds((current) => allSelected
                                    ? current.filter((id) => !categoryIds.includes(id))
                                    : Array.from(new Set([...current, ...categoryIds])));
                                }}
                              />
                              <Badge size="sm" variant="light">{items.length}</Badge>
                              <ActionIcon
                                size="sm"
                                variant="subtle"
                                onClick={() => setCollapsedCategoryIds((current) => current.includes(category.id || '')
                                  ? current.filter((id) => id !== category.id)
                                  : [...current, category.id || ''])}
                              >
                                {collapsed ? <IconChevronDown size={16} /> : <IconChevronUp size={16} />}
                              </ActionIcon>
                            </Group>
                          </Group>

                          {!collapsed && (
                            <Stack gap={6}>
                              {items.map((material) => {
                                const isSelected = selectedMaterialSet.has(material.id || '');
                                const displayPrice = priceView === 'cost' ? material.costPrice : material.retailPrice;
                                const defaultMode = defaultModeByUnit[material.unitType] || 'area';
                                const dragIds = isSelected ? selectedMaterialIds : [material.id || ''];

                                return (
                                  <MaterialRow
                                    key={material.id}
                                    material={material}
                                    categoryName={category.name}
                                    isSelected={isSelected}
                                    displayPrice={displayPrice}
                                    dragIds={dragIds}
                                    defaultMode={defaultMode}
                                    tint={tint}
                                    onToggle={() => toggleSelectedMaterial(material.id || '')}
                                    onAdd={(mode) => addMaterialsToLane(mode, [material.id || ''])}
                                  />
                                );
                              })}
                            </Stack>
                          )}
                        </Stack>
                      </Paper>
                    );
                  })}
                </Stack>
              </ScrollArea>
            </Stack>
          </Paper>

          <ScrollArea className="soft-scroll app-surface" style={{ minHeight: 0, borderRadius: 12 }}>
            <Stack gap="sm">
              {(['area', 'perimeter', 'fixed'] as CalcMode[]).map((mode) => {
                const meta = laneMeta[mode];
                const Icon = meta.icon;
                const laneItems = laneItemsMap[mode];
                const laneSelectedIds = laneItems.filter((item) => selectedDraftIds.includes(item.localId)).map((item) => item.localId);
                const laneAllSelected = laneItems.length > 0 && laneSelectedIds.length === laneItems.length;
                const laneSomeSelected = laneSelectedIds.length > 0 && laneSelectedIds.length < laneItems.length;

                return (
                  <Paper
                    key={mode}
                    withBorder
                    radius={12}
                    p="sm"
                    bg={laneTintMap[mode].bg}
                    style={{ borderColor: laneTintMap[mode].border, backdropFilter: 'blur(6px)' }}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault();
                      const ids = JSON.parse(event.dataTransfer.getData('application/material-ids') || '[]') as string[];
                      addMaterialsToLane(mode, ids);
                    }}
                  >
                    <Stack gap="sm">
                      <Group justify="space-between" align="flex-start">
                        <Group gap="sm">
                          <ThemeIcon variant="light" color={meta.color} size="lg">
                            <Icon size={16} />
                          </ThemeIcon>
                          <Box>
                            <Title order={6}>{meta.title}</Title>
                            <Text size="10px" c="dimmed" mt={2}>{meta.description}</Text>
                          </Box>
                        </Group>
                        <Group gap="xs">
                          <Checkbox
                            checked={laneAllSelected}
                            indeterminate={laneSomeSelected}
                            onChange={() => {
                              setSelectedDraftIds((current) => laneAllSelected
                                ? current.filter((id) => !laneItems.some((item) => item.localId === id))
                                : Array.from(new Set([...current, ...laneItems.map((item) => item.localId)])));
                            }}
                          />
                          <Badge variant="light" color={meta.color}>{laneItems.length} 项</Badge>
                          <Badge variant="light" color={meta.color}>¥ {totalsByMode[mode].toFixed(2)}</Badge>
                        </Group>
                      </Group>

                      {laneSelectedIds.length > 0 && (
                        <Group justify="space-between" p="xs" bg="rgba(255,255,255,0.82)" style={{ borderRadius: 10 }}>
                          <Text size="xs" fw={700}>已选中 {laneSelectedIds.length} 项</Text>
                          <Group gap="xs">
                            {(['area', 'perimeter', 'fixed'] as CalcMode[])
                              .filter((targetMode) => targetMode !== mode)
                              .map((targetMode) => (
                                <Button key={targetMode} size="xs" variant="light" onClick={() => moveSelectedDraftsToLane(mode, targetMode)}>
                                  移到{laneMeta[targetMode].title}
                                </Button>
                              ))}
                            <Button size="xs" color="red" variant="light" onClick={() => removeSelectedDrafts(mode)}>
                              批量删除
                            </Button>
                          </Group>
                        </Group>
                      )}

                      {laneItems.length === 0 ? (
                        <Paper withBorder radius={10} p="sm" bg={laneTintMap[mode].emptyBg} style={{ borderColor: 'rgba(148, 163, 184, 0.18)' }}>
                          <Text size="10px" c="dimmed">拖入材料或点 + 加入这里</Text>
                        </Paper>
                      ) : (
                        <Stack gap={6}>
                          {laneItems.map((item) => (
                            <DraftItemCard
                              key={item.localId}
                              item={item}
                              priceView={priceView}
                              laneColor={meta.color}
                              checked={selectedDraftSet.has(item.localId)}
                              onToggleChecked={() => toggleSelectedDraft(item.localId)}
                              onToggleInclude={() => setProductItems((items) => items.map((entry) => (
                                entry.localId === item.localId
                                  ? { ...entry, includeInComboTotal: !entry.includeInComboTotal }
                                  : entry
                              )))}
                              onChangeQuantity={(value) => setProductItems((items) => items.map((entry) => entry.localId === item.localId ? { ...entry, quantity: value } : entry))}
                              onMove={(direction) => moveDraftItem(item.index, direction)}
                              onRemove={() => setProductItems((items) => items.filter((entry) => entry.localId !== item.localId))}
                            />
                          ))}
                        </Stack>
                      )}
                    </Stack>
                  </Paper>
                );
              })}
            </Stack>
          </ScrollArea>
        </Box>
      </Stack>
    </PageScaffold>
  );
};

export default ProductsPage;
