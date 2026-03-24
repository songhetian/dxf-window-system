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
  Text,
  TextInput,
  ThemeIcon,
  Title,
} from '@mantine/core';
import {
  IconArrowDown,
  IconArrowUp,
  IconDroplet,
  IconGripVertical,
  IconLock,
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
  useMaterials,
  usePricingProducts,
  useUpdatePricingProduct,
} from '../hooks/useWindowApi';

type CalcMode = 'area' | 'perimeter' | 'fixed';
type PriceView = 'cost' | 'retail';
type ProductDraftItem = {
  materialId: string;
  calcMode: CalcMode;
  quantity: number;
};

const laneMeta: Record<CalcMode, { title: string; description: string; color: string; icon: any }> = {
  area: { title: '按平米项', description: '玻璃、面板、面材等按面积展开', color: 'teal', icon: IconSquareRounded },
  perimeter: { title: '按长度项', description: '胶条、压条、边框等按长度换算', color: 'blue', icon: IconRulerMeasure },
  fixed: { title: '按固定项', description: '五金、工艺、辅件等按件数计入', color: 'orange', icon: IconLock },
};

const keywordIconMap = [
  { keywords: ['玻璃'], icon: IconWindow, color: 'cyan' },
  { keywords: ['胶', '密封'], icon: IconDroplet, color: 'blue' },
  { keywords: ['五金', '锁', '执手'], icon: IconLock, color: 'orange' },
  { keywords: ['型材', '框', '铝'], icon: IconLayersIntersect, color: 'teal' },
  { keywords: ['辅料', '配件', '工艺'], icon: IconTool, color: 'grape' },
];

const detectCategoryVisual = (name: string) => {
  const matched = keywordIconMap.find((item) => item.keywords.some((keyword) => name.includes(keyword)));
  return matched || { icon: IconWindow, color: 'gray' };
};

const DraftItemCard = memo(({
  item,
  priceView,
  laneColor,
  onChangeQuantity,
  onMove,
  onRemove,
}: {
  item: any;
  priceView: PriceView;
  laneColor: string;
  onChangeQuantity: (value: number) => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
}) => {
  const unitPrice = priceView === 'cost' ? (item.material?.costPrice || 0) : (item.material?.retailPrice || 0);

  return (
    <Paper withBorder radius={12} p="md" bg="#fff">
      <Stack gap="md">
        <Group justify="space-between" align="flex-start" wrap="nowrap">
          <Group gap="sm" align="flex-start" wrap="nowrap" style={{ flex: 1 }}>
            <ThemeIcon variant="light" color={laneColor} size="lg">
              <IconGripVertical size={16} />
            </ThemeIcon>
            <Box style={{ flex: 1, minWidth: 0 }}>
              <Text fw={800} size="sm" truncate>{item.material?.name || '未命名材料'}</Text>
              <Text size="xs" c="dimmed" mt={4}>
                {item.category?.name || '未分类'} · {item.material?.unitLabel || '-'}
              </Text>
            </Box>
          </Group>
          <Badge variant="light">{priceView === 'cost' ? '成本' : '销售'} {unitPrice.toFixed(2)}</Badge>
        </Group>

        <Group justify="space-between" align="flex-end">
          <NumberInput
            label="换算系数"
            description="每个计量单位需要多少该材料"
            value={item.quantity}
            onChange={(value) => onChangeQuantity(Number(value) || 0.01)}
            min={0.01}
            step={0.1}
            w={190}
          />
          <Group gap={6}>
            <ActionIcon variant="light" onClick={() => onMove(-1)}>
              <IconArrowUp size={16} />
            </ActionIcon>
            <ActionIcon variant="light" onClick={() => onMove(1)}>
              <IconArrowDown size={16} />
            </ActionIcon>
            <ActionIcon variant="light" color="red" onClick={onRemove}>
              <IconTrash size={16} />
            </ActionIcon>
          </Group>
        </Group>
      </Stack>
    </Paper>
  );
});

