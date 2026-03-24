import React, { useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Box,
  Button,
  Group,
  MultiSelect,
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
import { IconDeviceFloppy, IconFileExport, IconSearch } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import * as XLSX from 'xlsx';
import { useNavigate } from 'react-router-dom';

import { PricingQuote } from '../../shared/schemas';
import { PageScaffold } from '../components/ui/PageScaffold';
import {
  useCreatePricingQuote,
  useDrawingWindows,
  useDrawings,
  usePricingProducts,
  usePricingRates,
} from '../hooks/useWindowApi';
import { useWindowStore } from '../stores/windowStore';

const modeLabelMap: Record<string, string> = {
  area: '按面积',
  perimeter: '按周长',
  fixed: '按固定',
};

const sizePresets = [
  { label: '小窗 1200×1500', width: 1200, height: 1500 },
  { label: '中窗 1500×1800', width: 1500, height: 1800 },
  { label: '落地窗 1800×2400', width: 1800, height: 2400 },
  { label: '门扇 900×2100', width: 900, height: 2100 },
];

const PricingPage = () => {
  const { data: products = [] } = usePricingProducts();
  const { data: rates = [] } = usePricingRates();
  const { data: drawings = [] } = useDrawings();
  const saveQuote = useCreatePricingQuote();
  const navigate = useNavigate();
  const {
    pricingDraft,
    clearPricingDraft,
    pricingQueue,
    setPricingDraft,
    removePricingQueueItem,
    clearPricingQueue,
  } = useWindowStore();

  const [quoteName, setQuoteName] = useState('');
  const [productId, setProductId] = useState<string | null>(null);
  const [sourceDrawingId, setSourceDrawingId] = useState<string | null>(null);
  const [sourceWindowId, setSourceWindowId] = useState<string | null>(null);
  const [width, setWidth] = useState(1500);
  const [height, setHeight] = useState(1500);
  const [quantity, setQuantity] = useState(1);
  const [rateIds, setRateIds] = useState<string[]>([]);
  const [productKeyword, setProductKeyword] = useState('');
  const [recentProductIds, setRecentProductIds] = useState<string[]>([]);
  const { data: sourceWindows = [] } = useDrawingWindows(sourceDrawingId);

  useEffect(() => {
    const raw = window.localStorage.getItem('pricing-recent-products');
    if (!raw) return;
    try {
      const next = JSON.parse(raw);
      if (Array.isArray(next)) {
        setRecentProductIds(next.filter((item) => typeof item === 'string'));
      }
    } catch {
      window.localStorage.removeItem('pricing-recent-products');
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem('pricing-recent-products', JSON.stringify(recentProductIds));
  }, [recentProductIds]);

  useEffect(() => {
    if (!pricingDraft) return;
    setQuoteName(`${pricingDraft.sourceName} 报价`);
    setWidth(Math.round(pricingDraft.width));
    setHeight(Math.round(pricingDraft.height));
    setQuantity(pricingDraft.quantity || 1);
    if (pricingDraft.productId) setProductId(pricingDraft.productId);
    clearPricingDraft();
  }, [clearPricingDraft, pricingDraft]);

  useEffect(() => {
    if (!sourceWindowId) return;
    const selectedWindow = sourceWindows.find((item) => item.id === sourceWindowId);
    if (!selectedWindow) return;
    setQuoteName(`${selectedWindow.name} 报价`);
    setWidth(Math.round(selectedWindow.width));
    setHeight(Math.round(selectedWindow.height));
    setQuantity(1);
  }, [sourceWindowId, sourceWindows]);

  const filteredProducts = useMemo(
    () => products.filter((item) => `${item.name} ${item.items.map((entry) => entry.materialName || '').join(' ')}`.toLowerCase().includes(productKeyword.toLowerCase())),
    [productKeyword, products],
  );

  const selectedProduct = useMemo(
    () => products.find((item) => item.id === productId) || null,
    [productId, products],
  );

  const productSummary = useMemo(() => filteredProducts.map((product) => ({
    ...product,
    areaCount: product.items.filter((item) => (item.calcMode || product.pricingMode) === 'area').length,
    perimeterCount: product.items.filter((item) => (item.calcMode || product.pricingMode) === 'perimeter').length,
    fixedCount: product.items.filter((item) => (item.calcMode || product.pricingMode) === 'fixed').length,
  })), [filteredProducts]);

  const recentProducts = useMemo(
    () => recentProductIds.map((id) => products.find((item) => item.id === id)).filter(Boolean),
    [products, recentProductIds],
  );

  const result = useMemo(() => {
    if (!selectedProduct) return null;

    const widthM = width / 1000;
    const heightM = height / 1000;
    const area = widthM * heightM;
    const perimeter = 2 * (widthM + heightM);

    const details: PricingQuote['details'] = selectedProduct.items.map((item) => {
      const calcMode = item.calcMode || selectedProduct.pricingMode;
      const baseValue = calcMode === 'area'
        ? area
        : calcMode === 'perimeter'
          ? perimeter
          : 1;
      const itemQuantity = baseValue * item.quantity * quantity;
      const costPrice = item.costPrice || 0;
      const retailPrice = item.retailPrice || 0;
      return {
        materialId: item.materialId,
        name: `${item.materialName || '未命名材料'} (${modeLabelMap[calcMode] || calcMode})`,
        quantity: itemQuantity,
        unit: item.unitLabel || '件',
        costPrice,
        retailPrice,
        costSubtotal: itemQuantity * costPrice,
        retailSubtotal: itemQuantity * retailPrice,
      };
    });

    let costTotal = details.reduce((sum, item) => sum + item.costSubtotal, 0);
    let retailTotal = details.reduce((sum, item) => sum + item.retailSubtotal, 0);

    rateIds.forEach((rateId) => {
      const rate = rates.find((item) => item.id === rateId);
      if (!rate) return;
      const extraCost = costTotal * (rate.percentage / 100);
      const extraRetail = retailTotal * (rate.percentage / 100);
      details.push({
        materialId: undefined,
        name: rate.name,
        quantity: rate.percentage,
        unit: '%',
        costPrice: costTotal / 100,
        retailPrice: retailTotal / 100,
        costSubtotal: extraCost,
        retailSubtotal: extraRetail,
      });
      costTotal += extraCost;
      retailTotal += extraRetail;
    });

    return {
      area,
      perimeter,
      costTotal,
      retailTotal,
      costPerSquareMeter: area > 0 ? costTotal / area : 0,
      retailPerSquareMeter: area > 0 ? retailTotal / area : 0,
      details,
    };
  }, [height, quantity, rateIds, rates, selectedProduct, width]);

  const exportCurrentQuote = () => {
    if (!result || !selectedProduct) return;
    const rows = result.details.map((detail) => ({
      项目: detail.name,
      数量: Number(detail.quantity.toFixed(3)),
      单位: detail.unit,
      成本单价: Number(detail.costPrice.toFixed(2)),
      销售单价: Number(detail.retailPrice.toFixed(2)),
      成本小计: Number(detail.costSubtotal.toFixed(2)),
      销售小计: Number(detail.retailSubtotal.toFixed(2)),
    }));
    rows.push({
      项目: '合计',
      数量: quantity,
      单位: '项',
      成本单价: 0,
      销售单价: 0,
      成本小计: Number(result.costTotal.toFixed(2)),
      销售小计: Number(result.retailTotal.toFixed(2)),
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '报价摘要');
    XLSX.writeFile(workbook, `${quoteName || selectedProduct.name}_报价摘要.xlsx`);
  };

  const saveCurrentQuote = async () => {
    if (!selectedProduct || !result || !quoteName.trim()) {
      notifications.show({ title: '信息不完整', message: '请先填写报价名称并选择组合。', color: 'red' });
      return;
    }
    await saveQuote.mutateAsync({
      name: quoteName.trim(),
      productId: selectedProduct.id || null,
      productName: selectedProduct.name,
      width,
      height,
      quantity,
      area: result.area,
      perimeter: result.perimeter,
      costTotal: result.costTotal,
      retailTotal: result.retailTotal,
      details: result.details,
    });
    const matchedQueueIndex = pricingQueue.findIndex((item) => `${item.sourceName} 报价` === quoteName.trim() && Math.round(item.width) === width && Math.round(item.height) === height);
    const matchedQueueItem = matchedQueueIndex >= 0 ? pricingQueue[matchedQueueIndex] : null;
    const nextQueueItem = matchedQueueItem
      ? pricingQueue[matchedQueueIndex + 1] || pricingQueue.find((item) => item.id !== matchedQueueItem.id) || null
      : null;
    if (matchedQueueItem) removePricingQueueItem(matchedQueueItem.id);
    setQuoteName('');
    setSourceDrawingId(null);
    setSourceWindowId(null);
    if (nextQueueItem) {
      setPricingDraft({
        sourceName: nextQueueItem.sourceName,
        width: nextQueueItem.width,
        height: nextQueueItem.height,
        quantity: nextQueueItem.quantity,
      });
      notifications.show({ title: '已保存', message: '报价已保存，并自动切到下一条待报价窗型。', color: 'blue' });
      return;
    }
    setWidth(1500);
    setHeight(1500);
    setQuantity(1);
    notifications.show({ title: '已保存', message: '报价记录已保存到记录中心。', color: 'blue' });
  };

  const markRecentProduct = (nextProductId: string | null) => {
    if (!nextProductId) return;
    setRecentProductIds((current) => [nextProductId, ...current.filter((item) => item !== nextProductId)].slice(0, 8));
  };

  return (
    <PageScaffold
      title="报价中心"
      description="把报价改成商品卡片式流程：左边选来源，中间选组合和尺寸，右边直接看金额拆解。费率在这里叠加。"
    >
      <Box h="100%" style={{ display: 'grid', gridTemplateColumns: '320px 420px minmax(0, 1fr)', gap: 12 }}>
        <Paper withBorder p="md" radius={12} style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <Stack gap="md" style={{ flex: 1, minHeight: 0 }}>
            <Box>
              <Title order={4}>报价来源</Title>
              <Text size="sm" c="dimmed" mt={4}>
                可以从图纸队列直接接单，也可以从已保存图纸调尺寸。
              </Text>
            </Box>

            <Paper withBorder radius={12} p="sm" bg="var(--bg-subtle)">
              <Stack gap="sm">
                <Group justify="space-between">
                  <Text fw={700}>图纸报价准备区</Text>
                  <Button variant="subtle" size="compact-sm" onClick={clearPricingQueue} disabled={pricingQueue.length === 0}>
                    清空
                  </Button>
                </Group>
                <Text size="sm" c="dimmed">
                  当前待报价 {pricingQueue.length} 条
                </Text>
              </Stack>
            </Paper>

            <ScrollArea className="soft-scroll" style={{ flex: 1 }}>
              <Stack gap="sm">
                {pricingQueue.length === 0 ? (
                  <Paper withBorder radius={12} p="md" bg="var(--bg-subtle)">
                    <Text size="sm" c="dimmed">还没有待报价窗型，可先去图纸识别页加入。</Text>
                  </Paper>
                ) : pricingQueue.map((item) => (
                  <Paper key={item.id} withBorder radius={12} p="md" bg="var(--bg-subtle)">
                    <Stack gap="sm">
                      <Group justify="space-between" align="flex-start">
                        <Box>
                          <Text fw={800}>{item.sourceName}</Text>
                          <Text size="sm" c="dimmed" mt={4}>
                            {Math.round(item.width)} × {Math.round(item.height)} / 数量 {item.quantity}
                          </Text>
                        </Box>
                        <Badge variant="light">待处理</Badge>
                      </Group>
                      <Group gap="xs">
                        <Button
                          size="compact-sm"
                          variant="light"
                          onClick={() => {
                            setPricingDraft({
                              sourceName: item.sourceName,
                              width: item.width,
                              height: item.height,
                              quantity: item.quantity,
                            });
                          }}
                        >
                          带入报价
                        </Button>
                        <Button size="compact-sm" variant="subtle" color="red" onClick={() => removePricingQueueItem(item.id)}>
                          移除
                        </Button>
                      </Group>
                    </Stack>
                  </Paper>
                ))}

                <Paper withBorder radius={12} p="md">
                  <Stack gap="md">
                    <Text fw={700}>从已保存图纸带入</Text>
                    <Select
                      label="图纸记录"
                      placeholder="选择一份图纸"
                      data={drawings.map((item) => ({ value: item.id || '', label: item.title }))}
                      value={sourceDrawingId}
                      onChange={(value) => {
                        setSourceDrawingId(value);
                        setSourceWindowId(null);
                      }}
                      searchable
                    />
                    <Select
                      label="窗型"
                      placeholder="选择窗型带入尺寸"
                      data={sourceWindows.map((item) => ({ value: item.id || '', label: `${item.name} (${Math.round(item.width)} × ${Math.round(item.height)})` }))}
                      value={sourceWindowId}
                      onChange={setSourceWindowId}
                      disabled={!sourceDrawingId}
                      searchable
                    />
                  </Stack>
                </Paper>
              </Stack>
            </ScrollArea>
          </Stack>
        </Paper>

        <Paper withBorder p="md" radius={12} style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <Stack gap="md" style={{ flex: 1, minHeight: 0 }}>
            <Box>
              <Title order={4}>选择组合并设置参数</Title>
              <Text size="sm" c="dimmed" mt={4}>
                主操作就是先挑组合卡片，再填宽高和数量，费率在这里一起叠加。
              </Text>
            </Box>

            <TextInput
              label="报价名称"
              value={quoteName}
              onChange={(event) => setQuoteName(event.currentTarget.value)}
              placeholder="例如：A栋南立面玻璃报价"
            />

            {recentProducts.length > 0 ? (
              <Paper withBorder radius={12} p="sm" bg="var(--bg-subtle)">
                <Stack gap="xs">
                  <Text fw={700}>最近使用组合</Text>
                  <Group gap="xs">
                    {recentProducts.map((product) => (
                      <Button
                        key={product?.id}
                        size="compact-sm"
                        variant="light"
                        onClick={() => {
                          const nextId = product?.id || null;
                          setProductId(nextId);
                          markRecentProduct(nextId);
                        }}
                      >
                        {product?.name}
                      </Button>
                    ))}
                  </Group>
                </Stack>
              </Paper>
            ) : null}

            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
              <NumberInput label="宽度 (mm)" value={width} onChange={(value) => setWidth(Number(value) || 0)} min={1} />
              <NumberInput label="高度 (mm)" value={height} onChange={(value) => setHeight(Number(value) || 0)} min={1} />
            </SimpleGrid>

            <Paper withBorder radius={12} p="sm">
              <Stack gap="xs">
                <Text fw={700}>常用尺寸预设</Text>
                <Group gap="xs">
                  {sizePresets.map((preset) => (
                    <Button
                      key={preset.label}
                      size="compact-sm"
                      variant="default"
                      onClick={() => {
                        setWidth(preset.width);
                        setHeight(preset.height);
                      }}
                    >
                      {preset.label}
                    </Button>
                  ))}
                </Group>
              </Stack>
            </Paper>

            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
              <NumberInput label="数量" value={quantity} onChange={(value) => setQuantity(Number(value) || 1)} min={1} />
              <MultiSelect
                label="附加费率"
                data={rates.map((item) => ({ value: item.id || '', label: `${item.name} (${item.percentage}%)` }))}
                value={rateIds}
                onChange={setRateIds}
                placeholder="可多选"
              />
            </SimpleGrid>

            <TextInput
              leftSection={<IconSearch size={16} />}
              placeholder="搜索组合名称或材料"
              value={productKeyword}
              onChange={(event) => setProductKeyword(event.currentTarget.value)}
            />

            <ScrollArea className="soft-scroll" style={{ flex: 1 }}>
              <SimpleGrid cols={{ base: 1, xl: 2 }} spacing="sm">
                {productSummary.map((product) => (
                  <Paper
                    key={product.id}
                    withBorder
                    radius={12}
                    p="md"
                    bg={productId === product.id ? 'var(--primary-soft)' : 'var(--bg-subtle)'}
                    style={{ cursor: 'pointer' }}
                    onClick={() => {
                      const nextId = product.id || null;
                      setProductId(nextId);
                      markRecentProduct(nextId);
                    }}
                  >
                    <Stack gap="sm">
                      <Group justify="space-between" align="flex-start">
                        <Box maw={220}>
                          <Text fw={800}>{product.name}</Text>
                          <Text size="sm" c="dimmed" mt={4}>
                            {modeLabelMap[product.pricingMode] || product.pricingMode}
                          </Text>
                        </Box>
                        {productId === product.id ? <Badge>已选中</Badge> : <Badge variant="light">{product.items.length} 项</Badge>}
                      </Group>
                      <Group gap="xs">
                        <Badge variant="light">平米项 {product.areaCount}</Badge>
                        <Badge variant="light">长度项 {product.perimeterCount}</Badge>
                        <Badge variant="light">固定项 {product.fixedCount}</Badge>
                      </Group>
                      <Text size="sm" c="dimmed">
                        {product.items.slice(0, 3).map((item) => item.materialName).join('，') || '暂无材料'}
                        {product.items.length > 3 ? ` 等 ${product.items.length} 项` : ''}
                      </Text>
                    </Stack>
                  </Paper>
                ))}
              </SimpleGrid>
            </ScrollArea>
          </Stack>
        </Paper>

        <Paper withBorder p="md" radius={12} style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <Stack gap="md" style={{ flex: 1, minHeight: 0 }}>
            <Group justify="space-between" align="flex-start">
              <Box>
                <Title order={4}>报价结果</Title>
                <Text size="sm" c="dimmed" mt={4}>
                  右侧直接看报价总额和材料拆解，确认后保存或导出。
                </Text>
              </Box>
              {selectedProduct ? <Badge variant="light">{selectedProduct.name}</Badge> : null}
            </Group>

            {result ? (
              <>
                <SimpleGrid cols={{ base: 1, xl: 2 }} spacing="sm">
                  <Paper withBorder radius={12} p="md" bg="var(--bg-subtle)">
                    <Text size="sm" c="dimmed">面积</Text>
                    <Title order={3} mt={6}>{result.area.toFixed(3)} ㎡</Title>
                  </Paper>
                  <Paper withBorder radius={12} p="md" bg="var(--bg-subtle)">
                    <Text size="sm" c="dimmed">周长</Text>
                    <Title order={3} mt={6}>{result.perimeter.toFixed(3)} m</Title>
                  </Paper>
                  <Paper withBorder radius={12} p="md" bg="var(--bg-subtle)">
                    <Text size="sm" c="dimmed">总成本</Text>
                    <Title order={3} mt={6}>{result.costTotal.toFixed(2)}</Title>
                  </Paper>
                  <Paper withBorder radius={12} p="md" bg="var(--bg-subtle)">
                    <Text size="sm" c="dimmed">销售总价</Text>
                    <Title order={3} mt={6}>{result.retailTotal.toFixed(2)}</Title>
                  </Paper>
                  <Paper withBorder radius={12} p="md" bg="var(--bg-subtle)">
                    <Text size="sm" c="dimmed">单平米成本</Text>
                    <Title order={3} mt={6}>{result.costPerSquareMeter.toFixed(2)}</Title>
                  </Paper>
                  <Paper withBorder radius={12} p="md" bg="var(--bg-subtle)">
                    <Text size="sm" c="dimmed">单平米售价</Text>
                    <Title order={3} mt={6}>{result.retailPerSquareMeter.toFixed(2)}</Title>
                  </Paper>
                </SimpleGrid>

                <ScrollArea className="soft-scroll" style={{ flex: 1 }}>
                  <Stack gap="sm">
                    {result.details.map((detail, index) => (
                      <Paper key={`${detail.name}-${index}`} withBorder radius={12} p="md" bg="var(--bg-subtle)">
                        <Group justify="space-between" align="flex-start">
                          <Box>
                            <Text fw={800}>{detail.name}</Text>
                            <Text size="sm" c="dimmed" mt={4}>
                              数量 {detail.quantity.toFixed(3)} {detail.unit}
                            </Text>
                          </Box>
                          <Badge variant="light">销售小计 {detail.retailSubtotal.toFixed(2)}</Badge>
                        </Group>
                        <Group gap="lg" mt="sm">
                          <Text size="sm" c="dimmed">成本单价 {detail.costPrice.toFixed(2)}</Text>
                          <Text size="sm" c="dimmed">销售单价 {detail.retailPrice.toFixed(2)}</Text>
                          <Text size="sm" c="dimmed">成本小计 {detail.costSubtotal.toFixed(2)}</Text>
                        </Group>
                      </Paper>
                    ))}
                  </Stack>
                </ScrollArea>

                <Group>
                  <Button leftSection={<IconDeviceFloppy size={16} />} onClick={saveCurrentQuote}>
                    保存报价
                  </Button>
                  <Button variant="default" leftSection={<IconFileExport size={16} />} onClick={exportCurrentQuote}>
                    导出报价摘要
                  </Button>
                  <Button variant="subtle" onClick={() => navigate('/records')}>
                    去记录中心查看
                  </Button>
                </Group>
              </>
            ) : (
              <Paper withBorder radius={12} p="xl" bg="var(--bg-subtle)" style={{ display: 'grid', placeItems: 'center', flex: 1 }}>
                <Text c="dimmed">先在中间选一个组合，再输入尺寸，这里会自动生成报价拆解。</Text>
              </Paper>
            )}
          </Stack>
        </Paper>
      </Box>
    </PageScaffold>
  );
};

export default PricingPage;
