import { ActionIcon, Badge, Box, Button, CopyButton, Group, Modal, Pagination, Paper, ScrollArea, SegmentedControl, Stack, Table, Text, TextInput, Title } from '@mantine/core';
import { IconCopy, IconEdit, IconSearch, IconTrash } from '@tabler/icons-react';
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { notifications } from '@mantine/notifications';

import { PageScaffold } from '../components/ui/PageScaffold';
import { useDeletePricingProduct, usePricingProducts } from '../hooks/useWindowApi';

type PriceView = 'cost' | 'retail';
type ViewMode = 'compact' | 'comfortable';
type SortMode = 'created-desc' | 'name-asc' | 'price-desc' | 'price-asc';

const PAGE_SIZE = 12;
const calcModeMeta = {
  area: { label: '平米项', color: 'teal' },
  perimeter: { label: '长度项', color: 'blue' },
  fixed: { label: '固定项', color: 'orange' },
} as const;

const ProductLibraryPage = () => {
  const { data: products = [] } = usePricingProducts();
  const deleteProduct = useDeletePricingProduct();
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState('');
  const deferredKeyword = useDeferredValue(keyword);
  const [priceView, setPriceView] = useState<PriceView>('retail');
  const [viewMode, setViewMode] = useState<ViewMode>('compact');
  const [sortMode, setSortMode] = useState<SortMode>('created-desc');
  const [page, setPage] = useState(1);
  const [detailProductId, setDetailProductId] = useState<string | null>(null);
  const [deleteProductId, setDeleteProductId] = useState<string | null>(null);

  const getItemUnitPrice = (item: (typeof products)[number]['items'][number]) => (
    priceView === 'cost' ? (item.costPrice || 0) : (item.retailPrice || 0)
  );

  const getProductTotal = (product: (typeof products)[number]) => (
    product.items.reduce((sum, item) => (
      item.includeInComboTotal ? sum + getItemUnitPrice(item) * item.quantity : sum
    ), 0)
  );

  const filteredProducts = useMemo(() => {
    const matched = products.filter((item) => `${item.name} ${item.items.map((entry) => entry.materialName || '').join(' ')}`.toLowerCase().includes(deferredKeyword.toLowerCase()));
    const cloned = [...matched];
    cloned.sort((a, b) => {
      if (sortMode === 'name-asc') return a.name.localeCompare(b.name, 'zh-CN');
      if (sortMode === 'price-desc') return getProductTotal(b) - getProductTotal(a);
      if (sortMode === 'price-asc') return getProductTotal(a) - getProductTotal(b);
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });
    return cloned;
  }, [deferredKeyword, priceView, products, sortMode]);

  useEffect(() => {
    setPage(1);
  }, [keyword, sortMode, viewMode]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE));

  const pagedProducts = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredProducts.slice(start, start + PAGE_SIZE);
  }, [filteredProducts, page]);

  const detailProduct = useMemo(
    () => products.find((item) => item.id === detailProductId) || null,
    [detailProductId, products],
  );
  const deletingProduct = useMemo(
    () => products.find((item) => item.id === deleteProductId) || null,
    [deleteProductId, products],
  );

  const openBuilder = (productId: string | null, copyMode = false) => {
    if (!productId) return;
    window.localStorage.setItem('product-builder-load', JSON.stringify({ productId, copyMode }));
    navigate('/products');
  };

  const getIncludedCalcModes = (product: (typeof products)[number]) => {
    const modeSet = new Set(
      product.items
        .filter((item) => item.includeInComboTotal)
        .map((item) => item.calcMode || 'area'),
    );
    return (['area', 'perimeter', 'fixed'] as const).filter((mode) => modeSet.has(mode));
  };

  const handleDelete = async () => {
    if (!deletingProduct?.id) return;
    try {
      await deleteProduct.mutateAsync(deletingProduct.id);
      notifications.show({ title: '删除成功', message: `${deletingProduct.name} 已删除`, color: 'teal' });
      setDeleteProductId(null);
    } catch (error: any) {
      notifications.show({ title: '删除失败', message: error?.message || '删除组合失败', color: 'red' });
    }
  };

  return (
    <PageScaffold
      title="组合库"
      description="已保存的组合统一放在这里管理。组合设置页只做搭配、筛选和编辑。"
    >
      <Paper withBorder radius={12} p="md" h="100%">
        <Stack gap="md" h="100%">
          <Group justify="space-between" align="stretch" wrap="nowrap">
            <TextInput
              leftSection={<IconSearch size={16} />}
              placeholder="搜索组合名称或材料"
              value={keyword}
              onChange={(event) => setKeyword(event.currentTarget.value)}
              style={{ flex: 1 }}
              styles={{
                input: {
                  minHeight: 40,
                },
              }}
            />
            <Group gap="xs" wrap="nowrap">
              <Paper
                radius="xl"
                p={4}
                bg="#fff7ed"
                style={{
                  boxShadow: '0 4px 12px rgba(15, 23, 42, 0.06)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: 40,
                }}
              >
                <SegmentedControl
                  size="xs"
                  value={priceView}
                  onChange={(value) => setPriceView(value as PriceView)}
                  data={[
                    { label: '显示销售价', value: 'retail' },
                    { label: '显示成本价', value: 'cost' },
                  ]}
                />
              </Paper>
              <Paper
                radius="xl"
                p={4}
                bg="#eff6ff"
                style={{
                  boxShadow: '0 4px 12px rgba(15, 23, 42, 0.06)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: 40,
                }}
              >
                <SegmentedControl
                  size="xs"
                  value={viewMode}
                  onChange={(value) => setViewMode(value as ViewMode)}
                  data={[
                    { label: '紧凑', value: 'compact' },
                    { label: '标准', value: 'comfortable' },
                  ]}
                />
              </Paper>
            </Group>
          </Group>

          <Paper
            radius="xl"
            p={4}
            bg="#f8fafc"
            style={{
              boxShadow: '0 4px 12px rgba(15, 23, 42, 0.04)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              minHeight: 40,
            }}
          >
            <Text size="xs" c="dimmed" fw={600} px="xs">
              共 {filteredProducts.length} 个组合
            </Text>
            <Group gap="xs" wrap="nowrap" align="center">
              <Text size="xs" c="dimmed" fw={600}>排序</Text>
              <SegmentedControl
                size="xs"
                value={sortMode}
                onChange={(value) => setSortMode(value as SortMode)}
                data={[
                  { label: '最近创建', value: 'created-desc' },
                  { label: '名称', value: 'name-asc' },
                  { label: '价格高到低', value: 'price-desc' },
                  { label: '价格低到高', value: 'price-asc' },
                ]}
              />
            </Group>
          </Paper>

          <ScrollArea className="soft-scroll" style={{ flex: 1 }}>
            <Box
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                gap: viewMode === 'compact' ? 10 : 14,
                alignItems: 'start',
              }}
            >
              {pagedProducts.map((product) => (
                <Paper
                  key={product.id}
                  withBorder
                  radius={12}
                  p={viewMode === 'compact' ? 'sm' : 'md'}
                  bg="#ffffff"
                  style={{ boxShadow: '0 6px 18px rgba(15, 23, 42, 0.04)', borderColor: '#e7edf5' }}
                >
                  <Stack gap={viewMode === 'compact' ? 'sm' : 'md'}>
                    <Group justify="space-between" align="flex-start" wrap="nowrap">
                      <Box maw={440} style={{ minWidth: 0, flex: 1 }}>
                        <Title order={5} style={{ lineHeight: 1.2 }}>{product.name}</Title>
                        <Text size={viewMode === 'compact' ? 'xs' : 'sm'} c="dimmed" mt={4} lineClamp={viewMode === 'compact' ? 1 : 2}>
                          {product.items.map((item) => `${item.materialName} x ${item.quantity}`).join('，') || '暂无材料'}
                        </Text>
                      </Box>
                      <Badge variant="light">{product.items.length} 项</Badge>
                    </Group>

                    <Box
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'minmax(0, 1fr) auto',
                        gap: 12,
                        alignItems: 'center',
                      }}
                    >
                      <Group gap={6} wrap="wrap" style={{ minWidth: 0 }}>
                        <Text size="xs" c="dimmed" fw={700}>计价单位</Text>
                        {getIncludedCalcModes(product).length > 0 ? (
                          getIncludedCalcModes(product).map((mode) => (
                            <Badge key={mode} color={calcModeMeta[mode].color} variant="light" size="sm">
                              {calcModeMeta[mode].label}
                            </Badge>
                          ))
                        ) : (
                          <Text size="xs" c="dimmed">无</Text>
                        )}
                      </Group>
                      <Group gap="xs" wrap="nowrap" justify="flex-end">
                        <Button size="xs" variant="default" onClick={() => setDetailProductId(product.id || null)}>
                          查看详情
                        </Button>
                        <Button size="xs" variant="light" leftSection={<IconEdit size={12} />} onClick={() => openBuilder(product.id || null)}>
                          编辑
                        </Button>
                        <Button size="xs" variant="subtle" leftSection={<IconCopy size={12} />} onClick={() => openBuilder(product.id || null, true)}>
                          复制
                        </Button>
                        <ActionIcon size="sm" variant="subtle" color="red" onClick={() => setDeleteProductId(product.id || null)}>
                          <IconTrash size={14} />
                        </ActionIcon>
                      </Group>
                    </Box>

                    <Paper
                      radius={10}
                      p={viewMode === 'compact' ? 'sm' : 'md'}
                      style={{
                        background: priceView === 'cost' ? '#f0fdfa' : '#fff7ed',
                        border: `1px solid ${priceView === 'cost' ? '#99f6e4' : '#fdba74'}`,
                      }}
                    >
                      <Box
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'minmax(0, 1fr) auto',
                          gap: 12,
                          alignItems: 'center',
                        }}
                      >
                        <Box style={{ minWidth: 0 }}>
                          <Text size="xs" c="dimmed" fw={700}>
                            {priceView === 'cost' ? '成本总价' : '销售总价'}
                          </Text>
                          <Text size="xs" c="dimmed" mt={2}>
                            只统计已计入总价的单位
                          </Text>
                        </Box>
                        <CopyButton value={getProductTotal(product).toFixed(2)} timeout={1500}>
                          {({ copied, copy }) => (
                            <Button
                              size={viewMode === 'compact' ? 'sm' : 'md'}
                              variant="white"
                              color={priceView === 'cost' ? 'teal' : 'orange'}
                              onClick={copy}
                              style={{ height: viewMode === 'compact' ? 46 : 54, paddingLeft: 14, paddingRight: 14 }}
                            >
                              <Text size={viewMode === 'compact' ? 'lg' : 'xl'} fw={800}>
                                ¥ {getProductTotal(product).toFixed(2)}
                              </Text>
                              <Text size="xs" ml="xs">
                                {copied ? '已复制' : '点击复制'}
                              </Text>
                            </Button>
                          )}
                        </CopyButton>
                      </Box>
                    </Paper>
                  </Stack>
                </Paper>
              ))}
              {pagedProducts.length === 0 && (
                <Paper withBorder radius={12} p="xl" ta="center" bg="var(--bg-subtle)" style={{ gridColumn: '1 / -1' }}>
                  <Text c="dimmed">未找到匹配组合</Text>
                </Paper>
              )}
            </Box>
          </ScrollArea>

          {totalPages > 1 && (
            <Group justify="center">
              <Pagination total={totalPages} value={page} onChange={setPage} color="teal" radius="xl" withEdges />
            </Group>
          )}
        </Stack>
      </Paper>

      <Modal
        opened={!!detailProduct}
        onClose={() => setDetailProductId(null)}
        title={detailProduct?.name || '组合详情'}
        size="xl"
        centered
      >
        {detailProduct && (
          <Stack gap="md">
            <Group gap="xs">
              <Badge variant="light">{detailProduct.items.length} 项材料</Badge>
              {getIncludedCalcModes(detailProduct).map((mode) => (
                <Badge key={mode} color={calcModeMeta[mode].color} variant="light">
                  {calcModeMeta[mode].label}
                </Badge>
              ))}
              <Badge color={priceView === 'cost' ? 'teal' : 'orange'} variant="light">
                {priceView === 'cost' ? '成本总价' : '销售总价'} ¥ {getProductTotal(detailProduct).toFixed(2)}
              </Badge>
            </Group>

            <Table withTableBorder striped highlightOnHover verticalSpacing="sm" horizontalSpacing="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>材料</Table.Th>
                  <Table.Th>单位栏目</Table.Th>
                  <Table.Th>单位</Table.Th>
                  <Table.Th ta="right">数量</Table.Th>
                  <Table.Th ta="right">{priceView === 'cost' ? '成本单价' : '销售单价'}</Table.Th>
                  <Table.Th ta="right">小计</Table.Th>
                  <Table.Th ta="center">计入总价</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {detailProduct.items.map((item, index) => {
                  const unitPrice = getItemUnitPrice(item);
                  const subtotal = unitPrice * item.quantity;
                  const calcModeLabel = item.calcMode === 'area' ? '平米项' : item.calcMode === 'perimeter' ? '长度项' : '固定项';

                  return (
                    <Table.Tr key={`${item.materialId}-${index}`}>
                      <Table.Td>{item.materialName || '-'}</Table.Td>
                      <Table.Td>{calcModeLabel}</Table.Td>
                      <Table.Td>{item.unitLabel || '-'}</Table.Td>
                      <Table.Td ta="right">{item.quantity.toFixed(2)}</Table.Td>
                      <Table.Td ta="right">¥ {unitPrice.toFixed(2)}</Table.Td>
                      <Table.Td ta="right">¥ {subtotal.toFixed(2)}</Table.Td>
                      <Table.Td ta="center">{item.includeInComboTotal ? '是' : '否'}</Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </Stack>
        )}
      </Modal>

      <Modal
        opened={!!deletingProduct}
        onClose={() => setDeleteProductId(null)}
        title="确认删除组合"
        centered
      >
        <Stack gap="md">
          <Text size="sm">确定删除“{deletingProduct?.name || ''}”吗？删除后无法恢复。</Text>
          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => setDeleteProductId(null)}>取消</Button>
            <Button color="red" onClick={handleDelete} loading={deleteProduct.isPending}>确认删除</Button>
          </Group>
        </Stack>
      </Modal>
    </PageScaffold>
  );
};

export default ProductLibraryPage;