const ProductsPage = () => {
  const { data: categories = [] } = useMaterialCategories();
  const { data: materials = [] } = useMaterials();
  const { data: products = [] } = usePricingProducts();
  const createProduct = useCreatePricingProduct();
  const updateProduct = useUpdatePricingProduct();

  const [materialKeyword, setMaterialKeyword] = useState('');
  const [productName, setProductName] = useState('');
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [productItems, setProductItems] = useState<ProductDraftItem[]>([]);
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<string[]>([]);
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
      setEditingProductId(parsed.copyMode ? null : product.id || null);
      setProductName(parsed.copyMode ? `${product.name} 副本` : product.name);
      setProductItems(
        product.items
          .slice()
          .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
          .map((item) => ({
            materialId: item.materialId,
            calcMode: (item.calcMode as CalcMode) || 'area',
            quantity: item.quantity,
          })),
      );
    } finally {
      window.localStorage.removeItem('product-builder-load');
    }
  }, [products]);

  const materialMap = useMemo(() => new Map(materials.map((item) => [item.id || '', item] as const)), [materials]);
  const categoryMap = useMemo(() => new Map(categories.map((item) => [item.id || '', item] as const)), [categories]);

  const groupedMaterials = useMemo(
    () => categories
      .map((category) => ({
        category,
        items: materials.filter((item) => {
          const matchesKeyword = item.name.toLowerCase().includes(deferredKeyword.toLowerCase());
          const price = priceView === 'cost' ? item.costPrice : item.retailPrice;
          const matchesPrice = maxPrice === '' || price <= Number(maxPrice);
          return item.categoryId === category.id && matchesKeyword && matchesPrice;
        }),
      }))
      .filter((group) => group.items.length > 0),
    [categories, deferredKeyword, materials, maxPrice, priceView],
  );

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

  const totalsByMode = useMemo(() => {
    const getPrice = (material: any) => priceView === 'cost' ? (material?.costPrice || 0) : (material?.retailPrice || 0);
    const area = currentItems.filter((item) => item.calcMode === 'area').reduce((sum, item) => sum + getPrice(item.material) * item.quantity, 0);
    const perimeter = currentItems.filter((item) => item.calcMode === 'perimeter').reduce((sum, item) => sum + getPrice(item.material) * item.quantity, 0);
    const fixed = currentItems.filter((item) => item.calcMode === 'fixed').reduce((sum, item) => sum + getPrice(item.material) * item.quantity, 0);
    return { area, perimeter, fixed, total: area + perimeter + fixed };
  }, [currentItems, priceView]);

  const toggleSelectedMaterial = (id: string) => {
    setSelectedMaterialIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  const addMaterialsToLane = (calcMode: CalcMode, explicitIds?: string[]) => {
    const ids = explicitIds && explicitIds.length > 0 ? explicitIds : selectedMaterialIds;
    if (ids.length === 0) return;

    const nextItems = [...productItems];
    const blockedCategories: string[] = [];

    ids.forEach((id) => {
      const material = materialMap.get(id);
      if (!material) return;
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

      nextItems.push({ materialId: id, calcMode, quantity: 1 });
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

  const saveProduct = async () => {
    if (!productName.trim() || productItems.length === 0) {
      notifications.show({ title: '信息不完整', message: '请输入组合名称，并至少加入一个材料。', color: 'red' });
      return;
    }

    const payload = {
      name: productName.trim(),
      pricingMode: 'area' as const,
      items: productItems.map((item, index) => ({
        materialId: item.materialId,
        calcMode: item.calcMode,
        quantity: item.quantity,
        sortOrder: index,
      })),
    };

    if (editingProductId) {
      await updateProduct.mutateAsync({ id: editingProductId, ...payload });
    } else {
      await createProduct.mutateAsync(payload);
    }

    notifications.show({ title: '组合已保存', message: '组合已保存到组合库。', color: 'blue' });
    setEditingProductId(null);
    setProductName('');
    setProductItems([]);
  };

  return (
    <PageScaffold
      title="组合设置"
      description="左侧材料库支持多选、价格筛选、拖拽和快捷加入。顶部可以切换看成本价或销售价，并实时查看每个单位区的小计。"
    >
      <Stack h="100%" gap="md">
        <Paper withBorder radius={12} p="md">
          <Group justify="space-between" align="flex-start">
            <Box>
              <Title order={4}>{editingProductId ? '编辑组合' : '新建组合'}</Title>
              <Text size="sm" c="dimmed" mt={4}>
                默认同一分类只能出现一次；只有分类管理里打开“允许组合重复”的分类才能同时放多个。
              </Text>
            </Box>
            <SegmentedControl
              value={priceView}
              onChange={(value) => setPriceView(value as PriceView)}
              data={[
                { label: '显示销售价', value: 'retail' },
                { label: '显示成本价', value: 'cost' },
              ]}
            />
          </Group>

          <Group mt="md" align="flex-end" wrap="nowrap">
            <TextInput label="组合名称" value={productName} onChange={(event) => setProductName(event.currentTarget.value)} style={{ flex: 1 }} />
            <Button onClick={saveProduct}>保存到组合库</Button>
          </Group>

          <Group mt="md" grow>
            <Paper withBorder radius={10} p="sm" bg="var(--bg-subtle)">
              <Text size="xs" c="dimmed">平米项总价</Text>
              <Text fw={800} size="lg">{totalsByMode.area.toFixed(2)}</Text>
            </Paper>
            <Paper withBorder radius={10} p="sm" bg="var(--bg-subtle)">
              <Text size="xs" c="dimmed">长度项总价</Text>
              <Text fw={800} size="lg">{totalsByMode.perimeter.toFixed(2)}</Text>
            </Paper>
            <Paper withBorder radius={10} p="sm" bg="var(--bg-subtle)">
              <Text size="xs" c="dimmed">固定项总价</Text>
              <Text fw={800} size="lg">{totalsByMode.fixed.toFixed(2)}</Text>
            </Paper>
            <Paper withBorder radius={10} p="sm" bg="var(--bg-subtle)">
              <Text size="xs" c="dimmed">总计</Text>
              <Text fw={800} size="lg">{totalsByMode.total.toFixed(2)}</Text>
            </Paper>
          </Group>
        </Paper>

        <Box style={{ display: 'grid', gridTemplateColumns: '480px minmax(0, 1fr)', gap: 16, flex: 1, minHeight: 0 }}>
          <Paper withBorder radius={12} p="md" style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <Stack gap="md" style={{ flex: 1, minHeight: 0 }}>
              <Group justify="space-between">
                <Box>
                  <Title order={4}>材料库</Title>
                  <Text size="sm" c="dimmed" mt={4}>
                    现在可以看更多信息，也能批量选中后一次性加入指定单位区。
                  </Text>
                </Box>
                <Badge variant="light">{materials.length} 条</Badge>
              </Group>

              <Group grow>
                <TextInput
                  leftSection={<IconSearch size={16} />}
                  placeholder="搜索材料"
                  value={materialKeyword}
                  onChange={(event) => setMaterialKeyword(event.currentTarget.value)}
                />
                <NumberInput
                  label={priceView === 'cost' ? '最高成本价' : '最高销售价'}
                  value={maxPrice}
                  onChange={(value) => setMaxPrice(typeof value === 'number' ? value : '')}
                  min={0}
                />
              </Group>

              {selectedMaterialIds.length > 0 && (
                <Group justify="space-between" p="sm" bg="var(--mantine-color-gray-0)" style={{ borderRadius: 10 }}>
                  <Text size="sm" fw={700}>已选中 {selectedMaterialIds.length} 项</Text>
                  <Group gap="xs">
                    <Button size="xs" color="teal" onClick={() => addMaterialsToLane('area')}>加入平米</Button>
                    <Button size="xs" color="blue" onClick={() => addMaterialsToLane('perimeter')}>加入长度</Button>
                    <Button size="xs" color="orange" onClick={() => addMaterialsToLane('fixed')}>加入固定</Button>
                    <Button size="xs" variant="subtle" onClick={() => setSelectedMaterialIds([])}>清空</Button>
                  </Group>
                </Group>
              )}

              <ScrollArea className="soft-scroll" style={{ flex: 1 }}>
                <Stack gap="md">
                  {groupedMaterials.map(({ category, items }) => {
                    const visual = detectCategoryVisual(category.name);
                    const Icon = visual.icon;
                    return (
                      <Paper key={category.id} withBorder radius={12} p="sm" bg="var(--bg-subtle)">
                        <Stack gap="sm">
                          <Group justify="space-between">
                            <Group gap="sm">
                              <ThemeIcon variant="light" color={visual.color} size="lg">
                                <Icon size={18} />
                              </ThemeIcon>
                              <Box>
                                <Text fw={800}>{category.name}</Text>
                                <Text size="xs" c="dimmed" mt={4}>
                                  {category.allowMultipleInProduct ? '允许重复出现' : '默认只允许出现一次'}
                                </Text>
                              </Box>
                            </Group>
                            <Badge variant="light">{items.length}</Badge>
                          </Group>

                          <Stack gap="sm">
                            {items.map((material) => {
                              const isSelected = selectedMaterialIds.includes(material.id || '');
                              const displayPrice = priceView === 'cost' ? material.costPrice : material.retailPrice;

                              return (
                                <Paper
                                  key={material.id}
                                  withBorder
                                  radius={12}
                                  p="md"
                                  bg={isSelected ? 'var(--mantine-color-blue-0)' : '#fff'}
                                  draggable
                                  onDragStart={(event) => {
                                    const ids = isSelected ? selectedMaterialIds : [material.id || ''];
                                    event.dataTransfer.setData('application/material-ids', JSON.stringify(ids));
                                  }}
                                >
                                  <Stack gap="sm">
                                    <Group justify="space-between" align="flex-start">
                                      <Group gap="sm" align="flex-start" wrap="nowrap">
                                        <Checkbox checked={isSelected} onChange={() => toggleSelectedMaterial(material.id || '')} />
                                        <Box>
                                          <Text fw={800} size="sm">{material.name}</Text>
                                          <Text size="xs" c="dimmed" mt={4}>
                                            {category.name} · {material.unitLabel}
                                          </Text>
                                        </Box>
                                      </Group>
                                      <Badge variant="light">{displayPrice.toFixed(2)}</Badge>
                                    </Group>

                                    <Group gap="xs">
                                      <Button size="compact-sm" variant="light" color="teal" onClick={() => addMaterialsToLane('area', [material.id || ''])}>
                                        加到平米
                                      </Button>
                                      <Button size="compact-sm" variant="light" color="blue" onClick={() => addMaterialsToLane('perimeter', [material.id || ''])}>
                                        加到长度
                                      </Button>
                                      <Button size="compact-sm" variant="light" color="orange" onClick={() => addMaterialsToLane('fixed', [material.id || ''])}>
                                        加到固定
                                      </Button>
                                    </Group>
                                  </Stack>
                                </Paper>
                              );
                            })}
                          </Stack>
                        </Stack>
                      </Paper>
                    );
                  })}
                </Stack>
              </ScrollArea>
            </Stack>
          </Paper>

          <ScrollArea className="soft-scroll" style={{ minHeight: 0 }}>
            <Stack gap="md">
              {(['area', 'perimeter', 'fixed'] as CalcMode[]).map((mode) => {
                const meta = laneMeta[mode];
                const Icon = meta.icon;
                const laneItems = currentItems.filter((item) => item.calcMode === mode);

                return (
                  <Paper
                    key={mode}
                    withBorder
                    radius={12}
                    p="md"
                    bg="var(--bg-subtle)"
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault();
                      const ids = JSON.parse(event.dataTransfer.getData('application/material-ids') || '[]') as string[];
                      addMaterialsToLane(mode, ids);
                    }}
                  >
                    <Stack gap="md">
                      <Group justify="space-between" align="flex-start">
                        <Group gap="sm">
                          <ThemeIcon variant="light" color={meta.color} size="xl">
                            <Icon size={18} />
                          </ThemeIcon>
                          <Box>
                            <Title order={5}>{meta.title}</Title>
                            <Text size="sm" c="dimmed" mt={4}>{meta.description}</Text>
                          </Box>
                        </Group>
                        <Badge variant="light" color={meta.color}>{laneItems.length} 项</Badge>
                      </Group>

                      {laneItems.length === 0 ? (
                        <Paper withBorder radius={10} p="lg" bg="#fff">
                          <Text size="sm" c="dimmed">把左侧材料拖进来，或者直接点按钮加入。</Text>
                        </Paper>
                      ) : (
                        <Stack gap="sm">
                          {laneItems.map((item) => (
                            <DraftItemCard
                              key={`${item.materialId}-${item.index}`}
                              item={item}
                              priceView={priceView}
                              laneColor={meta.color}
                              onChangeQuantity={(value) => setProductItems((items) => items.map((entry, index) => index === item.index ? { ...entry, quantity: value } : entry))}
                              onMove={(direction) => moveDraftItem(item.index, direction)}
                              onRemove={() => setProductItems((items) => items.filter((_, index) => index !== item.index))}
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
