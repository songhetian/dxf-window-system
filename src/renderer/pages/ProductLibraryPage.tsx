import { ActionIcon, Badge, Box, Button, Checkbox, CopyButton, Group, Modal, Pagination, Paper, ScrollArea, SegmentedControl, Stack, Table, Text, TextInput, Title, Tooltip } from '@mantine/core';
import { IconCopy, IconDownload, IconEdit, IconSearch, IconTrash } from '@tabler/icons-react';
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { notifications } from '@mantine/notifications';

import { PageScaffold } from '../components/ui/PageScaffold';
import { useDeletePricingProduct, useMaterials, usePricingProducts } from '../hooks/useWindowApi';

type PriceView = 'cost' | 'retail';
type SortMode = 'created-desc' | 'name-asc' | 'price-desc' | 'price-asc';
type CalcMode = 'area' | 'perimeter' | 'fixed';
type TotalsByMode = Record<CalcMode, number> & { total: number };

const PAGE_SIZE = 12;
const calcModeMeta = {
  area: { label: '平米项', color: 'teal' },
  perimeter: { label: '长度项', color: 'blue' },
  fixed: { label: '固定项', color: 'orange' },
} as const;

const calcModeSummaryMeta = {
  area: { label: '平米', color: 'teal' },
  perimeter: { label: '长度', color: 'blue' },
  fixed: { label: '固定', color: 'orange' },
} as const;

