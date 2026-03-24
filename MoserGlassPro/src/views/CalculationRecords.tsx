import React, { useEffect, useState } from 'react';
import { 
  Title, 
  Table, 
  Paper, 
  Group, 
  Button, 
  Text, 
  ActionIcon, 
  Stack,
  Badge,
  ScrollArea,
  Tabs,
  Card,
  SimpleGrid,
  Divider,
  Modal,
  Box
} from '@mantine/core';
import { useCalculationStore } from '../store/calculationStore';
import { 
  IconTrash, 
  IconDownload, 
  IconFileSpreadsheet, 
  IconCloudUpload, 
  IconHistory, 
  IconCalculator,
  IconEye
} from '@tabler/icons-react';
import * as XLSX from 'xlsx';
import { notifications } from '@mantine/notifications';
import { api } from '../lib/api';

export function CalculationRecords() {
  const { queue, removeFromQueue, clearQueue } = useCalculationStore();
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<string | null>('queue');
  const [selectedRecord, setSelectedRecord] = useState<any>(null);

  // 加载历史记录
  const fetchHistory = async () => {
    try {
      setLoading(true);
      const data = await api.getCalculationRecords();
      setHistory(data);
    } catch (error) {
      notifications.show({ title: '加载失败', message: '无法获取历史记录', color: 'red' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistory();
    }
  }, [activeTab]);

  // 保存到数据库
  const saveAllToHistory = async () => {
    if (queue.length === 0) return;
    
    setLoading(true);
    try {
      for (const item of queue) {
        await api.createCalculationRecord({
          name: item.name,
          combinationId: item.combinationId,
          shapeName: item.shapeName,
          params: JSON.stringify(item.params),
          totalPrice: item.totalPrice,
          agencyTotalPrice: item.agencyTotalPrice,
          retailTotalPrice: item.totalPrice,
          details: JSON.stringify(item.details)
        });
      }
      notifications.show({ title: '保存成功', message: '所有记录已存档', color: 'teal' });
      clearQueue();
      setActiveTab('history');
    } catch (error) {
      notifications.show({ title: '保存失败', message: '部分记录未能保存', color: 'red' });
    } finally {
      setLoading(false);
    }
  };

  const deleteHistoryRecord = async (id: number) => {
    try {
      await api.deleteCalculationRecord(id);
      setHistory(history.filter(h => h.id !== id));
      notifications.show({ title: '已删除', message: '历史记录已移除', color: 'gray' });
    } catch (error) {
      notifications.show({ title: '删除失败', message: '无法删除记录', color: 'red' });
    }
  };

  const exportToExcel = (dataList: any[], fileName: string) => {
    if (dataList.length === 0) return;

    const data = dataList.map(item => ({
      '项目/组合': item.name,
      '计算日期': new Date(item.createdAt || Date.now()).toLocaleString(),
      '零售总额': item.totalPrice.toFixed(2),
      '代理成本': item.agencyTotalPrice.toFixed(2),
      '详情': typeof item.details === 'string' 
        ? JSON.parse(item.details).map((d: any) => `${d.name}x${d.quantity}`).join('; ')
        : item.details.map((d: any) => `${d.name}x${d.quantity}`).join('; ')
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "报价清单");
    XLSX.writeFile(wb, `${fileName}_${new Date().getTime()}.xlsx`);
  };

  const totalRetail = queue.reduce((sum, i) => sum + i.totalPrice, 0);

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Title order={2}>计算中心记录</Title>
      </Group>

      <Tabs value={activeTab} onChange={setActiveTab} variant="outline" radius="md">
        <Tabs.List>
          <Tabs.Tab value="queue" leftSection={<IconCalculator size={16} />}>
            当前计算库 <Badge size="xs" ml={4} color="teal">{queue.length}</Badge>
          </Tabs.Tab>
          <Tabs.Tab value="history" leftSection={<IconHistory size={16} />}>
            历史存案
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="queue" pt="md">
          <Stack gap="md">
            <Group justify="space-between">
              <Text size="sm" c="dimmed">在此管理您本次计算的结果，确认无误后可保存至历史记录。</Text>
              <Group>
                <Button 
                  variant="subtle" 
                  color="red" 
                  leftSection={<IconTrash size={16} />}
                  onClick={clearQueue}
                  disabled={queue.length === 0}
                >
                  清空待办
                </Button>
                <Button 
                  variant="filled" 
                  color="teal" 
                  leftSection={<IconCloudUpload size={16} />}
                  onClick={saveAllToHistory}
                  loading={loading}
                  disabled={queue.length === 0}
                >
                  保存至历史
                </Button>
                <Button 
                  variant="outline"
                  leftSection={<IconFileSpreadsheet size={16} />}
                  onClick={() => exportToExcel(queue, '当前报价清单')}
                  disabled={queue.length === 0}
                >
                  直接导出
                </Button>
              </Group>
            </Group>

            <Paper withBorder radius="md">
              <Table striped highlightOnHover verticalSpacing="sm">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>组合名称</Table.Th>
                    <Table.Th>代理成本</Table.Th>
                    <Table.Th>零售报价</Table.Th>
                    <Table.Th>详情摘要</Table.Th>
                    <Table.Th w={60}></Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {queue.length === 0 ? (
                    <Table.Tr><Table.Td colSpan={5} align="center" py="xl"><Text c="dimmed">暂无待存记录</Text></Table.Td></Table.Tr>
                  ) : (
                    queue.map((item) => (
                      <Table.Tr key={item.id}>
                        <Table.Td><Text fw={700} size="sm">{item.name}</Text></Table.Td>
                        <Table.Td><Text size="xs">¥{item.agencyTotalPrice.toFixed(2)}</Text></Table.Td>
                        <Table.Td><Text fw={700} c="teal">¥{item.totalPrice.toFixed(2)}</Text></Table.Td>
                        <Table.Td><Text size="xs" truncate maw={250}>{item.details.map((d: any) => d.name).join(', ')}</Text></Table.Td>
                        <Table.Td>
                          <ActionIcon color="red" variant="subtle" onClick={() => removeFromQueue(item.id)}>
                            <IconTrash size={16} />
                          </ActionIcon>
                        </Table.Td>
                      </Table.Tr>
                    ))
                  )}
                </Table.Tbody>
              </Table>
            </Paper>

            {queue.length > 0 && (
              <Card withBorder radius="md" bg="teal.0">
                <Group justify="space-between">
                  <Text fw={700}>本次总额预估</Text>
                  <Text fw={900} c="teal" size="xl">¥{totalRetail.toFixed(2)}</Text>
                </Group>
              </Card>
            )}
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="history" pt="md">
          <Stack gap="md">
            <Group justify="space-between">
              <Text size="sm" c="dimmed">查看已保存的报价历史记录。</Text>
              <Button 
                variant="outline" 
                leftSection={<IconDownload size={16} />}
                onClick={() => exportToExcel(history, '历史存档记录')}
                disabled={history.length === 0}
              >
                导出全部历史
              </Button>
            </Group>

            <SimpleGrid cols={{ base: 1, md: 2 }} gap="md">
              {history.length === 0 ? (
                <Text align="center" c="dimmed" span>暂无历史记录</Text>
              ) : (
                history.map((record) => (
                  <Card key={record.id} withBorder shadow="sm" radius="md">
                    <Group justify="space-between" mb="xs">
                      <Text fw={700}>{record.name}</Text>
                      <Badge color="gray">{new Date(record.createdAt).toLocaleDateString()}</Badge>
                    </Group>
                    
                    <Divider my="sm" />
                    
                    <SimpleGrid cols={2}>
                      <Box>
                        <Text size="xs" c="dimmed">零售总额</Text>
                        <Text fw={700} c="teal" size="lg">¥{record.totalPrice.toFixed(2)}</Text>
                      </Box>
                      <Box>
                        <Text size="xs" c="dimmed">代理成本</Text>
                        <Text fw={700} size="lg">¥{record.agencyTotalPrice.toFixed(2)}</Text>
                      </Box>
                    </SimpleGrid>

                    <Group mt="md" justify="flex-end">
                      <ActionIcon variant="light" color="blue" onClick={() => setSelectedRecord(record)}>
                        <IconEye size={16} />
                      </ActionIcon>
                      <ActionIcon variant="light" color="red" onClick={() => deleteHistoryRecord(record.id)}>
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Group>
                  </Card>
                ))
              )}
            </SimpleGrid>
          </Stack>
        </Tabs.Panel>
      </Tabs>

      {/* 详情弹窗 */}
      <Modal 
        opened={!!selectedRecord} 
        onClose={() => setSelectedRecord(null)} 
        title="计算记录详情" 
        size="lg"
      >
        {selectedRecord && (
          <Stack>
            <SimpleGrid cols={2}>
              <Box>
                <Text size="sm" fw={500}>形状/模式</Text>
                <Text size="sm">{selectedRecord.shapeName || '标准组合'}</Text>
              </Box>
              <Box>
                <Text size="sm" fw={500}>计算日期</Text>
                <Text size="sm">{new Date(selectedRecord.createdAt).toLocaleString()}</Text>
              </Box>
            </SimpleGrid>
            
            <Divider label="费用组成" labelPosition="center" />
            
            <Table withTableBorder>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>组件名称</Table.Th>
                  <Table.Th>数量</Table.Th>
                  <Table.Th>单价</Table.Th>
                  <Table.Th>小计</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {JSON.parse(selectedRecord.details).map((d: any, idx: number) => (
                  <Table.Tr key={idx}>
                    <Table.Td>{d.name}</Table.Td>
                    <Table.Td>{d.quantity.toFixed(2)} {d.unit}</Table.Td>
                    <Table.Td>¥{d.unitPrice.toFixed(2)}</Table.Td>
                    <Table.Td fw={500}>¥{d.subTotal.toFixed(2)}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
            
            <Group justify="flex-end" mt="md">
              <Button onClick={() => setSelectedRecord(null)}>关闭</Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}
