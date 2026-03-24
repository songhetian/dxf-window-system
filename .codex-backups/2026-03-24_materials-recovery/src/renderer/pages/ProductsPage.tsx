import React, { useEffect, useMemo, useState } from 'react';
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Group,
  NumberInput,
  Paper,
  ScrollArea,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { IconArrowDown, IconArrowUp, IconCopy, IconGripVertical, IconPlus, IconSearch, IconTrash } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import * as XLSX from 'xlsx';

import { PageScaffold } from '../components/ui/PageScaffold';
import {
  useCreatePricingProduct,
  useDeletePricingProduct,
  useMaterialCategories,
  useMaterials,
  usePricingProducts,
  useUpdatePricingProduct,
} from '../hooks/useWindowApi';

const modeOptions = [
  { value: 'area', label: '按面积报价' },
  { value: 'perimeter', label: '按周长报价' },
  { value: 'fixed', label: '按固定报价' },
];

const productTemplates = [
  {
    key: 'window-basic',
    name: '窗类基础模板',
    description: '优先带入玻璃、型材、五金三类材料',
    pricingMode: 'area' as const,
    categoryKeywords: ['玻璃', '型材', '五金'],
  },
  {
    key: 'door-basic',
    name: '门类基础模板',
    description: '优先带入门板、型材、五金三类材料',
    pricingMode: 'area' as const,
    categoryKeywords: ['门', '型材', '五金'],
  },
  {
    key: 'accessory-pack',
    name: '辅料打包模板',
    description: '优先带入胶条、配件、辅料类材料',
    pricingMode: 'fixed' as const,
    categoryKeywords: ['胶', '配件', '辅料'],
  },
];

