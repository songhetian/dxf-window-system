import React, { useState, useEffect } from 'react';
import { 
  Title, 
  Grid, 
  Paper, 
  Stack, 
  Text, 
  Group, 
  Button, 
  Select, 
  NumberInput,
  Divider,
  MultiSelect,
  Table,
  ActionIcon,
  Badge,
  ScrollArea,
  TextInput
} from '@mantine/core';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { IconCalculator, IconPlus, IconTrash, IconShoppingCartPlus, IconSearch } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useCalculationStore } from '../store/calculationStore';

const SHAPES = [
  { value: 'RECT', label: '矩形', params: ['w', 'h'], area: 'w * h', perimeter: '2 * (w + h)' },
  { value: 'TRI', label: '三角形', params: ['w', 'h'], area: '0.5 * w * h', perimeter: 'w + h + Math.sqrt(w*w + h*h)' },
  { value: 'TRAP', label: '梯形', params: ['w1', 'w2', 'h'], area: '0.5 * (w1 + w2) * h', perimeter: 'w1 + w2 + 2 * Math.sqrt(Math.pow(Math.abs(w1-w2)/2, 2) + h*h)' },
];

export function CalculationCenter() {
  const queryClient = useQueryClient();
  const addToQueue = useCalculationStore(state => state.addToQueue);
  
  const [selectedComboId, setSelectedComboId] = useState<string | null>(null);
  const [selectedAccessories, setSelectedAccessories] = useState<string[]>([]);
  const [selectedShape, setSelectedShape] = useState<string | null>('RECT');
  const [shapeParams, setShapeParams] = useState<any>({ w: 1.5, h: 1.5 });
  const [extraRateIds, setExtraRateIds] = useState<string[]>([]);
  
  const { data: combinations = [] } = useQuery({ queryKey: ['combinations'], queryFn: api.getCombinations });
  const { data: components = [] } = useQuery({ queryKey: ['components'], queryFn: api.getComponents });
  const { data: extraRates = [] } = useQuery({ queryKey: ['extra-rates'], queryFn: api.getExtraRates });

  const accessoryComponents = components.filter((c: any) => c.category.type === 'ACCESSORY');
  
  // 需求 6: 自动匹配与创建逻辑
  const findOrCreateMutation = useMutation({
    mutationFn: (data: any) => fetch('http://127.0.0.1:3000/api/combinations/find-or-create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['combinations'] });
    }
  });

  const calculateResult = () => {
    const combo = combinations.find((c: any) => c.id === Number(selectedComboId));
    if (!combo) return null;

    const shape = SHAPES.find(s => s.value === selectedShape);
    if (!shape) return null;

    const { w = 0, h = 0, w1 = 0, w2 = 0 } = shapeParams;
    let area = 0;
    let perimeter = 0;
    
    if (selectedShape === 'RECT') {
      area = w * h;
      perimeter = 2 * (w + h);
    } else if (selectedShape === 'TRI') {
      area = 0.5 * w * h;
      perimeter = w + h + Math.sqrt(w*w + h*h);
    } else if (selectedShape === 'TRAP') {
      area = 0.5 * (w1 + w2) * h;
      perimeter = w1 + w2 + 2 * Math.sqrt(Math.pow(Math.abs(w1-w2)/2, 2) + h*h);
    }

    const selectedAccs = components.filter((c: any) => selectedAccessories.includes(c.id.toString()));
    
    let agencyTotal = combo.agencyPrice * area;
    let retailTotal = combo.retailPrice * area;

    const details: any[] = [
      { name: `基础组合: ${combo.name}`, quantity: area, unit: '㎡', price: combo.retailPrice, subtotal: combo.retailPrice * area }
    ];

    selectedAccs.forEach((acc: any) => {
      let qty = 1;
      let unit = acc.unitType || '件';
      if (acc.unitType === 'SQM') qty = area;
      else if (acc.unitType === 'LINEAR') qty = perimeter;
      
      agencyTotal += acc.agencyPrice * qty;
      retailTotal += acc.retailPrice * qty;
      details.push({ name: acc.name, quantity: qty, unit, price: acc.retailPrice, subtotal: acc.retailPrice * qty });
    });

    let ratesTotal = 0;
    extraRateIds.forEach(id => {
      const rate = extraRates.find((r: any) => r.id === Number(id));
      if (rate) {
        const rateAmount = retailTotal * (rate.percentage / 100);
        ratesTotal += rateAmount;
        details.push({ name: `费率: ${rate.name}`, quantity: rate.percentage, unit: '%', price: retailTotal / 100, subtotal: rateAmount });
      }
    });

    retailTotal += ratesTotal;
    return { area, perimeter, agencyTotal, retailTotal, details };
  };

  const result = calculateResult();

  const handleAddToQueue = async () => {
    if (!result || !selectedComboId) return;
    
    const combo = combinations.find((c: any) => c.id === Number(selectedComboId));
    
    // 如果存在配件选择，我们需要创建一个包含这些配件的新组合（或匹配已有组合）
    // 这里体现了“自动匹配”的核心逻辑
    const comboComponents = combo.components.map((cc: any) => ({ componentId: cc.componentId, quantity: cc.quantity }));
    const accessoryItems = components
      .filter((c: any) => selectedAccessories.includes(c.id.toString()))
      .map((c: any) => ({ componentId: c.id, quantity: 1 })); // 这里的 1 可以是根据形状计算后的数量

    // 调用后端寻址接口
    const finalCombo = await findOrCreateMutation.mutateAsync({
      name: `${combo.name} + 配件组合`,
      components: [...comboComponents, ...accessoryItems]
    });

    addToQueue({
      id: Math.random().toString(36).substr(2, 9),
      name: finalCombo.name,
      details: result.details,
      totalPrice: result.retailTotal,
      agencyTotalPrice: result.agencyTotal,
      area: result.area,
      perimeter: result.perimeter,
      params: shapeParams,
      extraRates: extraRateIds.map(id => extraRates.find((r: any) => r.id === Number(id)))
    });

    notifications.show({ title: '成功', message: '已加入计算库并自动同步组合关系', color: 'teal' });
  };

  return (
    <Stack gap="md">
      <Group justify="space-between" align="center">
        <Title order={2}>计算中心</Title>
        <TextInput 
          placeholder="快速搜索组合或参数..." 
          leftSection={<IconSearch size={16} />}
          style={{ flexGrow: 1, maxWidth: 400 }}
          radius="md"
        />
      </Group>

      <Grid gutter="md">
        <Grid.Col span={4}>
          <Paper withBorder p="md" radius="md" bg="white">
            <Stack gap="md">
              <Select 
                label="1. 选择成品组合"
                placeholder="搜索已有组合" 
                data={combinations.map((c: any) => ({ value: c.id.toString(), label: c.name }))}
                value={selectedComboId}
                onChange={setSelectedComboId}
                searchable
              />

              <Divider label="2. 窗户形状与尺寸" labelPosition="center" />
              <Select 
                label="窗户形状"
                data={SHAPES}
                value={selectedShape}
                onChange={setSelectedShape}
              />
              <Group grow>
                {selectedShape === 'RECT' || selectedShape === 'TRI' ? (
                  <>
                    <NumberInput label="宽度 (m)" value={shapeParams.w} onChange={(v) => setShapeParams({...shapeParams, w: Number(v)})} min={0.1} decimalScale={3} />
                    <NumberInput label="高度 (m)" value={shapeParams.h} onChange={(v) => setShapeParams({...shapeParams, h: Number(v)})} min={0.1} decimalScale={3} />
                  </>
                ) : (
                  <>
                    <NumberInput label="上底 (m)" value={shapeParams.w1} onChange={(v) => setShapeParams({...shapeParams, w1: Number(v)})} min={0.1} />
                    <NumberInput label="下底 (m)" value={shapeParams.w2} onChange={(v) => setShapeParams({...shapeParams, w2: Number(v)})} min={0.1} />
                    <NumberInput label="高度 (m)" value={shapeParams.h} onChange={(v) => setShapeParams({...shapeParams, h: Number(v)})} min={0.1} />
                  </>
                )}
              </Group>

              <Divider label="3. 选配配件" labelPosition="center" />
              <MultiSelect 
                label="额外配件"
                placeholder="点击选择配件"
                data={accessoryComponents.map((c: any) => ({ value: c.id.toString(), label: c.name }))}
                value={selectedAccessories}
                onChange={setSelectedAccessories}
                searchable
              />

              <Divider label="4. 附加费率" labelPosition="center" />
              <MultiSelect 
                label="费率列表"
                placeholder="选择税费或服务费"
                data={extraRates.map((r: any) => ({ value: r.id.toString(), label: `${r.name} (${r.percentage}%)` }))}
                value={extraRateIds}
                onChange={setExtraRateIds}
              />
            </Stack>
          </Paper>
        </Grid.Col>

        <Grid.Col span={8}>
          <Paper withBorder p="md" radius="md" h="72vh" bg="white">
            <Stack justify="space-between" h="full">
              <ScrollArea h="calc(72vh - 160px)">
                <Group justify="space-between" mb="md">
                  <Title order={4}>工程预估详情</Title>
                  {result && <Badge color="teal" size="lg" variant="light">实时计算已激活</Badge>}
                </Group>
                
                {result ? (
                  <Table striped highlightOnHover withTableBorder>
                    <Table.Thead bg="gray.0">
                      <Table.Tr>
                        <Table.Th>内容描述</Table.Th>
                        <Table.Th>数量</Table.Th>
                        <Table.Th>单位</Table.Th>
                        <Table.Th>单价</Table.Th>
                        <Table.Th>小计</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {result.details.map((d: any, i: number) => (
                        <Table.Tr key={i}>
                          <Table.Td>{d.name}</Table.Td>
                          <Table.Td>{d.quantity.toFixed(3)}</Table.Td>
                          <Table.Td>{d.unit}</Table.Td>
                          <Table.Td>¥{d.price.toFixed(2)}</Table.Td>
                          <Table.Td fw={700}>¥{d.subtotal.toFixed(2)}</Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                ) : (
                  <Stack align="center" py={100} c="dimmed">
                    <IconCalculator size={64} stroke={1} opacity={0.3} />
                    <Text size="sm">请在左侧配置窗户参数以生成实时报价详情</Text>
                  </Stack>
                )}
              </ScrollArea>

              {result && (
                <Paper p="md" bg="teal.0" radius="md" style={{ borderLeft: '4px solid var(--mantine-color-teal-6)' }}>
                  <Grid align="center">
                    <Grid.Col span={6}>
                      <Group gap="xs">
                        <Badge color="teal" variant="filled">面积: {result.area.toFixed(3)}㎡</Badge>
                        <Badge color="blue" variant="filled">周长: {result.perimeter.toFixed(3)}m</Badge>
                      </Group>
                      <Text size="xs" c="dimmed" mt={5}>内部核算代理成本: ¥{result.agencyTotal.toFixed(2)}</Text>
                    </Grid.Col>
                    <Grid.Col span={6}>
                      <Stack align="flex-end" gap={0}>
                        <Text size="xs" c="dimmed" fw={700} uppercase>RETAIL TOTAL (零售总额)</Text>
                        <Text fw={900} c="teal" size="xl" style={{ fontSize: '2rem', lineHeight: 1.1 }}>
                          ¥{result.retailTotal.toFixed(2)}
                        </Text>
                        <Button 
                          mt="md"
                          fullWidth
                          size="md"
                          leftSection={<IconShoppingCartPlus size={20} />} 
                          onClick={handleAddToQueue}
                          loading={findOrCreateMutation.isPending}
                        >
                          加入计算库
                        </Button>
                      </Stack>
                    </Grid.Col>
                  </Grid>
                </Paper>
              )}
            </Stack>
          </Paper>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
