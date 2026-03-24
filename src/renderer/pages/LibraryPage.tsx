import React, { useMemo, useState } from 'react';
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
  Stack,
  Table,
  Tabs,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { IconArrowDown, IconArrowUp, IconPlus, IconTrash } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';

import {
  useCreateMaterial,
  useCreateMaterialCategory,
  useCreatePricingProduct,
  useCreatePricingRate,
  useDeleteMaterial,
  useDeleteMaterialCategory,
  useDeletePricingProduct,
  useDeletePricingRate,
  useMaterialCategories,
  useMaterials,
  usePricingProducts,
  usePricingRates,
} from '../hooks/useWindowApi';
import { PageScaffold } from '../components/ui/PageScaffold';

const unitOptions = [
  { value: 'area', label: '按面积' },
  { value: 'perimeter', label: '按周长/长度' },
  { value: 'fixed', label: '按固定件数' },
];

const unitLabelMap: Record<string, string> = {
  area: '㎡',
  perimeter: 'm',
  fixed: '件',
};

const LibraryPage = () => {
  const { data: categories = [] } = useMaterialCategories();
  const { data: materials = [] } = useMaterials();
  const { data: products = [] } = usePricingProducts();
  const { data: rates = [] } = usePricingRates();

  const createCategory = useCreateMaterialCategory();
  const deleteCategory = useDeleteMaterialCategory();
  const createMaterial = useCreateMaterial();
  const deleteMaterial = useDeleteMaterial();
  const createProduct = useCreatePricingProduct();
  const deleteProduct = useDeletePricingProduct();
  const createRate = useCreatePricingRate();
  const deleteRate = useDeletePricingRate();

  const [categoryName, setCategoryName] = useState('');
  const [materialForm, setMaterialForm] = useState({
    categoryId: '',
    name: '',
    unitType: 'area' as 'area' | 'perimeter' | 'fixed',
    costPrice: 0,
    retailPrice: 0,
  });
  const [productName, setProductName] = useState('');
  const [pricingMode, setPricingMode] = useState<'area' | 'perimeter' | 'fixed'>('area');
  const [selectedMaterialId, setSelectedMaterialId] = useState<string | null>(null);
  const [selectedQuantity, setSelectedQuantity] = useState(1);
  const [productItems, setProductItems] = useState<{ materialId: string; quantity: number; calcMode: 'area' | 'perimeter' | 'fixed' }[]>([]);
  const [rateName, setRateName] = useState('');
  const [rateValue, setRateValue] = useState(0);
  const [materialKeyword, setMaterialKeyword] = useState('');
  const [productKeyword, setProductKeyword] = useState('');
  const [productMaterialCategoryId, setProductMaterialCategoryId] = useState<string | null>(null);
  const [bootstrapping, setBootstrapping] = useState(false);

  const productPreview = useMemo(
    () => productItems.map((item) => ({
      ...item,
      material: materials.find((entry) => entry.id === item.materialId),
    })),
    [materials, productItems],
  );

  const filteredMaterials = useMemo(
    () => materials.filter((item) => `${item.name} ${categories.find((entry) => entry.id === item.categoryId)?.name || ''}`.toLowerCase().includes(materialKeyword.toLowerCase())),
    [categories, materialKeyword, materials],
  );

  const filteredProducts = useMemo(
    () => products.filter((item) => `${item.name} ${item.items.map((entry) => entry.materialName || '').join(' ')}`.toLowerCase().includes(productKeyword.toLowerCase())),
    [productKeyword, products],
  );

  const selectableMaterials = useMemo(
    () => materials.filter((item) => {
      const matchesCategory = !productMaterialCategoryId || item.categoryId === productMaterialCategoryId;
      return matchesCategory;
    }),
    [materials, productMaterialCategoryId],
  );

  const addProductItem = () => {
    if (!selectedMaterialId) return;
    setProductItems((items) => [...items, { materialId: selectedMaterialId, quantity: selectedQuantity, calcMode: pricingMode }]);
    setSelectedMaterialId(null);
    setSelectedQuantity(1);
  };

  const bootstrapDefaults = async () => {
    if (bootstrapping) return;
    setBootstrapping(true);
    try {
      const defaultCategories = ['玻璃', '隔条', '辅料', '五金'];
      for (const [index, name] of defaultCategories.entries()) {
        if (!categories.some((item) => item.name === name)) {
          await createCategory.mutateAsync({ name, sortOrder: index, allowMultipleInProduct: 0 });
        }
      }

      const ratePresets = [
        { name: '安装费', percentage: 3 },
        { name: '运输费', percentage: 2 },
      ];
      for (const rate of ratePresets) {
        if (!rates.some((item) => item.name === rate.name)) {
          await createRate.mutateAsync({ ...rate, isActive: 1 });
        }
      }

      notifications.show({ title: '已完成初始化', message: '常用分类和费率已建立，可直接开始录入材料。', color: 'blue' });
    } finally {
      setBootstrapping(false);
    }
  };

  const moveProductItem = (index: number, direction: -1 | 1) => {
    setProductItems((items) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= items.length) return items;
      const cloned = [...items];
      const [target] = cloned.splice(index, 1);
      cloned.splice(nextIndex, 0, target);
      return cloned;
    });
  };

  return (
    <PageScaffold
      title="材料与产品"
      description="先建材料分类，再录入材料，再把多个材料组合成产品。报价中心会直接使用这里的数据。"
      actions={
        <Button variant="default" onClick={bootstrapDefaults} loading={bootstrapping}>
          一键建立常用分类
        </Button>
      }
    >
      <Paper withBorder radius={12} h="100%" p="md">
        <Tabs defaultValue="categories" h="100%">
          <Tabs.List>
            <Tabs.Tab value="categories">分类</Tabs.Tab>
            <Tabs.Tab value="materials">材料</Tabs.Tab>
            <Tabs.Tab value="products">产品组合</Tabs.Tab>
            <Tabs.Tab value="rates">附加费率</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="categories" pt="md" h="calc(100% - 42px)">
            <Box style={{ display: 'grid', gridTemplateColumns: '320px minmax(0, 1fr)', gap: 12, height: '100%' }}>
              <Paper withBorder p="md" radius={12}>
                <Stack>
                  <Title order={4}>新建分类</Title>
                  <Text size="sm" c="dimmed">
                    新手建议先点右上角“一键建立常用分类”，再补充自己的分类名称。
                  </Text>
                  <TextInput value={categoryName} onChange={(event) => setCategoryName(event.currentTarget.value)} placeholder="例如：玻璃、隔条、辅料" />
                  <Button
                    leftSection={<IconPlus size={16} />}
                    onClick={async () => {
                      if (!categoryName.trim()) return;
                      await createCategory.mutateAsync({ name: categoryName.trim(), sortOrder: categories.length, allowMultipleInProduct: 0 });
                      setCategoryName('');
                    }}
                  >
                    保存分类
                  </Button>
                </Stack>
              </Paper>

              <Paper withBorder p="md" radius={12}>
                <ScrollArea className="soft-scroll" h="100%">
                  <Table>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>名称</Table.Th>
                        <Table.Th>材料数</Table.Th>
                        <Table.Th></Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {categories.map((category) => (
                        <Table.Tr key={category.id}>
                          <Table.Td>{category.name}</Table.Td>
                          <Table.Td>{materials.filter((item) => item.categoryId === category.id).length}</Table.Td>
                          <Table.Td>
                            <ActionIcon color="red" variant="subtle" onClick={() => deleteCategory.mutate(category.id || '')}>
                              <IconTrash size={16} />
                            </ActionIcon>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </ScrollArea>
              </Paper>
            </Box>
          </Tabs.Panel>

          <Tabs.Panel value="materials" pt="md" h="calc(100% - 42px)">
            <Box style={{ display: 'grid', gridTemplateColumns: '360px minmax(0, 1fr)', gap: 12, height: '100%' }}>
              <Paper withBorder p="md" radius={12}>
                <Stack>
                  <Title order={4}>新增材料</Title>
                  <Text size="sm" c="dimmed">
                    添加顺序建议：先选分类，再填名称，再录成本和销售单价。
                  </Text>
                  <Select
                    label="所属分类"
                    data={categories.map((item) => ({ value: item.id || '', label: item.name }))}
                    value={materialForm.categoryId}
                    onChange={(value) => setMaterialForm((form) => ({ ...form, categoryId: value || '' }))}
                  />
                  <TextInput
                    label="材料名称"
                    value={materialForm.name}
                    onChange={(event) => setMaterialForm((form) => ({ ...form, name: event.currentTarget.value }))}
                  />
                  <Select
                    label="计价方式"
                    data={unitOptions}
                    value={materialForm.unitType}
                    onChange={(value) => setMaterialForm((form) => ({ ...form, unitType: (value as 'area' | 'perimeter' | 'fixed') || 'area' }))}
                  />
                  <NumberInput
                    label="成本单价"
                    value={materialForm.costPrice}
                    onChange={(value) => setMaterialForm((form) => ({ ...form, costPrice: Number(value) || 0 }))}
                    min={0}
                  />
                  <NumberInput
                    label="销售单价"
                    value={materialForm.retailPrice}
                    onChange={(value) => setMaterialForm((form) => ({ ...form, retailPrice: Number(value) || 0 }))}
                    min={0}
                  />
                  <Button
                    leftSection={<IconPlus size={16} />}
                    onClick={async () => {
                      if (!materialForm.categoryId || !materialForm.name.trim()) return;
                      await createMaterial.mutateAsync({
                        ...materialForm,
                        name: materialForm.name.trim(),
                        unitLabel: unitLabelMap[materialForm.unitType],
                      });
                      setMaterialForm({ categoryId: '', name: '', unitType: 'area', costPrice: 0, retailPrice: 0 });
                    }}
                  >
                    保存材料
                  </Button>
                </Stack>
              </Paper>

              <Paper withBorder p="md" radius={12}>
                <Stack gap="sm">
                  <TextInput placeholder="搜索材料" value={materialKeyword} onChange={(event) => setMaterialKeyword(event.currentTarget.value)} />
                  <ScrollArea className="soft-scroll" h="calc(100% - 48px)">
                    <Table>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>材料名称</Table.Th>
                          <Table.Th>分类</Table.Th>
                          <Table.Th>方式</Table.Th>
                          <Table.Th>成本</Table.Th>
                          <Table.Th>销售</Table.Th>
                          <Table.Th></Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {filteredMaterials.map((material) => (
                          <Table.Tr key={material.id}>
                            <Table.Td>{material.name}</Table.Td>
                            <Table.Td>{categories.find((item) => item.id === material.categoryId)?.name || '-'}</Table.Td>
                            <Table.Td>{material.unitLabel}</Table.Td>
                            <Table.Td>{material.costPrice}</Table.Td>
                            <Table.Td>{material.retailPrice}</Table.Td>
                            <Table.Td>
                              <ActionIcon color="red" variant="subtle" onClick={() => deleteMaterial.mutate(material.id || '')}>
                                <IconTrash size={16} />
                              </ActionIcon>
                            </Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  </ScrollArea>
                </Stack>
              </Paper>
            </Box>
          </Tabs.Panel>

          <Tabs.Panel value="products" pt="md" h="calc(100% - 42px)">
            <Box style={{ display: 'grid', gridTemplateColumns: '420px minmax(0, 1fr)', gap: 12, height: '100%' }}>
              <Paper withBorder p="md" radius={12}>
                <Stack>
                  <Title order={4}>新建产品组合</Title>
                  <Text size="sm" c="dimmed">
                    做法很简单：先输入产品名，再把需要的材料逐个加入，最后保存。
                  </Text>
                  <TextInput value={productName} onChange={(event) => setProductName(event.currentTarget.value)} label="产品名称" placeholder="例如：中空玻璃 A 款" />
                  <Select label="主计价方式" data={unitOptions} value={pricingMode} onChange={(value) => setPricingMode((value as any) || 'area')} />

                  <Group align="flex-end">
                    <Select
                      label="分类筛选"
                      w={140}
                      data={[{ value: '', label: '全部分类' }, ...categories.map((item) => ({ value: item.id || '', label: item.name }))]}
                      value={productMaterialCategoryId || ''}
                      onChange={(value) => setProductMaterialCategoryId(value || null)}
                    />
                    <Select
                      label="选择材料"
                      style={{ flex: 1 }}
                      data={selectableMaterials.map((item) => ({ value: item.id || '', label: item.name }))}
                      value={selectedMaterialId}
                      onChange={setSelectedMaterialId}
                      searchable
                    />
                    <NumberInput label="数量系数" w={100} value={selectedQuantity} onChange={(value) => setSelectedQuantity(Number(value) || 1)} min={0.01} />
                    <Button variant="default" onClick={addProductItem}>加入</Button>
                  </Group>

                  <Paper withBorder radius={12} p="sm">
                    <Stack gap="xs">
                      {productPreview.length === 0 ? (
                        <Text size="sm" c="dimmed">还没有加入材料。</Text>
                      ) : productPreview.map((item, index) => (
                        <Group key={`${item.materialId}-${index}`} justify="space-between">
                          <Box>
                            <Text size="sm" fw={600}>{item.material?.name}</Text>
                            <Text size="xs" c="dimmed">数量系数 {item.quantity}</Text>
                          </Box>
                          <Group gap={4}>
                            <ActionIcon variant="subtle" onClick={() => moveProductItem(index, -1)} disabled={index === 0}>
                              <IconArrowUp size={16} />
                            </ActionIcon>
                            <ActionIcon variant="subtle" onClick={() => moveProductItem(index, 1)} disabled={index === productPreview.length - 1}>
                              <IconArrowDown size={16} />
                            </ActionIcon>
                            <ActionIcon
                              color="red"
                              variant="subtle"
                              onClick={() => setProductItems((items) => items.filter((_, current) => current !== index))}
                            >
                              <IconTrash size={16} />
                            </ActionIcon>
                          </Group>
                        </Group>
                      ))}
                    </Stack>
                  </Paper>

                  <Button
                    leftSection={<IconPlus size={16} />}
                    onClick={async () => {
                      if (!productName.trim() || productItems.length === 0) {
                        notifications.show({ title: '信息不完整', message: '请输入产品名称并加入至少一个材料。', color: 'red' });
                        return;
                      }
                      await createProduct.mutateAsync({
                        name: productName.trim(),
                        pricingMode,
                        items: productItems.map((item, index) => ({
                          ...item,
                          calcMode: item.calcMode || pricingMode,
                          sortOrder: index,
                        })),
                      });
                      setProductName('');
                      setPricingMode('area');
                      setProductItems([]);
                    }}
                  >
                    保存产品
                  </Button>
                </Stack>
              </Paper>

              <Paper withBorder p="md" radius={12}>
                <Stack gap="sm" h="100%">
                  <TextInput placeholder="搜索产品" value={productKeyword} onChange={(event) => setProductKeyword(event.currentTarget.value)} />
                  <ScrollArea className="soft-scroll" h="calc(100% - 48px)">
                    <Stack gap="sm">
                    {filteredProducts.map((product) => (
                      <Paper key={product.id} withBorder radius={12} p="md">
                        <Group justify="space-between" align="flex-start">
                          <Box>
                            <Group gap="xs">
                              <Text fw={700}>{product.name}</Text>
                              <Badge variant="light">{unitOptions.find((item) => item.value === product.pricingMode)?.label}</Badge>
                            </Group>
                            <Text size="sm" c="dimmed" mt={6}>
                              {product.items.map((item) => `${item.materialName} x ${item.quantity}`).join('，') || '暂无材料'}
                            </Text>
                          </Box>
                          <Group gap="xs">
                            <Button
                              variant="subtle"
                              size="compact-sm"
                              onClick={() => {
                                setProductName(`${product.name} 副本`);
                                setPricingMode(product.pricingMode);
                                setProductItems(product.items.map((item) => ({
                                  materialId: item.materialId,
                                  quantity: item.quantity,
                                  calcMode: (item.calcMode as 'area' | 'perimeter' | 'fixed') || product.pricingMode,
                                })));
                              }}
                            >
                              复制
                            </Button>
                            <ActionIcon color="red" variant="subtle" onClick={() => deleteProduct.mutate(product.id || '')}>
                              <IconTrash size={16} />
                            </ActionIcon>
                          </Group>
                        </Group>
                      </Paper>
                    ))}
                    </Stack>
                  </ScrollArea>
                </Stack>
              </Paper>
            </Box>
          </Tabs.Panel>

          <Tabs.Panel value="rates" pt="md" h="calc(100% - 42px)">
            <Box style={{ display: 'grid', gridTemplateColumns: '320px minmax(0, 1fr)', gap: 12, height: '100%' }}>
              <Paper withBorder p="md" radius={12}>
                <Stack>
                  <Title order={4}>新增费率</Title>
                  <TextInput value={rateName} onChange={(event) => setRateName(event.currentTarget.value)} label="费率名称" placeholder="例如：安装费、运输费" />
                  <NumberInput value={rateValue} onChange={(value) => setRateValue(Number(value) || 0)} label="百分比" min={0} />
                  <Button
                    leftSection={<IconPlus size={16} />}
                    onClick={async () => {
                      if (!rateName.trim()) return;
                      await createRate.mutateAsync({ name: rateName.trim(), percentage: rateValue, isActive: 1 });
                      setRateName('');
                      setRateValue(0);
                    }}
                  >
                    保存费率
                  </Button>
                </Stack>
              </Paper>

              <Paper withBorder p="md" radius={12}>
                <Table>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>名称</Table.Th>
                      <Table.Th>百分比</Table.Th>
                      <Table.Th></Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {rates.map((rate) => (
                      <Table.Tr key={rate.id}>
                        <Table.Td>{rate.name}</Table.Td>
                        <Table.Td>{rate.percentage}%</Table.Td>
                        <Table.Td>
                          <ActionIcon color="red" variant="subtle" onClick={() => deleteRate.mutate(rate.id || '')}>
                            <IconTrash size={16} />
                          </ActionIcon>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Paper>
            </Box>
          </Tabs.Panel>
        </Tabs>
      </Paper>
    </PageScaffold>
  );
};

export default LibraryPage;
