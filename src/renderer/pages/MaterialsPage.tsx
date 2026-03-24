import React, { useEffect, useMemo, useState } from 'react';
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Center,
  Checkbox,
  FileButton,
  Group,
  Modal,
  NumberInput,
  Paper,
  Pagination,
  Select,
  Stack,
  Switch,
  Table,
  Tabs,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import {
  IconArrowDown,
  IconArrowUp,
  IconCategory,
  IconCheck,
  IconCirclePlus,
  IconCopy,
  IconDatabaseImport,
  IconDownload,
  IconEdit,
  IconHistory,
  IconList,
  IconPercentage,
  IconSearch,
  IconStar,
  IconTrash,
  IconX,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import * as XLSX from 'xlsx';

import { PageScaffold } from '../components/ui/PageScaffold';
import { MaterialFormModal } from '../features/materials/MaterialFormModal';
import { PricingModesTab } from '../features/materials/PricingModesTab';
import {
  useCreateMaterial,
  useCreateMaterialCategory,
  useDeleteMaterial,
  useDeleteMaterialCategory,
  useMaterialCategories,
  useMaterialPricingModes,
  useMaterials,
  useUpdateMaterial,
  useUpdateMaterialCategory,
} from '../hooks/useWindowApi';
import { MaterialItem } from '../../shared/schemas';

const defaultUnitTextMap: Record<string, string> = {
  area: '按面积',
  perimeter: '按长度',
  fixed: '按件数',
};

const defaultUnitDisplayMap: Record<string, string> = {
  area: '平方米/m²',
  perimeter: '米/m',
  fixed: '件/pcs',
};

const ITEMS_PER_PAGE = 10;

const EMPTY_FORM = {
  categoryId: '',
  name: '',
  unitType: 'area',
  costPrice: 0,
  retailPrice: 0,
};

export default function MaterialsPage() {
  const { data: categories = [] } = useMaterialCategories();
  const { data: pricingModes = [] } = useMaterialPricingModes();
  const { data: materials = [] } = useMaterials();
  const createCategory = useCreateMaterialCategory();
  const createMaterial = useCreateMaterial();
  const updateMaterial = useUpdateMaterial();
  const deleteMaterial = useDeleteMaterial();

  const [activeTab, setActiveTab] = useState<string | null>('list');
  const [selectedCategoryId, setSelectedCategoryId] = useState('all');
  const [keyword, setKeyword] = useState('');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<string[]>([]);
  const [favoriteMaterialIds, setFavoriteMaterialIds] = useState<string[]>([]);
  const [recentMaterialIds, setRecentMaterialIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [bulkAdjustment, setBulkAdjustment] = useState<number | ''>('');
  const [bulkAdjustOpened, setBulkAdjustOpened] = useState(false);
  const [createModalOpened, setCreateModalOpened] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<MaterialItem | null>(null);

  useEffect(() => {
    const favoriteRaw = window.localStorage.getItem('material-favorites');
    const recentRaw = window.localStorage.getItem('material-recent');
    try {
      if (favoriteRaw) setFavoriteMaterialIds(JSON.parse(favoriteRaw));
      if (recentRaw) setRecentMaterialIds(JSON.parse(recentRaw));
    } catch {
      // ignore malformed local cache
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem('material-favorites', JSON.stringify(favoriteMaterialIds));
  }, [favoriteMaterialIds]);

  useEffect(() => {
    window.localStorage.setItem('material-recent', JSON.stringify(recentMaterialIds));
  }, [recentMaterialIds]);

  useEffect(() => {
    setPage(1);
  }, [keyword, selectedCategoryId, showFavoritesOnly]);

  const pricingModeMap = useMemo(
    () => new Map<string, (typeof pricingModes)[number]>(pricingModes.map((mode) => [mode.id || '', mode] as const)),
    [pricingModes],
  );

  const formatUnitDisplay = (unitType: string, unitLabel?: string) => {
    if (unitLabel?.includes('/')) return unitLabel;
    if (defaultUnitDisplayMap[unitType]) return defaultUnitDisplayMap[unitType];
    return unitLabel || '-';
  };

  const reverseUnitTextMap = useMemo(() => {
    const pairs: Array<readonly [string, string]> = pricingModes.flatMap((mode) => ([
      [mode.name, mode.id || ''] as const,
      [defaultUnitTextMap[mode.id || ''] || '', mode.id || ''] as const,
    ]));
    return new Map(pairs.filter(([key, value]) => key && value));
  }, [pricingModes]);

  const filteredMaterials = useMemo(() => (
    materials.filter((item) => {
      const matchesCategory = selectedCategoryId === 'all' || item.categoryId === selectedCategoryId;
      const categoryName = categories.find((category) => category.id === item.categoryId)?.name || '';
      const pricingModeName = pricingModeMap.get(item.unitType)?.name || '';
      const matchesKeyword = `${item.name} ${categoryName} ${pricingModeName}`.toLowerCase().includes(keyword.toLowerCase());
      const matchesFavorites = !showFavoritesOnly || favoriteMaterialIds.includes(item.id || '');
      return matchesCategory && matchesKeyword && matchesFavorites;
    })
  ), [categories, favoriteMaterialIds, keyword, materials, pricingModeMap, selectedCategoryId, showFavoritesOnly]);

  const recentMaterials = useMemo(
    () => recentMaterialIds.map((id) => materials.find((material) => material.id === id)).filter(Boolean) as MaterialItem[],
    [materials, recentMaterialIds],
  );

  const totalPages = Math.max(1, Math.ceil(filteredMaterials.length / ITEMS_PER_PAGE));
  const pagedMaterials = useMemo(() => {
    const start = (page - 1) * ITEMS_PER_PAGE;
    return filteredMaterials.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredMaterials, page]);

  const allCurrentPageSelected = pagedMaterials.length > 0 && pagedMaterials.every((material) => selectedMaterialIds.includes(material.id || ''));
  const someCurrentPageSelected = pagedMaterials.some((material) => selectedMaterialIds.includes(material.id || ''));

  const markRecent = (id: string) => {
    setRecentMaterialIds((prev) => [id, ...prev.filter((item) => item !== id)].slice(0, 10));
  };

  const toggleMaterialSelection = (id: string) => {
    setSelectedMaterialIds((prev) => prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]);
  };

  const handleBulkAdjust = async () => {
    const percentage = Number(bulkAdjustment);
    if (selectedMaterialIds.length === 0 || !Number.isFinite(percentage) || percentage === 0) return;

    notifications.show({ id: 'adjusting', title: '批量调价中', message: '正在更新选中材料...', loading: true, autoClose: false });
    try {
      await Promise.all(selectedMaterialIds.map((id) => {
        const material = materials.find((item) => item.id === id);
        if (!material) return Promise.resolve();
        return updateMaterial.mutateAsync({
          id,
          data: {
            retailPrice: Number((material.retailPrice * (1 + percentage / 100)).toFixed(2)),
          },
        });
      }));
      notifications.update({ id: 'adjusting', title: '调价成功', message: `已更新 ${selectedMaterialIds.length} 项材料`, color: 'teal', loading: false, autoClose: 3000 });
      setBulkAdjustOpened(false);
      setBulkAdjustment('');
      setSelectedMaterialIds([]);
    } catch (error: any) {
      notifications.update({ id: 'adjusting', title: '调价失败', message: error.message || '部分数据更新失败', color: 'red', loading: false, autoClose: 3000 });
    }
  };

  const handleBulkDelete = async () => {
    if (selectedMaterialIds.length === 0) return;
    if (!window.confirm(`确定删除选中的 ${selectedMaterialIds.length} 项材料吗？`)) return;

    try {
      await Promise.all(selectedMaterialIds.map((id) => deleteMaterial.mutateAsync(id)));
      notifications.show({ title: '删除成功', message: '选中材料已删除', color: 'teal' });
      setSelectedMaterialIds([]);
    } catch (error: any) {
      notifications.show({ title: '删除失败', message: error.message || '部分材料删除失败', color: 'red' });
    }
  };

  const handleDuplicate = async (material: MaterialItem) => {
    try {
      await createMaterial.mutateAsync({
        ...material,
        id: undefined,
        createdAt: undefined,
        updatedAt: undefined,
        name: `${material.name} (副本)`,
      } as any);
      notifications.show({ title: '复制成功', message: `已创建 ${material.name} 的副本`, color: 'teal' });
    } catch {
      notifications.show({ title: '复制失败', message: '当前材料无法复制', color: 'red' });
    }
  };

  const handleDownloadTemplate = () => {
    const firstMode = pricingModes[0];
    const templateData = [{
      材料名称: '示例铝材A',
      所属分类: categories[0]?.name || '默认分类',
      计价方式: firstMode?.name || '按面积',
      成本单价: 100,
      销售单价: 150,
    }];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(templateData);
    XLSX.utils.book_append_sheet(wb, ws, '导入模版');
    XLSX.writeFile(wb, '雷犀材料库导入模版.xlsx');
  };

  const handleImport = async (file: File | null) => {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<any>(sheet);
        const categoryMap = new Map(categories.map((category) => [category.name, category.id || '']));

        notifications.show({ id: 'import', title: '导入中', message: '正在写入材料数据...', loading: true, autoClose: false });

        for (const row of rows) {
          const name = String(row['材料名称'] || '').trim();
          const categoryName = String(row['所属分类'] || '').trim();
          const modeName = String(row['计价方式'] || '').trim();
          if (!name || !categoryName) continue;

          let categoryId = categoryMap.get(categoryName) || '';
          if (!categoryId) {
            const created = await createCategory.mutateAsync({ name: categoryName, sortOrder: categories.length, allowMultipleInProduct: 0 });
            categoryId = created.data.id || '';
            categoryMap.set(categoryName, categoryId);
          }

          const modeId = reverseUnitTextMap.get(modeName) || 'area';
          const mode = pricingModeMap.get(modeId);
          await createMaterial.mutateAsync({
            name,
            categoryId,
            unitType: modeId,
            unitLabel: mode?.unitLabel || '㎡',
            costPrice: Number(row['成本单价']) || 0,
            retailPrice: Number(row['销售单价']) || 0,
          });
        }

        notifications.update({ id: 'import', title: '导入成功', message: '材料库已更新', color: 'teal', loading: false, autoClose: 3000 });
      } catch {
        notifications.update({ id: 'import', title: '导入失败', message: '请检查模板格式', color: 'red', loading: false, autoClose: 3000 });
      }
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <PageScaffold
      title="材料库"
      description="管理材料、分类和单位。材料表格已调整为更紧凑的操作模式。"
      actions={
        <Group gap="xs">
          <Button variant="subtle" color="gray" leftSection={<IconDownload size={18} />} onClick={handleDownloadTemplate}>
            下载模板
          </Button>
          <FileButton onChange={handleImport} accept=".xlsx,.xls">
            {(props) => (
              <Button {...props} variant="default" leftSection={<IconDatabaseImport size={18} />}>
                批量导入
              </Button>
            )}
          </FileButton>
          <Button color="teal" leftSection={<IconCirclePlus size={18} />} onClick={() => setCreateModalOpened(true)}>
            新建材料
          </Button>
        </Group>
      }
    >
      <Tabs value={activeTab} onChange={setActiveTab} variant="pills" radius="xl">
        <Tabs.List mb="md" p={4} style={{ background: 'var(--mantine-color-gray-1)', borderRadius: 100, width: 'fit-content' }}>
          <Tabs.Tab value="list" color="teal" leftSection={<IconList size={18} />}>材料列表</Tabs.Tab>
          <Tabs.Tab value="pricingModes" color="blue" leftSection={<IconPercentage size={18} />}>单位</Tabs.Tab>
          <Tabs.Tab value="categories" color="orange" leftSection={<IconCategory size={18} />}>分类管理</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="list">
          <Stack gap="md">
            {recentMaterials.length > 0 && (
              <Paper withBorder p="xs" radius="md" bg="gray.0">
                <Group gap="xs">
                  <IconHistory size={16} color="gray" />
                  <Text size="xs" fw={700} c="dimmed">最近查看:</Text>
                  {recentMaterials.slice(0, 5).map((material) => (
                    <Button key={material.id} size="compact-xs" variant="white" color="gray" onClick={() => setKeyword(material.name)}>
                      {material.name}
                    </Button>
                  ))}
                </Group>
              </Paper>
            )}

            <Paper withBorder p="md" radius="md">
              <Stack gap="sm">
                <Group wrap="nowrap">
                  <Checkbox
                    label="本页全选"
                    color="teal"
                    checked={allCurrentPageSelected}
                    indeterminate={!allCurrentPageSelected && someCurrentPageSelected}
                    onChange={() => {
                      const pageIds = pagedMaterials.map((material) => material.id || '');
                      setSelectedMaterialIds((prev) => allCurrentPageSelected
                        ? prev.filter((id) => !pageIds.includes(id))
                        : Array.from(new Set([...prev, ...pageIds])));
                    }}
                  />
                  <TextInput
                    placeholder="搜索材料名称、分类、单位"
                    leftSection={<IconSearch size={18} />}
                    value={keyword}
                    onChange={(event) => setKeyword(event.currentTarget.value)}
                    style={{ flex: 1 }}
                  />
                  <Select
                    placeholder="分类"
                    data={[{ value: 'all', label: '全部' }, ...categories.map((category) => ({ value: category.id || '', label: category.name }))]}
                    value={selectedCategoryId}
                    onChange={(value) => setSelectedCategoryId(value || 'all')}
                    w={160}
                  />
                  <Switch label="仅看收藏" color="yellow" checked={showFavoritesOnly} onChange={(event) => setShowFavoritesOnly(event.currentTarget.checked)} />
                </Group>

                {selectedMaterialIds.length > 0 && (
                  <Group justify="space-between" p="xs" bg="teal.0" style={{ borderRadius: 8 }}>
                    <Text size="sm" fw={700} c="teal.9">已选中 {selectedMaterialIds.length} 项材料</Text>
                    <Group gap="sm">
                      <Button size="xs" color="teal" onClick={() => setBulkAdjustOpened(true)}>
                        批量调价
                      </Button>
                      <Button size="xs" variant="light" color="gray" onClick={() => setSelectedMaterialIds([])}>
                        清空选择
                      </Button>
                      <Button size="xs" variant="light" color="red" leftSection={<IconTrash size={14} />} onClick={handleBulkDelete}>
                        批量删除
                      </Button>
                    </Group>
                  </Group>
                )}
              </Stack>
            </Paper>

            <Box style={{ minHeight: 400 }}>
              {pagedMaterials.length > 0 ? (
                <>
                  <Paper withBorder radius="md" style={{ overflow: 'hidden' }}>
                    <Table highlightOnHover striped verticalSpacing="sm" horizontalSpacing="md">
                      <Table.Thead bg="gray.0">
                        <Table.Tr>
                          <Table.Th ta="center" w={60}></Table.Th>
                          <Table.Th ta="center">材料名称</Table.Th>
                          <Table.Th ta="center">分类</Table.Th>
                          <Table.Th ta="center">单位名称</Table.Th>
                          <Table.Th ta="center">单位</Table.Th>
                          <Table.Th ta="center">成本单价</Table.Th>
                          <Table.Th ta="center">销售单价</Table.Th>
                          <Table.Th ta="center">操作</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {pagedMaterials.map((material) => {
                          const category = categories.find((item) => item.id === material.categoryId);
                          const pricingMode = pricingModeMap.get(material.unitType);
                          const isSelected = selectedMaterialIds.includes(material.id || '');
                          const isFavorite = favoriteMaterialIds.includes(material.id || '');

                          return (
                            <Table.Tr
                              key={material.id}
                              bg={isSelected ? 'teal.0' : undefined}
                              style={{ cursor: 'pointer' }}
                              onClick={() => markRecent(material.id || '')}
                            >
                              <Table.Td ta="center">
                                <Checkbox
                                  checked={isSelected}
                                  color="teal"
                                  onClick={(event) => event.stopPropagation()}
                                  onChange={() => toggleMaterialSelection(material.id || '')}
                                />
                              </Table.Td>
                              <Table.Td ta="center">
                                <Text fw={700} size="sm">{material.name}</Text>
                              </Table.Td>
                              <Table.Td ta="center">
                                <Badge variant="light" color="gray">{category?.name || '未分类'}</Badge>
                              </Table.Td>
                              <Table.Td ta="center">
                                <Text size="sm">{pricingMode?.name || defaultUnitTextMap[material.unitType] || material.unitType}</Text>
                              </Table.Td>
                              <Table.Td ta="center">
                                <Text size="sm">{formatUnitDisplay(material.unitType, material.unitLabel || pricingMode?.unitLabel)}</Text>
                              </Table.Td>
                              <Table.Td ta="center">
                                <Text size="sm" fw={700} c="teal.8">¥ {material.costPrice.toFixed(2)}</Text>
                              </Table.Td>
                              <Table.Td ta="center">
                                <Text size="sm" fw={700} c="orange.8">¥ {material.retailPrice.toFixed(2)}</Text>
                              </Table.Td>
                              <Table.Td ta="center">
                                <Group gap={4} justify="center" wrap="nowrap">
                                  <Tooltip label="收藏">
                                    <ActionIcon
                                      variant={isFavorite ? 'filled' : 'subtle'}
                                      color="yellow"
                                      size="sm"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        setFavoriteMaterialIds((prev) => prev.includes(material.id || '')
                                          ? prev.filter((id) => id !== material.id)
                                          : [...prev, material.id || '']);
                                      }}
                                    >
                                      <IconStar size={16} fill={isFavorite ? 'currentColor' : 'none'} />
                                    </ActionIcon>
                                  </Tooltip>
                                  <Tooltip label="复制">
                                    <ActionIcon variant="light" color="cyan" size="sm" onClick={(event) => { event.stopPropagation(); handleDuplicate(material); }}>
                                      <IconCopy size={16} />
                                    </ActionIcon>
                                  </Tooltip>
                                  <Tooltip label="编辑">
                                    <ActionIcon variant="light" color="indigo" size="sm" onClick={(event) => { event.stopPropagation(); setEditingMaterial(material); }}>
                                      <IconEdit size={16} />
                                    </ActionIcon>
                                  </Tooltip>
                                  <Tooltip label="删除">
                                    <ActionIcon
                                      variant="light"
                                      color="red"
                                      size="sm"
                                      onClick={async (event) => {
                                        event.stopPropagation();
                                        if (window.confirm(`确定删除 ${material.name}？`)) {
                                          await deleteMaterial.mutateAsync(material.id || '');
                                        }
                                      }}
                                    >
                                      <IconTrash size={16} />
                                    </ActionIcon>
                                  </Tooltip>
                                </Group>
                              </Table.Td>
                            </Table.Tr>
                          );
                        })}
                      </Table.Tbody>
                    </Table>
                  </Paper>

                  {totalPages > 1 && (
                    <Center mt="xl" pb="lg">
                      <Pagination total={totalPages} value={page} onChange={setPage} color="teal" radius="xl" withEdges />
                    </Center>
                  )}
                </>
              ) : (
                <Center h={300}>
                  <Text c="dimmed">未找到匹配材料</Text>
                </Center>
              )}
            </Box>
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="pricingModes">
          <PricingModesTab />
        </Tabs.Panel>

        <Tabs.Panel value="categories">
          <CategoryManager materials={materials} />
        </Tabs.Panel>
      </Tabs>

      <MaterialFormModal
        opened={createModalOpened}
        title="新建材料"
        categories={categories}
        pricingModes={pricingModes}
        initialValues={{
          ...EMPTY_FORM,
          unitType: pricingModes[0]?.id || 'area',
        }}
        loading={createMaterial.isPending}
        onClose={() => setCreateModalOpened(false)}
        onSubmit={async (values) => {
          const pricingMode = pricingModeMap.get(values.unitType);
          await createMaterial.mutateAsync({
            ...values,
            unitLabel: pricingMode?.unitLabel || '',
          });
          setCreateModalOpened(false);
          notifications.show({ title: '添加成功', message: values.name, color: 'teal' });
        }}
      />

      <MaterialFormModal
        opened={!!editingMaterial}
        title="编辑材料"
        categories={categories}
        pricingModes={pricingModes}
        initialValues={editingMaterial ? {
          id: editingMaterial.id,
          categoryId: editingMaterial.categoryId,
          name: editingMaterial.name,
          unitType: editingMaterial.unitType,
          costPrice: editingMaterial.costPrice,
          retailPrice: editingMaterial.retailPrice,
        } : { ...EMPTY_FORM, unitType: pricingModes[0]?.id || 'area' }}
        loading={updateMaterial.isPending}
        onClose={() => setEditingMaterial(null)}
        onSubmit={async (values) => {
          const pricingMode = pricingModeMap.get(values.unitType);
          await updateMaterial.mutateAsync({
            id: values.id || '',
            data: {
              categoryId: values.categoryId,
              name: values.name,
              unitType: values.unitType,
              unitLabel: pricingMode?.unitLabel || '',
              costPrice: values.costPrice,
              retailPrice: values.retailPrice,
            },
          });
          setEditingMaterial(null);
          notifications.show({ title: '更新成功', message: values.name, color: 'teal' });
        }}
      />

      <Modal opened={bulkAdjustOpened} onClose={() => setBulkAdjustOpened(false)} title="批量调价" centered radius="md">
        <Stack>
          <Text size="sm" c="dimmed">对当前选中的 {selectedMaterialIds.length} 项材料统一调整销售单价。</Text>
          <NumberInput
            label="调价百分比"
            placeholder="例如 10 或 -5"
            suffix=" %"
            value={bulkAdjustment}
            onChange={(value) => setBulkAdjustment(typeof value === 'number' ? value : '')}
          />
          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => setBulkAdjustOpened(false)}>取消</Button>
            <Button color="teal" onClick={handleBulkAdjust}>应用</Button>
          </Group>
        </Stack>
      </Modal>
    </PageScaffold>
  );
}

