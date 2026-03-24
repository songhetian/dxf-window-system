import React, { useMemo, useState, useEffect } from 'react';
import {
  ActionIcon,
  Box,
  Button,
  Checkbox,
  Group,
  Modal,
  NumberInput,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Tabs,
  Text,
  TextInput,
  Title,
  Badge,
  ThemeIcon,
  Table,
  Pagination,
  Divider,
  Center,
  FileButton,
  Tooltip,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import {
  IconEdit,
  IconSearch,
  IconStar,
  IconTrash,
  IconCategory,
  IconList,
  IconPackage,
  IconCirclePlus,
  IconDatabaseImport,
  IconCheck,
  IconX,
  IconTag,
  IconDownload,
  IconArrowUp,
  IconArrowDown,
  IconCopy,
  IconHistory,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import * as XLSX from 'xlsx';

import { PageScaffold } from '../components/ui/PageScaffold';
import {
  useCreateMaterial,
  useCreateMaterialCategory,
  useDeleteMaterial,
  useDeleteMaterialCategory,
  useMaterialCategories,
  useMaterials,
  useUpdateMaterialCategory,
  useUpdateMaterial,
} from '../hooks/useWindowApi';
import { MaterialItem } from '../../shared/schemas';

const unitLabelMap: Record<string, string> = {
  area: '㎡',
  perimeter: 'm',
  fixed: '件',
};

const unitTextMap: Record<string, string> = {
  area: '按面积',
  perimeter: '按长度',
  fixed: '按件数',
};

const reverseUnitTextMap: Record<string, string> = {
  '按面积': 'area',
  '按长度': 'perimeter',
  '按件数': 'fixed',
};

const unitOptions = [
  { value: 'area', label: '按面积 (㎡)' },
  { value: 'perimeter', label: '按长度 (m)' },
  { value: 'fixed', label: '按件数 (件)' },
];

const ITEMS_PER_PAGE = 10;

export default function MaterialsPage() {
  const { data: categories = [] } = useMaterialCategories();
  const { data: materials = [] } = useMaterials();
  const createCategory = useCreateMaterialCategory();
  const createMaterial = useCreateMaterial();
  const deleteMaterial = useDeleteMaterial();
  const updateMaterial = useUpdateMaterial();

  const [activeTab, setActiveTab] = useState<string | null>('list');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [keyword, setKeyword] = useState('');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<string[]>([]);
  const [favoriteMaterialIds, setFavoriteMaterialIds] = useState<string[]>([]);
  const [recentMaterialIds, setRecentMaterialIds] = useState<string[]>([]);
  const [bulkAdjustment, setBulkAdjustment] = useState(0);
  
  const [page, setPage] = useState(1);
  const [editingMaterial, setEditingMaterial] = useState<MaterialItem | null>(null);
  const [createModalOpened, setCreateModalOpened] = useState(false);

  const materialForm = useForm({
    initialValues: {
      categoryId: '',
      name: '',
      unitType: 'area' as string,
      costPrice: 0,
      retailPrice: 0,
    },
    validate: {
      name: (value) => (value.trim().length < 1 ? '请输入名称' : null),
      categoryId: (value) => (!value ? '请选择分类' : null),
    },
  });

  const editForm = useForm({
    initialValues: {
      id: '',
      categoryId: '',
      name: '',
      unitType: 'area' as string,
      costPrice: 0,
      retailPrice: 0,
    },
  });

  // --- 持久化逻辑 ---
  useEffect(() => {
    const favoriteRaw = window.localStorage.getItem('material-favorites');
    const recentRaw = window.localStorage.getItem('material-recent');
    try {
      if (favoriteRaw) setFavoriteMaterialIds(JSON.parse(favoriteRaw));
      if (recentRaw) setRecentMaterialIds(JSON.parse(recentRaw));
    } catch (e) {}
  }, []);

  useEffect(() => {
    window.localStorage.setItem('material-favorites', JSON.stringify(favoriteMaterialIds));
  }, [favoriteMaterialIds]);

  useEffect(() => {
    window.localStorage.setItem('material-recent', JSON.stringify(recentMaterialIds));
  }, [recentMaterialIds]);

  const markRecent = (id: string) => {
    setRecentMaterialIds(prev => [id, ...prev.filter(i => i !== id)].slice(0, 10));
  };

  // --- 业务逻辑功能 ---
  const handleBulkAdjust = async () => {
    if (selectedMaterialIds.length === 0 || bulkAdjustment === 0) return;
    notifications.show({ id: 'adjusting', title: '批量调价中', message: '正在同步更新数据...', loading: true, autoClose: false });
    try {
      await Promise.all(selectedMaterialIds.map(id => {
        const m = materials.find(i => i.id === id);
        if (!m) return Promise.resolve();
        const newPrice = Number((m.retailPrice * (1 + bulkAdjustment / 100)).toFixed(2));
        return updateMaterial.mutateAsync({ id, data: { retailPrice: newPrice } });
      }));
      notifications.update({ id: 'adjusting', title: '调价成功', message: `已更新 ${selectedMaterialIds.length} 项材料价格`, color: 'teal', loading: false, autoClose: 3000 });
      setSelectedMaterialIds([]);
      setBulkAdjustment(0);
    } catch (e) {
      notifications.update({ id: 'adjusting', title: '调价失败', message: '部分数据更新失败', color: 'red', loading: false, autoClose: 3000 });
    }
  };

  const handleBulkDelete = async () => {
    if (selectedMaterialIds.length === 0) return;
    if (!window.confirm(`确定要永久删除选中的 ${selectedMaterialIds.length} 项材料吗？此操作不可撤销。`)) return;
    try {
      await Promise.all(selectedMaterialIds.map(id => deleteMaterial.mutateAsync(id)));
      notifications.show({ title: '批量删除成功', message: `已移除 ${selectedMaterialIds.length} 项材料`, color: 'teal' });
      setSelectedMaterialIds([]);
    } catch (e: any) {
      notifications.show({ title: '删除失败', message: e.message || '部分项删除失败', color: 'red' });
    }
  };

  const handleDuplicate = async (material: MaterialItem) => {
    try {
      await createMaterial.mutateAsync({
        ...material,
        name: `${material.name} (副本)`,
        id: undefined,
        createdAt: undefined,
        updatedAt: undefined
      } as any);
      notifications.show({ title: '复制成功', message: `已创建 ${material.name} 的副本`, color: 'teal' });
    } catch (e) {
      notifications.show({ title: '复制失败', message: '操作无法完成', color: 'red' });
    }
  };

  // --- 过滤与分页 ---
  const filteredMaterials = useMemo(() => {
    return materials.filter((item) => {
      const matchesCategory = selectedCategoryId === 'all' || item.categoryId === selectedCategoryId;
      const categoryName = categories.find(c => c.id === item.categoryId)?.name || '';
      const matchesKeyword = (item.name + categoryName).toLowerCase().includes(keyword.toLowerCase());
      const matchesFavorites = !showFavoritesOnly || favoriteMaterialIds.includes(item.id || '');
      return matchesCategory && matchesKeyword && matchesFavorites;
    });
  }, [materials, categories, selectedCategoryId, keyword, showFavoritesOnly, favoriteMaterialIds]);

  const recentMaterials = useMemo(() => 
    recentMaterialIds.map(id => materials.find(m => m.id === id)).filter(Boolean) as MaterialItem[], 
  [materials, recentMaterialIds]);

  const totalPages = Math.ceil(filteredMaterials.length / ITEMS_PER_PAGE);
  const pagedMaterials = useMemo(() => {
    const start = (page - 1) * ITEMS_PER_PAGE;
    return filteredMaterials.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredMaterials, page]);

  useEffect(() => { setPage(1); }, [keyword, selectedCategoryId, showFavoritesOnly]);

  // --- 导入导出功能 ---
  const handleDownloadTemplate = () => {
    const templateData = [{ '材料名称': '示例铝材A', '所属分类': categories[0]?.name || '默认分类', '计价方式': '按面积', '成本单价': 100.00, '销售单价': 150.00 }];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(templateData);
    XLSX.utils.book_append_sheet(wb, ws, "导入模版");
    XLSX.writeFile(wb, "雷犀材料库导入模版.xlsx");
  };

  const handleImport = async (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<any>(sheet);
        notifications.show({ id: 'import', title: '导入中', message: '处理中...', loading: true });
        const categoryMap = new Map(categories.map(c => [c.name, c.id]));
        for (const row of json) {
          const name = String(row['材料名称'] || '').trim();
          const catName = String(row['所属分类'] || '').trim();
          if (!name || !catName) continue;
          let catId = categoryMap.get(catName);
          if (!catId) {
            const newC = await createCategory.mutateAsync({ name: catName, sortOrder: 0 });
            catId = newC.data.id;
            categoryMap.set(catName, catId);
          }
          const unitType = (reverseUnitTextMap[String(row['计价方式'])] || 'area') as any;
          await createMaterial.mutateAsync({ name, categoryId: catId!, unitType, unitLabel: unitLabelMap[unitType], costPrice: Number(row['成本单价']) || 0, retailPrice: Number(row['销售单价']) || 0 });
        }
        notifications.update({ id: 'import', title: '成功', message: '材料已同步', color: 'teal', loading: false });
      } catch (err) {
        notifications.update({ id: 'import', title: '错误', message: '导入失败', color: 'red', loading: false });
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const MaterialCard = ({ material }: { material: MaterialItem }) => {
    const category = categories.find(c => c.id === material.categoryId);
    const isSelected = selectedMaterialIds.includes(material.id || '');
    const isFavorite = favoriteMaterialIds.includes(material.id || '');

    return (
      <Paper withBorder radius="md" p="md" mb="sm" onClick={() => markRecent(material.id!)}
        style={{ 
          borderColor: isSelected ? 'var(--mantine-color-teal-5)' : undefined,
          backgroundColor: isSelected ? 'var(--mantine-color-teal-0)' : undefined,
          transition: 'all 0.2s ease', cursor: 'pointer'
        }}
      >
        <Group justify="space-between" wrap="nowrap">
          <Group gap="md" style={{ flex: 1.2 }}>
            <Checkbox checked={isSelected} color="teal" onClick={(e) => e.stopPropagation()} onChange={() => setSelectedMaterialIds(prev => isSelected ? prev.filter(id => id !== material.id) : [...prev, material.id || ''])} />
            <ThemeIcon variant="gradient" gradient={{ from: 'indigo', to: 'cyan' }} size="xl" radius="md"><IconPackage size={24} /></ThemeIcon>
            <Box style={{ minWidth: 200 }}>
              <Group gap="xs" mb={4} align="center">
                <Text fw={800} size="lg">{material.name}</Text>
                <Badge variant="gradient" gradient={{ from: 'teal', to: 'blue' }} leftSection={<IconTag size={12} />} radius="sm">{category?.name || '未分类'}</Badge>
              </Group>
              <Text size="xs" c="dimmed">计价方式：<Text span c="blue" fw={700}>{unitTextMap[material.unitType]}</Text> ({unitLabelMap[material.unitType]})</Text>
            </Box>
          </Group>

          <Group gap={80} style={{ flex: 2 }} justify="center">
            <Stack gap={0} align="center"><Text size="xs" c="dimmed" fw={700}>成本单价</Text><Text fw={900} size="xl" color="teal">¥ {material.costPrice.toFixed(2)}</Text></Stack>
            <Stack gap={0} align="center"><Text size="xs" c="dimmed" fw={700}>销售单价</Text><Text fw={900} size="xl" color="orange.8">¥ {material.retailPrice.toFixed(2)}</Text></Stack>
          </Group>

          <Group gap="xs" style={{ flex: 1 }} justify="flex-end">
            <Tooltip label="收藏"><ActionIcon variant={isFavorite ? 'filled' : 'subtle'} color="yellow" size="lg" onClick={(e) => { e.stopPropagation(); setFavoriteMaterialIds(prev => prev.includes(material.id!) ? prev.filter(i => i !== material.id) : [...prev, material.id!]); }}><IconStar size={20} fill={isFavorite ? 'currentColor' : 'none'} /></ActionIcon></Tooltip>
            <Tooltip label="复制副本"><ActionIcon variant="light" color="cyan" size="lg" onClick={(e) => { e.stopPropagation(); handleDuplicate(material); }}><IconCopy size={20} /></ActionIcon></Tooltip>
            <Tooltip label="编辑"><ActionIcon variant="light" color="indigo" size="lg" onClick={(e) => { e.stopPropagation(); setEditingMaterial(material); editForm.setValues({ ...material, id: material.id || '' }); }}><IconEdit size={20} /></ActionIcon></Tooltip>
            <Tooltip label="删除"><ActionIcon variant="light" color="red" size="lg" onClick={async (e) => { e.stopPropagation(); if(window.confirm(`确定删除 ${material.name}？`)) await deleteMaterial.mutateAsync(material.id!); }}><IconTrash size={20} /></ActionIcon></Tooltip>
          </Group>
        </Group>
      </Paper>
    );
  };

  return (
    <PageScaffold title="材料库" description="管理系统所有材料及其计价标准。" actions={<Group gap="xs"><Button variant="subtle" color="gray" leftSection={<IconDownload size={18} />} onClick={handleDownloadTemplate}>下载模板</Button><FileButton onChange={handleImport} accept=".xlsx,.xls">{(props) => <Button {...props} variant="default" leftSection={<IconDatabaseImport size={18} />}>批量导入</Button>}</FileButton><Button color="teal" leftSection={<IconCirclePlus size={18} />} onClick={() => setCreateModalOpened(true)}>新增材料</Button></Group>}>
      <Tabs value={activeTab} onChange={setActiveTab} variant="pills" radius="xl">
        <Tabs.List mb="md" p={4} style={{ background: 'var(--mantine-color-gray-1)', borderRadius: 100, width: 'fit-content' }}>
          <Tabs.Tab value="list" color="teal" leftSection={<IconList size={18} />}>材料列表</Tabs.Tab>
          <Tabs.Tab value="categories" color="orange" leftSection={<IconCategory size={18} />}>分类管理</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="list">
          <Stack gap="md">
            {/* 快速访问栏 */}
            {recentMaterials.length > 0 && (
              <Paper withBorder p="xs" radius="md" bg="gray.0">
                <Group gap="xs"><IconHistory size={16} color="gray"/><Text size="xs" fw={700} c="dimmed">最近查看:</Text>{recentMaterials.slice(0, 5).map(m => (<Button key={m.id} size="compact-xs" variant="white" color="gray" onClick={() => setKeyword(m.name)}>{m.name}</Button>))}</Group>
              </Paper>
            )}

            <Paper withBorder p="md" radius="md">
              <Stack gap="sm">
                <Group wrap="nowrap">
                  <Checkbox label="本页全选" color="teal" checked={selectedMaterialIds.length > 0 && selectedMaterialIds.length === pagedMaterials.length} indeterminate={selectedMaterialIds.length > 0 && selectedMaterialIds.length < pagedMaterials.length} onChange={() => setSelectedMaterialIds(selectedMaterialIds.length === pagedMaterials.length ? [] : pagedMaterials.map(m => m.id!))} />
                  <Divider orientation="vertical" />
                  <TextInput placeholder="搜索材料名称..." leftSection={<IconSearch size={18} />} value={keyword} onChange={(e) => setKeyword(e.currentTarget.value)} style={{ flex: 1 }} />
                  <Select placeholder="分类" data={[{ value: 'all', label: '全部' }, ...categories.map(c => ({ value: c.id!, label: c.name }))]} value={selectedCategoryId} onChange={(val) => setSelectedCategoryId(val || 'all')} w={140} />
                  <Switch label="收藏" color="yellow" checked={showFavoritesOnly} onChange={(e) => setShowFavoritesOnly(e.currentTarget.checked)} />
                </Group>
                
                {/* 批量调价工具栏 */}
                <Group p="xs" bg="teal.0" style={{ borderRadius: 8 }} justify="space-between">
                  <Group gap="sm">
                    <Text size="sm" fw={700} c="teal.9">批量操作:</Text>
                    <NumberInput size="xs" label="调价百分比 %" placeholder="如: 10 或 -5" value={bulkAdjustment} onChange={(v) => setBulkAdjustment(Number(v) || 0)} w={120} />
                    <Button size="xs" color="teal" onClick={handleBulkAdjust} disabled={selectedMaterialIds.length === 0 || bulkAdjustment === 0}>应用调价 ({selectedMaterialIds.length}项)</Button>
                  </Group>
                  <Button variant="subtle" color="red" size="xs" leftSection={<IconTrash size={14} />} disabled={selectedMaterialIds.length === 0} onClick={handleBulkDelete}>批量删除选中的 {selectedMaterialIds.length} 项</Button>
                </Group>
              </Stack>
            </Paper>

            <Box style={{ minHeight: 400 }}>
              {pagedMaterials.length > 0 ? (
                <>{pagedMaterials.map(m => <MaterialCard key={m.id} material={m} />)}{totalPages > 1 && <Center mt="xl" pb="lg"><Pagination total={totalPages} value={page} onChange={setPage} color="teal" radius="xl" withEdges /></Center>}</>
              ) : <Center h={300}><Text c="dimmed">未找到匹配材料</Text></Center>}
            </Box>
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="categories">
          <CategoryManager materials={materials} />
        </Tabs.Panel>
      </Tabs>

      <Modal opened={createModalOpened} onClose={() => setCreateModalOpened(false)} title={<Text fw={700} size="lg">新增材料</Text>} centered radius="md" size="lg">
        <form onSubmit={materialForm.onSubmit(async (v) => {
          await createMaterial.mutateAsync({ ...v, unitLabel: unitLabelMap[v.unitType] });
          materialForm.reset(); setCreateModalOpened(false);
          notifications.show({ title: '添加成功', message: v.name, color: 'teal' });
        })}>
          <Stack><SimpleGrid cols={2}><Select label="所属分类" data={categories.map(c => ({ value: c.id!, label: c.name }))} {...materialForm.getInputProps('categoryId')} /><TextInput label="材料名称" {...materialForm.getInputProps('name')} /><Select label="计价方式" data={unitOptions} {...materialForm.getInputProps('unitType')} /><Box /><NumberInput label="成本单价" prefix="¥ " decimalScale={2} {...materialForm.getInputProps('costPrice')} /><NumberInput label="销售单价" prefix="¥ " decimalScale={2} {...materialForm.getInputProps('retailPrice')} /></SimpleGrid><Group justify="flex-end" mt="md"><Button variant="subtle" onClick={() => setCreateModalOpened(false)}>取消</Button><Button type="submit" color="teal">保存</Button></Group></Stack>
        </form>
      </Modal>

      <Modal opened={!!editingMaterial} onClose={() => setEditingMaterial(null)} title={<Text fw={700} size="lg">编辑材料信息</Text>} centered radius="md" size="lg">
        <form onSubmit={editForm.onSubmit(async (v) => {
          const { id, ...data } = v;
          await updateMaterial.mutateAsync({ id, data: { ...data, unitLabel: unitLabelMap[v.unitType] } });
          setEditingMaterial(null);
          notifications.show({ title: '已更新', message: v.name, color: 'teal' });
        })}>
          <Stack><SimpleGrid cols={2}><Select label="所属分类" data={categories.map(c => ({ value: c.id!, label: c.name }))} {...editForm.getInputProps('categoryId')} /><TextInput label="材料名称" {...editForm.getInputProps('name')} /><Select label="计价方式" data={unitOptions} {...editForm.getInputProps('unitType')} /><Box /><NumberInput label="成本单价" prefix="¥ " decimalScale={2} {...editForm.getInputProps('costPrice')} /><NumberInput label="销售单价" prefix="¥ " decimalScale={2} {...editForm.getInputProps('retailPrice')} /></SimpleGrid><Group justify="flex-end" mt="md"><Button variant="subtle" onClick={() => setEditingMaterial(null)}>取消</Button><Button type="submit" color="teal">更新</Button></Group></Stack>
        </form>
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const handleMove = async (id: string, direction: number) => {
    const idx = categories.findIndex(c => c.id === id);
    const target = categories[idx + direction];
    if (!target) return;
    await Promise.all([
      updateCategory.mutateAsync({ id, data: { sortOrder: target.sortOrder || 0 } }),
      updateCategory.mutateAsync({ id: target.id!, data: { sortOrder: categories[idx].sortOrder || 0 } })
    ]);
  };

  return (
    <Stack gap="xl">
      <Paper withBorder p="md" radius="md" bg="gray.0"><Group align="flex-end"><TextInput label="新增分类" placeholder="输入名称..." style={{ flex: 1 }} value={newName} onChange={(e) => setNewName(e.currentTarget.value)} /><Button color="orange" leftSection={<IconCirclePlus size={20} />} onClick={async () => { if(newName.trim()){ await createCategory.mutateAsync({ name: newName.trim(), sortOrder: categories.length }); setNewName(''); }}}>确认添加</Button></Group></Paper>
      <Paper withBorder radius="md" style={{ overflow: 'hidden' }}><Table verticalSpacing="sm"><Table.Thead bg="gray.1"><Table.Tr><Table.Th w={80}>序号</Table.Th><Table.Th>分类名称</Table.Th><Table.Th w={100} style={{ textAlign: 'center' }}>排序</Table.Th><Table.Th w={100} style={{ textAlign: 'center' }}>材料数</Table.Th><Table.Th w={200} style={{ textAlign: 'right' }}>操作</Table.Th></Table.Tr></Table.Thead><Table.Tbody>{categories.map((cat, idx) => { const count = materials.filter(m => m.categoryId === cat.id).length; return (<Table.Tr key={cat.id}><Table.Td><Badge variant="light" color="orange">{idx + 1}</Badge></Table.Td><Table.Td>{editingId === cat.id ? (<TextInput size="sm" value={editValue} onChange={(e) => setEditValue(e.currentTarget.value)} autoFocus />) : (<Text fw={600}>{cat.name}</Text>)}</Table.Td><Table.Td><Group gap={4} justify="center"><ActionIcon size="sm" variant="subtle" disabled={idx === 0} onClick={() => handleMove(cat.id!, -1)}><IconArrowUp size={14}/></ActionIcon><ActionIcon size="sm" variant="subtle" disabled={idx === categories.length-1} onClick={() => handleMove(cat.id!, 1)}><IconArrowDown size={14}/></ActionIcon></Group></Table.Td><Table.Td style={{ textAlign: 'center' }}><Badge variant="outline" color={count > 0 ? 'blue' : 'gray'}>{count}</Badge></Table.Td><Table.Td><Group gap="xs" justify="flex-end">{editingId === cat.id ? (<><ActionIcon color="teal" onClick={async () => { if(editValue.trim()){ await updateCategory.mutateAsync({ id: cat.id!, data: { name: editValue.trim() } }); setEditingId(null); }}}><IconCheck size={18} /></ActionIcon><ActionIcon color="gray" onClick={() => setEditingId(null)}><IconX size={18} /></ActionIcon></>) : (<><ActionIcon variant="subtle" color="indigo" onClick={() => { setEditingId(cat.id!); setEditValue(cat.name); }}><IconEdit size={18} /></ActionIcon><ActionIcon variant="subtle" color="red" onClick={() => setDeleteConfirmId(cat.id!)}><IconTrash size={18} /></ActionIcon></>)}</Group></Table.Td></Table.Tr>); })}</Table.Tbody></Table></Paper>
      <Modal opened={!!deleteConfirmId} onClose={() => setDeleteConfirmId(null)} title="确认删除" centered radius="md"><Stack><Text size="sm">确定要删除分类 "{categories.find(c => c.id === deleteConfirmId)?.name}" 吗？</Text><Group justify="flex-end" mt="md"><Button variant="subtle" onClick={() => setDeleteConfirmId(null)}>取消</Button><Button color="red" onClick={async () => { const c = materials.filter(m => m.categoryId === deleteConfirmId).length; if(c > 0){ notifications.show({ title: '无法删除', message: `仍有 ${c} 项材料关联`, color: 'red' }); }else{ await deleteCategory.mutateAsync(deleteConfirmId!); setDeleteConfirmId(null); }}}>确认删除</Button></Group></Stack></Modal>
    </Stack>
  );
}