export default function ProductsPage() {
  const { data: categories = [] } = useMaterialCategories();
  const { data: materials = [] } = useMaterials();
  const { data: products = [] } = usePricingProducts();
  const createProduct = useCreatePricingProduct();
  const deleteProduct = useDeletePricingProduct();
  const updateProduct = useUpdatePricingProduct();

  const [keyword, setKeyword] = useState('');
  const [productName, setProductName] = useState('');
  const [pricingMode, setPricingMode] = useState<'area' | 'perimeter' | 'fixed'>('area');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>('');
  const [selectedMaterialId, setSelectedMaterialId] = useState<string | null>(null);
  const [selectedQuantity, setSelectedQuantity] = useState(1);
  const [productItems, setProductItems] = useState<{ materialId: string; quantity: number }[]>([]);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);
  const [materialSearch, setMaterialSearch] = useState('');
  const [collapsedCategoryIds, setCollapsedCategoryIds] = useState<string[]>([]);
  const [customTemplates, setCustomTemplates] = useState<Array<{
    id: string;
    name: string;
    pricingMode: 'area' | 'perimeter' | 'fixed';
    items: { materialId: string; quantity: number }[];
  }>>([]);
  const [customTemplateName, setCustomTemplateName] = useState('');

  useEffect(() => {
    const raw = window.localStorage.getItem('product-custom-templates');
    if (!raw) return;
    try {
      const next = JSON.parse(raw);
      if (Array.isArray(next)) {
        setCustomTemplates(next);
      }
    } catch {
      window.localStorage.removeItem('product-custom-templates');
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem('product-custom-templates', JSON.stringify(customTemplates));
  }, [customTemplates]);

  const filteredProducts = useMemo(
    () => products.filter((item) => `${item.name} ${item.items.map((entry) => entry.materialName || '').join(' ')}`.toLowerCase().includes(keyword.toLowerCase())),
    [keyword, products],
  );

  const selectableMaterials = useMemo(
    () => materials.filter((item) => {
      const matchesCategory = !selectedCategoryId || item.categoryId === selectedCategoryId;
      const matchesSearch = item.name.toLowerCase().includes(materialSearch.toLowerCase());
      return matchesCategory && matchesSearch;
    }),
    [materialSearch, materials, selectedCategoryId],
  );

  const groupedSelectableMaterials = useMemo(() => {
    return categories
      .map((category) => ({
        id: category.id || '',
        name: category.name,
        items: selectableMaterials.filter((item) => item.categoryId === category.id),
      }))
      .filter((group) => group.items.length > 0);
  }, [categories, selectableMaterials]);

  const currentPreview = useMemo(
    () => productItems.map((item) => ({
      ...item,
      material: materials.find((entry) => entry.id === item.materialId),
    })),
    [materials, productItems],
  );

  const previewTotals = useMemo(() => currentPreview.reduce(
    (acc, item) => {
      acc.cost += (item.material?.costPrice || 0) * item.quantity;
      acc.retail += (item.material?.retailPrice || 0) * item.quantity;
      return acc;
    },
    { cost: 0, retail: 0 },
  ), [currentPreview]);

  const previewCategoryTotals = useMemo(() => {
    const groups = new Map<string, { label: string; cost: number; retail: number; count: number }>();
    currentPreview.forEach((item) => {
      const categoryId = item.material?.categoryId || 'unknown';
      const label = categories.find((entry) => entry.id === item.material?.categoryId)?.name || '未分类';
      const current = groups.get(categoryId) || { label, cost: 0, retail: 0, count: 0 };
      current.cost += (item.material?.costPrice || 0) * item.quantity;
      current.retail += (item.material?.retailPrice || 0) * item.quantity;
      current.count += 1;
      groups.set(categoryId, current);
    });
    return Array.from(groups.values()).sort((a, b) => b.retail - a.retail);
  }, [categories, currentPreview]);

  const productEstimates = useMemo(() => {
    return filteredProducts.map((product) => ({
      ...product,
      retailEstimate: product.items.reduce((sum, item) => sum + ((item.retailPrice || 0) * item.quantity), 0),
      costEstimate: product.items.reduce((sum, item) => sum + ((item.costPrice || 0) * item.quantity), 0),
    }));
  }, [filteredProducts]);

  const loadProductForEdit = (productId: string | null, copyMode = false) => {
    const product = products.find((item) => item.id === productId);
    if (!product) return;
    setEditingProductId(copyMode ? null : product.id || null);
    setProductName(copyMode ? `${product.name} 副本` : product.name);
    setPricingMode(product.pricingMode);
    setProductItems(product.items.map((item) => ({ materialId: item.materialId, quantity: item.quantity })));
  };

  const moveItem = (index: number, direction: -1 | 1) => {
    setProductItems((items) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= items.length) return items;
      const cloned = [...items];
      const [target] = cloned.splice(index, 1);
      cloned.splice(nextIndex, 0, target);
      return cloned;
    });
  };

  const handleDropItem = (targetIndex: number) => {
    if (draggingIndex === null || draggingIndex === targetIndex) return;
    setProductItems((items) => {
      const cloned = [...items];
      const [dragged] = cloned.splice(draggingIndex, 1);
      cloned.splice(targetIndex, 0, dragged);
      return cloned;
    });
    setDraggingIndex(null);
  };

  const addMaterialToProduct = (materialId: string, quantity = 1) => {
    if (!materialId) return;
    setProductItems((items) => {
      const existingIndex = items.findIndex((item) => item.materialId === materialId);
      if (existingIndex === -1) {
        return [...items, { materialId, quantity }];
      }
      return items.map((item, index) => (
        index === existingIndex
          ? { ...item, quantity: Number((item.quantity + quantity).toFixed(3)) }
          : item
      ));
    });
  };

  const updateItemQuantity = (index: number, quantity: number) => {
    setProductItems((items) => items.map((item, currentIndex) => (
      currentIndex === index
        ? { ...item, quantity: quantity > 0 ? quantity : 0.01 }
        : item
    )));
  };

  const toggleCategoryCollapse = (categoryId: string) => {
    setCollapsedCategoryIds((current) => (
      current.includes(categoryId)
        ? current.filter((item) => item !== categoryId)
        : [...current, categoryId]
    ));
  };

  const exportCurrentCombination = () => {
    if (!productName.trim() || currentPreview.length === 0) return;
    const rows = currentPreview.map((item, index) => ({
      序号: index + 1,
      材料名称: item.material?.name || '',
      分类: categories.find((entry) => entry.id === item.material?.categoryId)?.name || '',
      数量系数: item.quantity,
      成本单价: Number((item.material?.costPrice || 0).toFixed(2)),
      销售单价: Number((item.material?.retailPrice || 0).toFixed(2)),
      成本小计: Number(((item.material?.costPrice || 0) * item.quantity).toFixed(2)),
      销售小计: Number(((item.material?.retailPrice || 0) * item.quantity).toFixed(2)),
    }));
    rows.push({
      序号: rows.length + 1,
      材料名称: '合计',
      分类: '',
      数量系数: 0,
      成本单价: 0,
      销售单价: 0,
      成本小计: Number(previewTotals.cost.toFixed(2)),
      销售小计: Number(previewTotals.retail.toFixed(2)),
    });
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '组合明细');
    XLSX.writeFile(workbook, `${productName}_组合明细.xlsx`);
  };

  const saveProduct = async () => {
    if (!productName.trim() || productItems.length === 0) {
      notifications.show({ title: '信息不完整', message: '请输入组合名称并至少加入一个材料。', color: 'red' });
      return;
    }
    const duplicated = products.find((item) => item.name === productName.trim() && item.id !== editingProductId);
    if (duplicated) {
      notifications.show({ title: '组合名称重复', message: '已有同名组合，建议先加载编辑或改一个名称。', color: 'red' });
      return;
    }

    if (editingProductId) {
      await updateProduct.mutateAsync({
        id: editingProductId,
        name: productName.trim(),
        pricingMode,
        items: productItems,
      });
    } else {
      await createProduct.mutateAsync({
        name: productName.trim(),
        pricingMode,
        items: productItems,
      });
    }

    notifications.show({
      title: '组合已保存',
      message: editingProductId ? '当前组合修改已更新。' : '新组合已加入产品组合库。',
      color: 'blue',
    });
    setProductName('');
    setPricingMode('area');
    setProductItems([]);
    setEditingProductId(null);
  };

  const applyTemplate = (templateKey: string) => {
    const template = productTemplates.find((item) => item.key === templateKey);
    if (!template) return;

    const nextItems = template.categoryKeywords.flatMap((keyword) => {
      const category = categories.find((item) => item.name.includes(keyword));
      if (!category) return [];
      const material = materials.find((item) => item.categoryId === category.id);
      if (!material?.id) return [];
      return [{ materialId: material.id, quantity: 1 }];
    });

    if (nextItems.length === 0) {
      notifications.show({
        title: '没有找到可带入的材料',
        message: '当前材料分类里没有匹配到模板关键词，请先完善材料分类。',
        color: 'red',
      });
      return;
    }

    setEditingProductId(null);
    setPricingMode(template.pricingMode);
    setProductName(template.name);
    setProductItems(nextItems);
    notifications.show({
      title: '模板已带入',
      message: `已为你带入 ${nextItems.length} 项基础材料，可继续拖拽调整。`,
      color: 'blue',
    });
  };

  const saveCustomTemplate = () => {
    const name = customTemplateName.trim() || productName.trim();
    if (!name || productItems.length === 0) {
      notifications.show({
        title: '无法保存模板',
        message: '请先给组合命名，并至少加入一个材料。',
        color: 'red',
      });
      return;
    }

    const template = {
      id: `${Date.now()}`,
      name,
      pricingMode,
      items: productItems,
    };

    setCustomTemplates((current) => [template, ...current.filter((item) => item.name !== name)].slice(0, 12));
    setCustomTemplateName('');
    notifications.show({
      title: '模板已保存',
      message: '下次可以直接从自定义模板继续套用。',
      color: 'blue',
    });
  };

  const applyCustomTemplate = (templateId: string) => {
    const template = customTemplates.find((item) => item.id === templateId);
    if (!template) return;
    setEditingProductId(null);
    setProductName(template.name);
    setPricingMode(template.pricingMode);
    setProductItems(template.items);
  };

  return (
    <PageScaffold
      title="产品组合"
      description="左边查组合价格，右边同屏完成组合编辑和选材料。拖拽、加料、看汇总都在一个工作台里。"
    >
      <Box h="100%" style={{ display: 'grid', gridTemplateColumns: '360px minmax(0, 1fr)', gap: 12 }}>
        <Paper withBorder radius={12} p="md" style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <Stack gap="md" style={{ flex: 1, minHeight: 0 }}>
            <Box>
              <Title order={4}>组合价格库</Title>
              <Text size="sm" c="dimmed" mt={4}>
                先看现有组合的预估报价，再决定加载编辑还是复制一套。
              </Text>
            </Box>
            <TextInput
              leftSection={<IconSearch size={16} />}
              placeholder="搜索组合名称或材料"
              value={keyword}
              onChange={(event) => setKeyword(event.currentTarget.value)}
            />
            <ScrollArea className="soft-scroll" style={{ flex: 1 }}>
              <Stack gap="sm">
                {productEstimates.map((product) => (
                  <Paper key={product.id} withBorder radius={12} p="md" bg="var(--bg-subtle)">
                    <Stack gap="sm">
                      <Group justify="space-between" align="flex-start">
                        <Box maw={220}>
                          <Text fw={800}>{product.name}</Text>
                          <Text size="sm" c="dimmed" mt={4}>
                            {modeOptions.find((item) => item.value === product.pricingMode)?.label}
                          </Text>
                        </Box>
                        <Badge variant="light">{product.items.length} 项</Badge>
                      </Group>

                      <SimpleGrid cols={2} spacing="sm">
                        <Paper withBorder radius={10} p="sm">
                          <Text size="xs" c="dimmed">预估成本</Text>
                          <Text fw={800}>{product.costEstimate.toFixed(2)}</Text>
                        </Paper>
                        <Paper withBorder radius={10} p="sm">
                          <Text size="xs" c="dimmed">预估售价</Text>
                          <Text fw={800}>{product.retailEstimate.toFixed(2)}</Text>
                        </Paper>
                      </SimpleGrid>

                      <Text size="sm" c="dimmed">
                        {product.items.slice(0, 3).map((item) => item.materialName).join('，') || '暂无材料'}
                        {product.items.length > 3 ? ` 等 ${product.items.length} 项` : ''}
                      </Text>

                      <Group gap="xs">
                        <Button size="compact-sm" variant="light" onClick={() => loadProductForEdit(product.id || null)}>
                          加载编辑
                        </Button>
                        <Button size="compact-sm" variant="subtle" leftSection={<IconCopy size={14} />} onClick={() => loadProductForEdit(product.id || null, true)}>
                          复制
                        </Button>
                        <Button
                          size="compact-sm"
                          variant="subtle"
                          onClick={() => setExpandedProductId((current) => current === product.id ? null : product.id || null)}
                        >
                          {expandedProductId === product.id ? '收起明细' : '查看明细'}
                        </Button>
                        <ActionIcon color="red" variant="subtle" onClick={() => deleteProduct.mutate(product.id || '')}>
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Group>

                      {expandedProductId === product.id ? (
                        <Paper withBorder radius={10} p="sm" bg="#fff">
                          <Stack gap="xs">
                            {product.items.map((item, index) => (
                              <Group key={`${item.materialId}-${index}`} justify="space-between" align="flex-start">
                                <Box>
                                  <Text size="sm" fw={700}>{item.materialName}</Text>
                                  <Text size="xs" c="dimmed">
                                    数量系数 {item.quantity} / 成本 {(item.costPrice || 0).toFixed(2)} / 销售 {(item.retailPrice || 0).toFixed(2)}
                                  </Text>
                                </Box>
                                <Badge variant="light">{(((item.retailPrice || 0) * item.quantity)).toFixed(2)}</Badge>
                              </Group>
                            ))}
                            <Text size="xs" c="dimmed">
                              最近修改 {product.updatedAt ? new Date(product.updatedAt).toLocaleString() : '-'}
                            </Text>
                          </Stack>
                        </Paper>
                      ) : null}
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            </ScrollArea>
          </Stack>
        </Paper>

        <Paper withBorder radius={12} p="md" style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <Stack gap="md" style={{ flex: 1, minHeight: 0 }}>
            <Group justify="space-between" align="flex-start">
              <Box>
                <Title order={4}>{editingProductId ? '编辑当前组合' : '新建组合'}</Title>
                <Text size="sm" c="dimmed" mt={4}>
                  中间直接看组合，右下直接加材料，不需要切页。
                </Text>
              </Box>
              {editingProductId ? <Badge variant="light">正在编辑已有组合</Badge> : null}
            </Group>

            <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
              <TextInput value={productName} onChange={(event) => setProductName(event.currentTarget.value)} label="组合名称" />
              <Select
                label="主报价方式"
                data={modeOptions}
                value={pricingMode}
                onChange={(value) => setPricingMode((value as 'area' | 'perimeter' | 'fixed') || 'area')}
              />
            </SimpleGrid>

            <Paper withBorder radius={12} p="md" bg="var(--bg-subtle)">
              <Stack gap="sm">
                <Group justify="space-between">
                  <Box>
                    <Title order={5}>快速模板</Title>
                    <Text size="sm" c="dimmed" mt={4}>
                      新人可以先套模板，再补充或拖拽调整材料。
                    </Text>
                  </Box>
                  <Badge variant="light">{productTemplates.length} 个模板</Badge>
                </Group>
                <SimpleGrid cols={{ base: 1, xl: 3 }} spacing="sm">
                  {productTemplates.map((template) => (
                    <Paper key={template.key} withBorder radius={12} p="sm" bg="#fff">
                      <Stack gap="sm">
                        <Box>
                          <Text fw={700}>{template.name}</Text>
                          <Text size="sm" c="dimmed" mt={4}>{template.description}</Text>
                        </Box>
                        <Group gap={6}>
                          {template.categoryKeywords.map((keyword) => (
                            <Badge key={keyword} variant="light">{keyword}</Badge>
                          ))}
                        </Group>
                        <Button size="compact-sm" variant="light" onClick={() => applyTemplate(template.key)}>
                          使用模板
                        </Button>
                      </Stack>
                    </Paper>
                  ))}
                </SimpleGrid>
              </Stack>
            </Paper>

            <Paper withBorder radius={12} p="md">
              <Stack gap="sm">
                <Group justify="space-between">
                  <Box>
                    <Title order={5}>自定义模板</Title>
                    <Text size="sm" c="dimmed" mt={4}>
                      把当前组合存成自己的模板，后面直接套。
                    </Text>
                  </Box>
                  <Badge variant="light">{customTemplates.length} 个</Badge>
                </Group>
                <Group align="flex-end">
                  <TextInput
                    label="模板名称"
                    placeholder="默认取当前组合名称"
                    value={customTemplateName}
                    onChange={(event) => setCustomTemplateName(event.currentTarget.value)}
                    style={{ flex: 1 }}
                  />
                  <Button variant="default" onClick={saveCustomTemplate}>
                    保存为模板
                  </Button>
                </Group>
                {customTemplates.length > 0 ? (
                  <SimpleGrid cols={{ base: 1, xl: 3 }} spacing="sm">
                    {customTemplates.map((template) => (
                      <Paper key={template.id} withBorder radius={12} p="sm" bg="var(--bg-subtle)">
                        <Stack gap="sm">
                          <Box>
                            <Text fw={700}>{template.name}</Text>
                            <Text size="sm" c="dimmed" mt={4}>
                              {modeOptions.find((item) => item.value === template.pricingMode)?.label} / {template.items.length} 项
                            </Text>
                          </Box>
                          <Group gap="xs">
                            <Button size="compact-sm" variant="light" onClick={() => applyCustomTemplate(template.id)}>
                              套用
                            </Button>
                            <Button
                              size="compact-sm"
                              variant="subtle"
                              color="red"
                              onClick={() => setCustomTemplates((current) => current.filter((item) => item.id !== template.id))}
                            >
                              删除
                            </Button>
                          </Group>
                        </Stack>
                      </Paper>
                    ))}
                  </SimpleGrid>
                ) : null}
              </Stack>
            </Paper>

            <Box style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.15fr) minmax(320px, 0.85fr)', gap: 12, flex: 1, minHeight: 0 }}>
              <Paper
                withBorder
                radius={12}
                p="md"
                style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  const materialId = event.dataTransfer.getData('text/material-id');
                  if (materialId) addMaterialToProduct(materialId);
                }}
              >
                <Group justify="space-between" mb="sm">
                  <Box>
                    <Title order={5}>组合编辑区</Title>
                    <Text size="sm" c="dimmed" mt={4}>
                      材料可直接拖进来，也可以从右侧点加入。
                    </Text>
                  </Box>
                  <Badge variant="light">{currentPreview.length} 项材料</Badge>
                </Group>

                <ScrollArea className="soft-scroll" style={{ flex: 1 }}>
                  <Stack gap="sm">
                    {currentPreview.length === 0 ? (
                      <Paper withBorder radius={12} p="lg" bg="var(--bg-subtle)">
                        <Text size="sm" c="dimmed">
                          右侧材料库选中分类后，直接拖到这里，或者填数量系数后点击“加入组合”。
                        </Text>
                      </Paper>
                    ) : currentPreview.map((item, index) => (
                      <Paper
                        key={`${item.materialId}-${index}`}
                        withBorder
                        radius={12}
                        p="sm"
                        draggable
                        onDragStart={() => setDraggingIndex(index)}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={() => handleDropItem(index)}
                        style={{ cursor: 'grab' }}
                      >
                        <Group justify="space-between" align="flex-start">
                          <Group gap="sm" align="flex-start" wrap="nowrap">
                            <IconGripVertical size={18} color="#6b7280" style={{ marginTop: 2 }} />
                            <Box>
                              <Text fw={700}>{item.material?.name || '未命名材料'}</Text>
                              <Text size="sm" c="dimmed" mt={4}>
                                {categories.find((entry) => entry.id === item.material?.categoryId)?.name || '未分类'} / 数量系数 {item.quantity}
                              </Text>
                              <NumberInput
                                label="数量系数"
                                value={item.quantity}
                                onChange={(value) => updateItemQuantity(index, Number(value) || 0.01)}
                                min={0.01}
                                step={0.1}
                                w={140}
                                mt="sm"
                              />
                              <Group gap={6} mt={8}>
                                <Badge variant="light">成本 {(((item.material?.costPrice || 0) * item.quantity)).toFixed(2)}</Badge>
                                <Badge variant="light">销售 {(((item.material?.retailPrice || 0) * item.quantity)).toFixed(2)}</Badge>
                              </Group>
                            </Box>
                          </Group>
                          <Group gap={4}>
                            <ActionIcon variant="subtle" onClick={() => moveItem(index, -1)} disabled={index === 0}>
                              <IconArrowUp size={16} />
                            </ActionIcon>
                            <ActionIcon variant="subtle" onClick={() => moveItem(index, 1)} disabled={index === currentPreview.length - 1}>
                              <IconArrowDown size={16} />
                            </ActionIcon>
                            <ActionIcon color="red" variant="subtle" onClick={() => setProductItems((items) => items.filter((_, current) => current !== index))}>
                              <IconTrash size={16} />
                            </ActionIcon>
                          </Group>
                        </Group>
                      </Paper>
                    ))}
                  </Stack>
                </ScrollArea>
              </Paper>

              <Stack gap="md" style={{ minHeight: 0 }}>
                <Paper withBorder radius={12} p="md">
                  <Stack gap="md">
                    <Group justify="space-between">
                      <Box>
                        <Title order={5}>材料库</Title>
                        <Text size="sm" c="dimmed" mt={4}>
                          这是组合编辑时的材料入口，不再单独切页面。
                        </Text>
                      </Box>
                      <Badge variant="light">{selectableMaterials.length} 条</Badge>
                    </Group>

                    <Group grow align="flex-end">
                      <Select
                        label="分类"
                        data={[{ value: '', label: '全部分类' }, ...categories.map((item) => ({ value: item.id || '', label: item.name }))]}
                        value={selectedCategoryId || ''}
                        onChange={(value) => setSelectedCategoryId(value || '')}
                      />
                      <TextInput
                        label="搜索材料"
                        value={materialSearch}
                        onChange={(event) => setMaterialSearch(event.currentTarget.value)}
                        placeholder="例如：钢化玻璃"
                      />
                    </Group>

                    <Group grow align="flex-end">
                      <Select
                        label="选中材料"
                        data={selectableMaterials.map((item) => ({
                          value: item.id || '',
                          label: `${item.name} / 销售价 ${item.retailPrice.toFixed(2)}`,
                        }))}
                        value={selectedMaterialId}
                        onChange={setSelectedMaterialId}
                        searchable
                      />
                      <NumberInput
                        label="数量系数"
                        value={selectedQuantity}
                        onChange={(value) => setSelectedQuantity(Number(value) || 1)}
                        min={0.01}
                      />
                      <Button
                        onClick={() => {
                          if (!selectedMaterialId) return;
                          addMaterialToProduct(selectedMaterialId, selectedQuantity);
                          setSelectedMaterialId(null);
                          setSelectedQuantity(1);
                        }}
                      >
                        加入组合
                      </Button>
                    </Group>
                  </Stack>
                </Paper>

                <Paper withBorder radius={12} p="md" style={{ flex: 1, minHeight: 0 }}>
                  <ScrollArea className="soft-scroll" h="100%">
                    <Stack gap="md">
                      {groupedSelectableMaterials.map((group) => {
                        const collapsed = collapsedCategoryIds.includes(group.id);
                        return (
                          <Paper key={group.id} withBorder radius={12} p="sm" bg="var(--bg-subtle)">
                            <Stack gap="sm">
                              <Group justify="space-between">
                                <Box>
                                  <Text fw={700}>{group.name}</Text>
                                  <Text size="sm" c="dimmed">{group.items.length} 条材料</Text>
                                </Box>
                                <Button size="compact-sm" variant="subtle" onClick={() => toggleCategoryCollapse(group.id)}>
                                  {collapsed ? '展开' : '收起'}
                                </Button>
                              </Group>
                              {collapsed ? null : (
                                <SimpleGrid cols={{ base: 1, xl: 2 }} spacing="sm">
                                  {group.items.map((material) => (
                                    <Paper
                                      key={material.id}
                                      withBorder
                                      radius={12}
                                      p="sm"
                                      bg="#fff"
                                      draggable
                                      onDragStart={(event) => {
                                        event.dataTransfer.setData('text/material-id', material.id || '');
                                      }}
                                    >
                                      <Stack gap="sm">
                                        <Box>
                                          <Text fw={700}>{material.name}</Text>
                                          <Text size="sm" c="dimmed" mt={4}>
                                            {material.unitLabel}
                                          </Text>
                                        </Box>
                                        <Group gap="xs">
                                          <Badge variant="light">成本 {material.costPrice.toFixed(2)}</Badge>
                                          <Badge variant="light">销售 {material.retailPrice.toFixed(2)}</Badge>
                                        </Group>
                                        <Button size="compact-sm" variant="subtle" onClick={() => addMaterialToProduct(material.id || '', 1)}>
                                          快速加入
                                        </Button>
                                      </Stack>
                                    </Paper>
                                  ))}
                                </SimpleGrid>
                              )}
                            </Stack>
                          </Paper>
                        );
                      })}
                    </Stack>
                  </ScrollArea>
                </Paper>
              </Stack>
            </Box>

            <SimpleGrid cols={{ base: 1, xl: 3 }} spacing="md">
              <Paper withBorder radius={12} p="md" bg="var(--bg-subtle)">
                <Text size="sm" c="dimmed">当前组合材料数</Text>
                <Title order={3} mt={6}>{currentPreview.length}</Title>
              </Paper>
              <Paper withBorder radius={12} p="md" bg="var(--bg-subtle)">
                <Text size="sm" c="dimmed">预估成本合计</Text>
                <Title order={3} mt={6}>{previewTotals.cost.toFixed(2)}</Title>
              </Paper>
              <Paper withBorder radius={12} p="md" bg="var(--bg-subtle)">
                <Text size="sm" c="dimmed">预估销售合计</Text>
                <Title order={3} mt={6}>{previewTotals.retail.toFixed(2)}</Title>
              </Paper>
            </SimpleGrid>

            {previewCategoryTotals.length > 0 ? (
              <Paper withBorder radius={12} p="md">
                <Stack gap="sm">
                  <Title order={5}>分类价格汇总</Title>
                  <SimpleGrid cols={{ base: 1, xl: 2 }} spacing="sm">
                    {previewCategoryTotals.map((group) => (
                      <Paper key={group.label} withBorder radius={10} p="sm" bg="var(--bg-subtle)">
                        <Group justify="space-between">
                          <Box>
                            <Text fw={700}>{group.label}</Text>
                            <Text size="sm" c="dimmed">{group.count} 项材料</Text>
                          </Box>
                          <Box ta="right">
                            <Text size="xs" c="dimmed">成本 {group.cost.toFixed(2)}</Text>
                            <Text fw={700}>销售 {group.retail.toFixed(2)}</Text>
                          </Box>
                        </Group>
                      </Paper>
                    ))}
                  </SimpleGrid>
                </Stack>
              </Paper>
            ) : null}

            <Group>
              <Button leftSection={<IconPlus size={16} />} onClick={saveProduct}>
                {editingProductId ? '保存当前组合修改' : '保存新组合'}
              </Button>
              <Button variant="default" onClick={exportCurrentCombination} disabled={currentPreview.length === 0 || !productName.trim()}>
                导出当前组合明细
              </Button>
              <Button
                variant="subtle"
                onClick={() => {
                  setEditingProductId(null);
                  setProductName('');
                  setPricingMode('area');
                  setProductItems([]);
                }}
              >
                清空当前编辑
              </Button>
            </Group>
          </Stack>
        </Paper>
      </Box>
    </PageScaffold>
  );
}
