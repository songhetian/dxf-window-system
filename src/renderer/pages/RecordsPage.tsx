import React, { useMemo, useState } from 'react';
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Group,
  Modal,
  Paper,
  ScrollArea,
  Stack,
  Table,
  Tabs,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { IconDownload, IconSearch, IconTrash } from '@tabler/icons-react';
import { modals } from '@mantine/modals';
import * as XLSX from 'xlsx';
import { useNavigate } from 'react-router-dom';

import {
  useDeleteDrawing,
  useDeletePricingQuote,
  useDrawings,
  usePricingQuotes,
} from '../hooks/useWindowApi';
import { PageScaffold } from '../components/ui/PageScaffold';
import { useWindowStore } from '../stores/windowStore';
import { useShallow } from 'zustand/react/shallow';

const exportExcel = (rows: Record<string, string | number>[], fileName: string) => {
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
};

const RecordsPage = () => {
  const navigate = useNavigate();
  const { data: drawings = [] } = useDrawings();
  const { data: quotes = [] } = usePricingQuotes();
  const deleteDrawing = useDeleteDrawing();
  const deleteQuote = useDeletePricingQuote();
  const { setPricingDraft } = useWindowStore(useShallow((state) => ({
    setPricingDraft: state.setPricingDraft,
  })));
  const [keyword, setKeyword] = useState('');
  const [selectedQuote, setSelectedQuote] = useState<any | null>(null);

  const filteredDrawings = useMemo(
    () => drawings.filter((item) => `${item.title} ${item.fileName}`.toLowerCase().includes(keyword.toLowerCase())),
    [drawings, keyword],
  );

  const filteredQuotes = useMemo(
    () => quotes.filter((item) => `${item.name} ${item.productName || ''} ${item.items?.map((line: any) => line.productName || '').join(' ') || ''}`.toLowerCase().includes(keyword.toLowerCase())),
    [keyword, quotes],
  );

  return (
    <PageScaffold
      title="记录中心"
      description="这里统一查看图纸识别记录和报价记录。先搜索，再导出或删除。"
      actions={
        <TextInput
          w={280}
          placeholder="搜索记录"
          leftSection={<IconSearch size={16} />}
          value={keyword}
          onChange={(event) => setKeyword(event.currentTarget.value)}
        />
      }
    >
      <Paper withBorder radius={12} h="100%" p="md">
        <Tabs defaultValue="drawings" h="100%">
          <Tabs.List>
            <Tabs.Tab value="drawings">图纸记录</Tabs.Tab>
            <Tabs.Tab value="quotes">报价记录</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="drawings" pt="md" h="calc(100% - 42px)">
            <Box h="100%" style={{ display: 'flex', flexDirection: 'column' }}>
              <Group justify="space-between" mb="md">
                <Title order={4}>图纸记录</Title>
                <Button
                  variant="default"
                  leftSection={<IconDownload size={16} />}
                  onClick={() => exportExcel(filteredDrawings.map((item) => ({
                    标题: item.title,
                    文件名: item.fileName,
                    数量: item.windowCount,
                    总面积: item.totalArea,
                    创建时间: item.createdAt || '',
                  })), '图纸记录')}
                >
                  导出 Excel
                </Button>
              </Group>
              <ScrollArea className="soft-scroll" style={{ flex: 1 }}>
                <Table>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>标题</Table.Th>
                      <Table.Th>文件名</Table.Th>
                      <Table.Th>窗数</Table.Th>
                      <Table.Th>总面积</Table.Th>
                      <Table.Th>创建时间</Table.Th>
                      <Table.Th></Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {filteredDrawings.map((item) => (
                      <Table.Tr key={item.id}>
                        <Table.Td>{item.title}</Table.Td>
                        <Table.Td>{item.fileName}</Table.Td>
                        <Table.Td>{item.windowCount}</Table.Td>
                        <Table.Td>{item.totalArea.toFixed(2)}</Table.Td>
                        <Table.Td>{item.createdAt ? new Date(item.createdAt).toLocaleString() : '-'}</Table.Td>
                        <Table.Td>
                          <ActionIcon
                            color="red"
                            variant="subtle"
                            onClick={() => modals.openConfirmModal({
                              title: '删除图纸记录',
                              centered: true,
                              children: <Text size="sm">删除后无法恢复。</Text>,
                              labels: { confirm: '确认删除', cancel: '取消' },
                              confirmProps: { color: 'red' },
                              onConfirm: () => deleteDrawing.mutate(item.id || ''),
                            })}
                          >
                            <IconTrash size={16} />
                          </ActionIcon>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </ScrollArea>
            </Box>
          </Tabs.Panel>

          <Tabs.Panel value="quotes" pt="md" h="calc(100% - 42px)">
            <Box h="100%" style={{ display: 'flex', flexDirection: 'column' }}>
              <Group justify="space-between" mb="md">
                <Title order={4}>报价记录</Title>
                <Button
                  variant="default"
                  leftSection={<IconDownload size={16} />}
                  onClick={() => exportExcel(filteredQuotes.map((item) => ({
                    名称: item.name,
                    产品: item.productName || '',
                    组合数: item.items?.length || 0,
                    总面积: item.area,
                    总周长: item.perimeter,
                    成本总额: item.costTotal,
                    销售总额: item.retailTotal,
                    创建时间: item.createdAt || '',
                  })), '报价记录')}
                >
                  导出 Excel
                </Button>
              </Group>
              <ScrollArea className="soft-scroll" style={{ flex: 1 }}>
                <Table>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>名称</Table.Th>
                      <Table.Th>组合</Table.Th>
                      <Table.Th>组合数</Table.Th>
                      <Table.Th>总面积</Table.Th>
                      <Table.Th>成本</Table.Th>
                      <Table.Th>销售</Table.Th>
                      <Table.Th>创建时间</Table.Th>
                      <Table.Th></Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {filteredQuotes.map((item) => (
                      <Table.Tr key={item.id}>
                        <Table.Td>{item.name}</Table.Td>
                        <Table.Td>{item.productName || '-'}</Table.Td>
                        <Table.Td>{item.items?.length || 0}</Table.Td>
                        <Table.Td>{item.area.toFixed(3)} ㎡</Table.Td>
                        <Table.Td>{item.costTotal.toFixed(2)}</Table.Td>
                        <Table.Td>{item.retailTotal.toFixed(2)}</Table.Td>
                        <Table.Td>{item.createdAt ? new Date(item.createdAt).toLocaleString() : '-'}</Table.Td>
                        <Table.Td>
                          <Group gap={6}>
                            <Button variant="subtle" size="compact-sm" onClick={() => setSelectedQuote(item)}>
                              查看
                            </Button>
                            <Button
                              variant="subtle"
                              size="compact-sm"
                              onClick={() => {
                                const firstLine = item.items?.[0];
                                setPricingDraft({
                                  sourceName: item.name,
                                  width: firstLine?.width || item.width,
                                  height: firstLine?.height || item.height,
                                  quantity: firstLine?.quantity || item.quantity,
                                  productId: firstLine?.productId || item.productId || null,
                                });
                                navigate('/pricing');
                              }}
                            >
                              复制到报价
                            </Button>
                            <ActionIcon
                              color="red"
                              variant="subtle"
                              onClick={() => modals.openConfirmModal({
                                title: '删除报价记录',
                                centered: true,
                                children: <Text size="sm">删除后无法恢复。</Text>,
                                labels: { confirm: '确认删除', cancel: '取消' },
                                confirmProps: { color: 'red' },
                                onConfirm: () => deleteQuote.mutate(item.id || ''),
                              })}
                            >
                              <IconTrash size={16} />
                            </ActionIcon>
                          </Group>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </ScrollArea>
            </Box>
          </Tabs.Panel>
        </Tabs>
      </Paper>

      <Modal opened={!!selectedQuote} onClose={() => setSelectedQuote(null)} title="报价详情" centered size="lg">
        {selectedQuote ? (
          <Stack gap="md">
            <Group grow>
              <Paper withBorder p="sm" radius={10}>
                <Text size="sm" c="dimmed">报价名称</Text>
                <Text fw={700}>{selectedQuote.name}</Text>
              </Paper>
              <Paper withBorder p="sm" radius={10}>
                <Text size="sm" c="dimmed">组合概览</Text>
                <Text fw={700}>{selectedQuote.productName || '-'}</Text>
              </Paper>
              <Paper withBorder p="sm" radius={10}>
                <Text size="sm" c="dimmed">汇总</Text>
                <Text fw={700}>{selectedQuote.items?.length || 0} 条 / {selectedQuote.area.toFixed(3)}㎡ / {selectedQuote.retailTotal.toFixed(2)}</Text>
              </Paper>
            </Group>

            <Stack gap="sm">
              {(selectedQuote.items || []).map((line: any, lineIndex: number) => (
                <Paper key={line.id || lineIndex} withBorder p="sm" radius={10}>
                  <Stack gap="sm">
                    <Group justify="space-between">
                      <Box>
                        <Text fw={700}>{line.sourceName || line.productName || `组合 ${lineIndex + 1}`}</Text>
                        <Text size="sm" c="dimmed">{line.productName || '-'} / {line.width} × {line.height} / 数量 {line.quantity}</Text>
                      </Box>
                      <Badge variant="light">{line.retailTotal?.toFixed(2)}</Badge>
                    </Group>
                    <Table>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>项目</Table.Th>
                          <Table.Th>分类</Table.Th>
                          <Table.Th>数量</Table.Th>
                          <Table.Th>单位</Table.Th>
                          <Table.Th>成本</Table.Th>
                          <Table.Th>销售</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {(line.details || []).map((detail: any, index: number) => (
                          <Table.Tr key={`${detail.name}-${index}`}>
                            <Table.Td>{detail.name}</Table.Td>
                            <Table.Td>{detail.categoryName || detail.sourceType || '-'}</Table.Td>
                            <Table.Td>{detail.quantity.toFixed(3)}</Table.Td>
                            <Table.Td>{detail.unit}</Table.Td>
                            <Table.Td>{detail.costSubtotal.toFixed(2)}</Table.Td>
                            <Table.Td>{detail.retailSubtotal.toFixed(2)}</Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  </Stack>
                </Paper>
              ))}
            </Stack>
          </Stack>
        ) : null}
      </Modal>
    </PageScaffold>
  );
};

export default RecordsPage;