const ProductLibraryPage = () => {
  const { data: products = [] } = usePricingProducts();
  const { data: materials = [] } = useMaterials();
  const deleteProduct = useDeletePricingProduct();
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState('');
  const deferredKeyword = useDeferredValue(keyword);
  const [priceView, setPriceView] = useState<PriceView>('retail');
  const [sortMode, setSortMode] = useState<SortMode>('created-desc');
  const [page, setPage] = useState(1);
  const [detailProductId, setDetailProductId] = useState<string | null>(null);
  const [deleteProductId, setDeleteProductId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const materialById = useMemo(
    () => new Map(materials.map((material) => [material.id, material])),
    [materials],
  );

  const getResolvedItemUnitPrice = (
    item: (typeof products)[number]['items'][number],
    view: PriceView,
  ) => {
    const material = materialById.get(item.materialId);
    return view === 'cost'
      ? (material?.costPrice ?? item.costPrice ?? 0)
      : (material?.retailPrice ?? item.retailPrice ?? 0);
  };

  const getProductTotalsByMode = (
    product: (typeof products)[number],
    view: PriceView,
  ): TotalsByMode => {
    const totals = product.items.reduce<TotalsByMode>((sum, item) => {
      if (!item.includeInComboTotal) return sum;
      const mode = (item.calcMode || 'area') as CalcMode;
      const unitPrice = getResolvedItemUnitPrice(item, view);
      sum[mode] += unitPrice * item.quantity;
      sum.total += unitPrice * item.quantity;
      return sum;
    }, { area: 0, perimeter: 0, fixed: 0, total: 0 });

    return totals;
  };

  const getProductTotalByView = (
    product: (typeof products)[number],
    view: PriceView,
  ) => getProductTotalsByMode(product, view).total;

  const getItemUnitPrice = (item: (typeof products)[number]['items'][number]) => (
    getResolvedItemUnitPrice(item, priceView)
  );

  const getProductTotal = (product: (typeof products)[number]) => getProductTotalByView(product, priceView);

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
  }, [deferredKeyword, priceView, products, sortMode, materialById]);

  useEffect(() => {
    setPage(1);
    setSelectedIds([]);
  }, [keyword, sortMode]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE));

  const pagedProducts = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredProducts.slice(start, start + PAGE_SIZE);
  }, [filteredProducts, page]);

  const allPageSelected = pagedProducts.length > 0 && pagedProducts.every((p) => selectedIds.includes(p.id || ''));

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]);
  };

  const togglePageSelect = () => {
    if (allPageSelected) {
      setSelectedIds((prev) => prev.filter((id) => !pagedProducts.some((p) => p.id === id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...pagedProducts.map((p) => p.id || '')])));
    }
  };

  const handleExport = async () => {
    if (selectedIds.length === 0) {
      notifications.show({ title: '请先选择', message: '请至少选择一个组合进行导出', color: 'orange' });
      return;
    }

    try {
      notifications.show({
        id: 'exporting-products',
        title: '正在导出',
        message: '正在准备导出文件...',
        loading: true,
        autoClose: false,
      });

      const ExcelJS = (await import('exceljs')).default;
      const workbook = new ExcelJS.Workbook();
      const summarySheet = workbook.addWorksheet('组合汇总');
      const worksheet = workbook.addWorksheet('价格表');
      worksheet.views = [{ state: 'frozen', ySplit: 2 }];
      worksheet.pageSetup = {
        paperSize: 9,
        orientation: 'portrait',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        margins: {
          left: 0.35,
          right: 0.35,
          top: 0.45,
          bottom: 0.45,
          header: 0.2,
          footer: 0.2,
        },
        printTitlesRow: '1:2',
      };

      const selectedProducts = products.filter((p) => selectedIds.includes(p.id || ''));
      let groupIndex = 0;

      summarySheet.views = [{ state: 'frozen', ySplit: 2 }];
      summarySheet.columns = [
        { key: 'name', width: 32 },
        { key: 'costArea', width: 14 },
        { key: 'costPerimeter', width: 14 },
        { key: 'costFixed', width: 14 },
        { key: 'cost', width: 16 },
        { key: 'retailArea', width: 14 },
        { key: 'retailPerimeter', width: 14 },
        { key: 'retailFixed', width: 14 },
        { key: 'retail', width: 16 },
        { key: 'remarks', width: 44 },
      ];
      const summaryTitleRow = summarySheet.addRow(['组合汇总', '', '', '', '', '', '', '', '', '']);
      summarySheet.mergeCells(`A${summaryTitleRow.number}:J${summaryTitleRow.number}`);
      summaryTitleRow.font = { size: 18, bold: true };
      summaryTitleRow.height = 30;
      summaryTitleRow.alignment = { vertical: 'middle', horizontal: 'center' };
      summaryTitleRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF7F8FA' },
      };
      const summaryInfoRow = summarySheet.addRow([`导出时间：${new Date().toLocaleDateString('zh-CN')}`, '', '', '', '', '', '', '', '', `组合数量：${selectedProducts.length}`]);
      summarySheet.mergeCells(`A${summaryInfoRow.number}:D${summaryInfoRow.number}`);
      summarySheet.mergeCells(`E${summaryInfoRow.number}:J${summaryInfoRow.number}`);
      summaryInfoRow.height = 22;
      summaryInfoRow.font = { size: 10, bold: true };
      summaryInfoRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
      summaryInfoRow.getCell(5).alignment = { vertical: 'middle', horizontal: 'center' };
      const summaryHeaderRow = summarySheet.addRow(['组合名称', '平米成本', '长度成本', '固定成本', '成本总价', '平米销售', '长度销售', '固定销售', '销售总价', '备注']);
      summaryHeaderRow.font = { bold: true };
      summaryHeaderRow.height = 24;
      summaryHeaderRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF0F7F4' },
      };

      worksheet.columns = [
        { key: 'material', width: 40 },
        { key: 'costPrice', width: 15 },
        { key: 'retailPrice', width: 15 },
        { key: 'remarks', width: 60 },
      ];

      const titleRow = worksheet.addRow(['价格表', '', '', '']);
      titleRow.font = { size: 18, bold: true };
      titleRow.height = 30;
      worksheet.mergeCells(`A${titleRow.number}:D${titleRow.number}`);
      titleRow.alignment = { vertical: 'middle', horizontal: 'center' };
      titleRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF7F8FA' },
      };
      const subTitleRow = worksheet.addRow([`导出时间：${new Date().toLocaleDateString('zh-CN')}`, '', '', `组合数量：${selectedProducts.length}`]);
      worksheet.mergeCells(`A${subTitleRow.number}:B${subTitleRow.number}`);
      worksheet.mergeCells(`C${subTitleRow.number}:D${subTitleRow.number}`);
      subTitleRow.height = 22;
      subTitleRow.font = { size: 10, bold: true };
      subTitleRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
      subTitleRow.getCell(3).alignment = { vertical: 'middle', horizontal: 'center' };
      subTitleRow.eachCell((cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFBFCFD' },
        };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        };
      });

      const headerRow = worksheet.addRow(['材料', '成本价', '销售价', '备注']);
      headerRow.font = { bold: true };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF0F7F4' },
      };
      headerRow.height = 24;
      headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

      selectedProducts.forEach((product) => {
        groupIndex += 1;
        const productCombinedRemarks = product.items
          .map((item) => item.remarks)
          .filter(Boolean)
          .join('; ');
        const costTotals = getProductTotalsByMode(product, 'cost');
        const retailTotals = getProductTotalsByMode(product, 'retail');

        const summaryRow = summarySheet.addRow([
          `${groupIndex}. ${product.name}`,
          Number(costTotals.area.toFixed(2)),
          Number(costTotals.perimeter.toFixed(2)),
          Number(costTotals.fixed.toFixed(2)),
          Number(costTotals.total.toFixed(2)),
          Number(retailTotals.area.toFixed(2)),
          Number(retailTotals.perimeter.toFixed(2)),
          Number(retailTotals.fixed.toFixed(2)),
          Number(retailTotals.total.toFixed(2)),
          productCombinedRemarks,
        ]);
        summaryRow.height = 24;
        summaryRow.alignment = { vertical: 'middle', horizontal: 'center' };
        summaryRow.getCell(10).alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        summaryRow.getCell(5).font = { bold: true, color: { argb: 'FF0F766E' } };
        summaryRow.getCell(9).font = { bold: true, color: { argb: 'FF1D4ED8' } };
        if (groupIndex % 2 === 1) {
          ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'].forEach((col) => {
            summaryRow.getCell(col).fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFFCFCFD' },
            };
          });
        }

        const productRow = worksheet.addRow([`${groupIndex}. ${product.name}`, '', '', productCombinedRemarks]);
        worksheet.mergeCells(`A${productRow.number}:D${productRow.number}`);
        productRow.font = { bold: true, size: 12 };
        productRow.height = 26;
        productRow.alignment = { vertical: 'middle', horizontal: 'center' };
        productRow.getCell(1).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF1F5F9' },
        };
        productRow.getCell(1).border = {
          top: { style: 'thick', color: { argb: 'FFCBD5E1' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'medium', color: { argb: 'FFCBD5E1' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        };
        
        product.items.forEach((item, itemIndex) => {
          const materialRow = worksheet.addRow([
            item.materialName || '未命名材料',
            Number(item.costPrice || 0),
            Number(item.retailPrice || 0),
            item.remarks || '',
          ]);
          materialRow.height = 22;
          materialRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
          materialRow.getCell(4).alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
          materialRow.getCell(2).font = { bold: true, color: { argb: 'FF0F766E' } };
          materialRow.getCell(3).font = { bold: true, color: { argb: 'FF1D4ED8' } };
          if (itemIndex % 2 === 0) {
            ['A', 'B', 'C', 'D'].forEach((col) => {
              materialRow.getCell(col).fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFFCFCFD' },
              };
            });
          }
        });
        
        const spacerRow = worksheet.addRow(['', '', '', '']);
        spacerRow.height = 10;
      });

      worksheet.eachRow((row) => {
        row.eachCell((cell) => {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          };
        });
      });

      summarySheet.eachRow((row) => {
        row.eachCell((cell) => {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          };
        });
      });

      ['B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'].forEach((column) => {
        summarySheet.getColumn(column).numFmt = '0.00';
      });
      summarySheet.getColumn('J').alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      summarySheet.pageSetup = {
        paperSize: 9,
        orientation: 'landscape',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        printTitlesRow: '1:3',
      };
      summarySheet.pageSetup.printArea = `A1:J${summarySheet.rowCount}`;
      worksheet.getColumn('B').numFmt = '0.00';
      worksheet.getColumn('C').numFmt = '0.00';
      worksheet.getColumn('D').alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      worksheet.pageSetup.printArea = `A1:D${worksheet.rowCount}`;

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `组合库导出_${new Date().toISOString().split('T')[0]}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);

      notifications.update({
        id: 'exporting-products',
        title: '导出成功',
        message: `已导出 ${selectedIds.length} 个组合`,
        color: 'teal',
        loading: false,
        autoClose: 3000,
      });
    } catch (error: any) {
      notifications.update({
        id: 'exporting-products',
        title: '导出失败',
        message: error?.message || '导出过程中发生错误',
        color: 'red',
        loading: false,
        autoClose: 3000,
      });
    }
  };

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

  const renderIncludedModeTotals = (product: (typeof products)[number], view: PriceView, size: 'xs' | 'sm' = 'xs') => {
    const totals = getProductTotalsByMode(product, view);
    return getIncludedCalcModes(product).map((mode) => (
      <Badge key={mode} variant="light" color={calcModeSummaryMeta[mode].color} size={size}>
        {calcModeSummaryMeta[mode].label} {totals[mode].toFixed(2)}
      </Badge>
    ));
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
      title="组合清单"
      description="这里集中查看、筛选和导出已经做好的组合，方便报价时直接选用。"
    >
      <Stack gap="sm" h="100%">
        <div className="app-stat-grid">
          <div className="app-stat-card">
            <div className="app-stat-label">组合总数</div>
            <div className="app-stat-value">{products.length}</div>
            <div className="app-stat-note">已沉淀到组合库，可直接复用于报价</div>
          </div>
          <div className="app-stat-card">
            <div className="app-stat-label">筛选结果</div>
            <div className="app-stat-value">{filteredProducts.length}</div>
            <div className="app-stat-note">会随搜索词和排序方式即时更新</div>
          </div>
          <div className="app-stat-card">
            <div className="app-stat-label">本页选择</div>
            <div className="app-stat-value">{selectedIds.length}</div>
            <div className="app-stat-note">支持批量导出当前选中的组合</div>
          </div>
          <div className="app-stat-card">
            <div className="app-stat-label">分页状态</div>
            <div className="app-stat-value">{page}/{totalPages}</div>
            <div className="app-stat-note">每页展示 {PAGE_SIZE} 个组合</div>
          </div>
        </div>

        <Paper withBorder radius={12} p="md" h="100%" className="app-surface app-section">
        <Stack gap="md" h="100%">
          <div className="page-toolbar">
            <div className="page-toolbar-main">
            <TextInput
              leftSection={<IconSearch size={16} />}
              placeholder="搜索组合名称或材料"
              value={keyword}
              onChange={(event) => setKeyword(event.currentTarget.value)}
              className="page-toolbar-fill"
              styles={{
                input: {
                  minHeight: 44,
                  fontSize: '14px'
                },
              }}
            />
            
              <div className="page-toolbar-meta">
                <SegmentedControl
                  size="sm"
                  variant="default"
                  value={priceView}
                  onChange={(value) => setPriceView(value as PriceView)}
                  data={[
                    { label: '销售价', value: 'retail' },
                    { label: '成本价', value: 'cost' },
                  ]}
                />
                <Group gap={4} px={8}>
                  <Text size="xs" c="dimmed" fw={700}>排序</Text>
                  <SegmentedControl
                    size="sm"
                    variant="default"
                    value={sortMode}
                    onChange={(value) => setSortMode(value as SortMode)}
                    data={[
                      { label: '最近', value: 'created-desc' },
                      { label: '名称', value: 'name-asc' },
                      { label: '价格', value: 'price-desc' },
                    ]}
                  />
                </Group>
              </div>
            </div>
          </div>

          <div className="selection-strip">
            <Group gap="xs">
              <Checkbox
                size="xs"
                color="teal"
                checked={allPageSelected}
                indeterminate={!allPageSelected && selectedIds.length > 0}
                onChange={togglePageSelect}
                label={<Text size="xs" fw={700}>本页全选</Text>}
              />
              <Text size="xs" c="dimmed" fw={600}>
                共 {filteredProducts.length} 个组合
              </Text>
            </Group>
            {selectedIds.length > 0 && (
              <Button 
                size="xs" 
                color="teal" 
                leftSection={<IconDownload size={14} />} 
                onClick={handleExport}
                variant="filled"
              >
                批量导出所选 ({selectedIds.length})
              </Button>
            )}
          </div>

          <ScrollArea className="soft-scroll" style={{ flex: 1 }}>
            <Paper withBorder radius={12} className="app-surface app-table-shell">
              <Table highlightOnHover verticalSpacing="md" horizontalSpacing="md">
                <Table.Thead bg="gray.0">
                  <Table.Tr>
                    <Table.Th w={40}></Table.Th>
                    <Table.Th>组合名称</Table.Th>
                    <Table.Th>包含材料</Table.Th>
                    <Table.Th w={150}>计价单位</Table.Th>
                    <Table.Th w={180} ta="right">
                      {priceView === 'cost' ? '成本总价' : '销售总价'}
                    </Table.Th>
                    <Table.Th w={200} ta="center">操作</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {pagedProducts.map((product) => {
                    const isSelected = selectedIds.includes(product.id || '');
                    const totalPrice = getProductTotal(product);
                    return (
                      <Table.Tr 
                        key={product.id} 
                        bg={isSelected ? 'teal.0' : undefined}
                        style={{ cursor: 'pointer' }}
                        onClick={() => toggleSelect(product.id || '')}
                      >
                        <Table.Td onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            size="xs"
                            color="teal"
                            checked={isSelected}
                            onChange={() => toggleSelect(product.id || '')}
                          />
                        </Table.Td>
                        <Table.Td>
                          <Text fw={700} size="sm">{product.name}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="xs" c="dimmed" lineClamp={1}>
                            {product.items.map((item) => `${item.materialName} x ${item.quantity}`).join('，') || '暂无材料'}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Group gap={4}>
                            {getIncludedCalcModes(product).map((mode) => (
                              <Badge key={mode} color={calcModeMeta[mode].color} variant="light" size="xs">
                                {calcModeMeta[mode].label}
                              </Badge>
                            ))}
                          </Group>
                        </Table.Td>
                        <Table.Td ta="right">
                          <Stack gap={4} align="flex-end">
                            <CopyButton value={totalPrice.toFixed(2)} timeout={1500}>
                              {({ copied, copy }) => (
                                <Tooltip label={copied ? '已复制' : '点击复制'}>
                                  <Text
                                    fw={800}
                                    c={priceView === 'cost' ? 'teal' : 'orange'}
                                    onClick={(e) => { e.stopPropagation(); copy(); }}
                                    style={{ cursor: 'copy' }}
                                  >
                                    ¥ {totalPrice.toFixed(2)}
                                  </Text>
                                </Tooltip>
                              )}
                            </CopyButton>
                            <Group gap={4} justify="flex-end">
                              {renderIncludedModeTotals(product, priceView)}
                            </Group>
                          </Stack>
                        </Table.Td>
                        <Table.Td>
                          <Group gap="xs" justify="center" wrap="nowrap">
                            <Tooltip label="详情">
                              <ActionIcon variant="light" color="gray" onClick={(e) => { e.stopPropagation(); setDetailProductId(product.id || null); }}>
                                <IconSearch size={16} />
                              </ActionIcon>
                            </Tooltip>
                            <Tooltip label="编辑">
                              <ActionIcon variant="light" color="blue" onClick={(e) => { e.stopPropagation(); openBuilder(product.id || null); }}>
                                <IconEdit size={16} />
                              </ActionIcon>
                            </Tooltip>
                            <Tooltip label="复制">
                              <ActionIcon variant="light" color="cyan" onClick={(e) => { e.stopPropagation(); openBuilder(product.id || null, true); }}>
                                <IconCopy size={16} />
                              </ActionIcon>
                            </Tooltip>
                            <Tooltip label="删除">
                              <ActionIcon variant="light" color="red" onClick={(e) => { e.stopPropagation(); setDeleteProductId(product.id || null); }}>
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
          </ScrollArea>

          {totalPages > 1 && (
            <Group justify="center">
              <Pagination total={totalPages} value={page} onChange={setPage} color="teal" radius="xl" withEdges />
            </Group>
          )}
        </Stack>
        </Paper>
      </Stack>

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
            <Group gap="xs">
              {renderIncludedModeTotals(detailProduct, priceView, 'sm')}
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
                  <Table.Th>备注</Table.Th>
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
                      <Table.Td>
                        <Text size="xs" c="dimmed" lineClamp={2}>{item.remarks || '-'}</Text>
                      </Table.Td>
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