function CategoryManager({ materials }: { materials: MaterialItem[] }) {
  const { data: categories = [] } = useMaterialCategories();
  const createCategory = useCreateMaterialCategory();
  const deleteCategory = useDeleteMaterialCategory();
  const updateCategory = useUpdateMaterialCategory();

  const [newName, setNewName] = useState('');
  const [newAllowMultiple, setNewAllowMultiple] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const handleMove = async (id: string, direction: number) => {
    const index = categories.findIndex((category) => category.id === id);
    const target = categories[index + direction];
    if (!target) return;

    await Promise.all([
      updateCategory.mutateAsync({ id, data: { sortOrder: target.sortOrder || 0 } }),
      updateCategory.mutateAsync({ id: target.id || '', data: { sortOrder: categories[index].sortOrder || 0 } }),
    ]);
  };

  return (
    <Stack gap="xl">
      <Paper withBorder p="md" radius="md" bg="gray.0">
        <Group align="flex-end">
          <TextInput label="新增分类" placeholder="输入名称..." style={{ flex: 1 }} value={newName} onChange={(event) => setNewName(event.currentTarget.value)} />
          <Switch label="允许组合重复" checked={newAllowMultiple} onChange={(event) => setNewAllowMultiple(event.currentTarget.checked)} />
          <Button
            color="orange"
            leftSection={<IconCirclePlus size={20} />}
            onClick={async () => {
              if (!newName.trim()) return;
              await createCategory.mutateAsync({
                name: newName.trim(),
                sortOrder: categories.length,
                allowMultipleInProduct: newAllowMultiple ? 1 : 0,
              });
              setNewName('');
              setNewAllowMultiple(false);
            }}
          >
            确认添加
          </Button>
        </Group>
      </Paper>

      <Paper withBorder radius="md" style={{ overflow: 'hidden' }}>
        <Table verticalSpacing="sm" horizontalSpacing="md">
          <Table.Thead bg="gray.1">
            <Table.Tr>
              <Table.Th ta="center" w={80}>序号</Table.Th>
              <Table.Th ta="center">分类名称</Table.Th>
              <Table.Th ta="center" w={150}>允许重复</Table.Th>
              <Table.Th ta="center" w={120}>排序</Table.Th>
              <Table.Th ta="center" w={120}>材料数</Table.Th>
              <Table.Th ta="center" w={200}>操作</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {categories.map((category, index) => {
              const count = materials.filter((material) => material.categoryId === category.id).length;
              const isEditing = editingId === category.id;

              return (
                <Table.Tr key={category.id}>
                  <Table.Td ta="center">
                    <Badge variant="light" color="orange">{index + 1}</Badge>
                  </Table.Td>
                  <Table.Td ta="center">
                    {isEditing ? (
                      <TextInput size="sm" value={editValue} onChange={(event) => setEditValue(event.currentTarget.value)} autoFocus />
                    ) : (
                      <Text fw={600}>{category.name}</Text>
                    )}
                  </Table.Td>
                  <Table.Td ta="center">
                    <Switch
                      checked={Boolean(category.allowMultipleInProduct)}
                      onChange={(event) => updateCategory.mutateAsync({
                        id: category.id || '',
                        data: { allowMultipleInProduct: event.currentTarget.checked ? 1 : 0 },
                      })}
                      onLabel="是"
                      offLabel="否"
                    />
                  </Table.Td>
                  <Table.Td ta="center">
                    <Group gap={4} justify="center">
                      <ActionIcon size="sm" variant="subtle" disabled={index === 0} onClick={() => handleMove(category.id || '', -1)}>
                        <IconArrowUp size={14} />
                      </ActionIcon>
                      <ActionIcon size="sm" variant="subtle" disabled={index === categories.length - 1} onClick={() => handleMove(category.id || '', 1)}>
                        <IconArrowDown size={14} />
                      </ActionIcon>
                    </Group>
                  </Table.Td>
                  <Table.Td ta="center">
                    <Badge variant="outline" color={count > 0 ? 'blue' : 'gray'}>{count}</Badge>
                  </Table.Td>
                  <Table.Td ta="center">
                    <Group gap="xs" justify="center">
                      {isEditing ? (
                        <>
                          <ActionIcon
                            color="teal"
                            onClick={async () => {
                              if (!editValue.trim()) return;
                              await updateCategory.mutateAsync({ id: category.id || '', data: { name: editValue.trim() } });
                              setEditingId(null);
                            }}
                          >
                            <IconCheck size={18} />
                          </ActionIcon>
                          <ActionIcon color="gray" onClick={() => setEditingId(null)}>
                            <IconX size={18} />
                          </ActionIcon>
                        </>
                      ) : (
                        <>
                          <ActionIcon variant="subtle" color="indigo" onClick={() => { setEditingId(category.id || ''); setEditValue(category.name); }}>
                            <IconEdit size={18} />
                          </ActionIcon>
                          <ActionIcon variant="subtle" color="red" onClick={() => setDeleteConfirmId(category.id || '')}>
                            <IconTrash size={18} />
                          </ActionIcon>
                        </>
                      )}
                    </Group>
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      </Paper>

      <Modal opened={!!deleteConfirmId} onClose={() => setDeleteConfirmId(null)} title="确认删除" centered radius="md">
        <Stack>
          <Text size="sm">确定要删除分类 “{categories.find((category) => category.id === deleteConfirmId)?.name}” 吗？</Text>
          <Group justify="flex-end" mt="md">
            <Button variant="subtle" onClick={() => setDeleteConfirmId(null)}>取消</Button>
            <Button
              color="red"
              onClick={async () => {
                const count = materials.filter((material) => material.categoryId === deleteConfirmId).length;
                if (count > 0) {
                  notifications.show({ title: '无法删除', message: `仍有 ${count} 项材料关联`, color: 'red' });
                  return;
                }
                await deleteCategory.mutateAsync(deleteConfirmId || '');
                setDeleteConfirmId(null);
              }}
            >
              确认删除
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
