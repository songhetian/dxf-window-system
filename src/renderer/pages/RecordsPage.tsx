import React, { useState, useMemo } from 'react';
import { Box, Paper, Title, Text, Group, Button, Table, ActionIcon, Stack, TextInput, Badge, ScrollArea } from '@mantine/core';
import { IconSearch, IconDownload, IconTrash } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useDrawings, useDeleteDrawing, useDrawingWindows } from '../hooks/useWindowApi';
import { usePdfExport } from '../hooks/usePdfExport';
import { useWindowStore } from '../stores/windowStore';
import { DrawingItem } from '../../shared/schemas';

import { useDebounce } from '../hooks/useDebounce';

const RecordsPage = () => {
  const { data: drawings = [], isLoading } = useDrawings();
  const deleteDrawingMutation = useDeleteDrawing();
  const { exportPdf, exportExcel } = usePdfExport();
  const { unit } = useWindowStore();
  
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300); // 300ms 防抖
  
  const [selectedDrawingId, setSelectedDrawingId] = useState<string | null>(null);
  const { data: detailWindows = [] } = useDrawingWindows(selectedDrawingId);

  const filteredDrawings = useMemo(() => 
    drawings.filter(d => 
      d.title.toLowerCase().includes(debouncedSearch.toLowerCase()) || 
      d.fileName.toLowerCase().includes(debouncedSearch.toLowerCase())
    ), [drawings, debouncedSearch]);

  const handleExport = (drawing: DrawingItem, type: 'pdf' | 'excel') => {
    if (selectedDrawingId === drawing.id && detailWindows.length > 0) {
      if (type === 'pdf') exportPdf(detailWindows, unit);
      else exportExcel(detailWindows, unit);
    } else {
      setSelectedDrawingId(drawing.id!);
      notifications.show({ 
        title: '数据同步中', 
        message: '正在准备明细数据，请再次点击导出。', 
        color: 'blue' 
      });
    }
  };

  return (
    <Box style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 顶部 Header: 适配 macOS 拖拽 */}
      <Paper 
        h={60} 
        px="md" 
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          borderBottom: '1px solid #E9ECEF',
          background: '#fff',
          WebkitAppRegion: 'drag' as any
        }}
      >
        <Box style={{ width: 80 }} />
        <Title order={5}>图纸记录管理</Title>
      </Paper>

      <Box p="md" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {/* 搜索筛选区域 - 遵循 GEMINI.md 规范 */}
        <Paper p="md" withBorder mb="md" style={{ WebkitAppRegion: 'no-drag' } as any}>
          <Group wrap="nowrap">
            <TextInput
              placeholder="搜索图纸标题或文件名..."
              leftSection={<IconSearch size={16} />}
              value={search}
              onChange={(e) => setSearch(e.currentTarget.value)}
              style={{ flexGrow: 1 }}
            />
            <Group gap="xs" style={{ border: '1px solid #cbd5e1', borderRadius: '4px', height: '44px', padding: '0 12px' }}>
               <Button variant="subtle" size="xs" color="gray">今天</Button>
               <Button variant="subtle" size="xs" color="gray">近7天</Button>
               <Button variant="subtle" size="xs" color="gray">本月</Button>
            </Group>
          </Group>
        </Paper>

        <Paper withBorder style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', background: '#fff' }}>
          <ScrollArea style={{ flex: 1 }}>
            <Table verticalSpacing="sm" highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>图纸标题</Table.Th>
                  <Table.Th>文件名</Table.Th>
                  <Table.Th>数量</Table.Th>
                  <Table.Th>总面积</Table.Th>
                  <Table.Th>保存日期</Table.Th>
                  <Table.Th style={{ textAlign: 'right' }}>操作</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {filteredDrawings.map((drawing) => (
                  <Table.Tr key={drawing.id}>
                    <Table.Td>
                      <Text size="sm" weight={600}>{drawing.title}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs" c="dimmed">{drawing.fileName}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge variant="light">{drawing.windowCount} 樘</Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{(drawing.totalArea / 1000000).toFixed(2)} m²</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs">{new Date(drawing.createdAt!).toLocaleString()}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs" justify="flex-end">
                        <Button 
                          size="compact-xs" 
                          variant="light" 
                          leftSection={<IconDownload size={14} />}
                          onClick={() => handleExport(drawing, 'excel')}
                        >
                          Excel
                        </Button>
                        <Button 
                          size="compact-xs" 
                          variant="light" 
                          color="blue"
                          leftSection={<IconDownload size={14} />}
                          onClick={() => handleExport(drawing, 'pdf')}
                        >
                          PDF
                        </Button>
                        <ActionIcon 
                          variant="subtle" 
                          color="red" 
                          onClick={() => {
                              if(window.confirm('确定要删除这条记录吗？')) {
                                  deleteDrawingMutation.mutate(drawing.id!);
                              }
                          }}
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
            {filteredDrawings.length === 0 && (
              <Box py="xl" style={{ textAlign: 'center' }}>
                <Text c="dimmed" size="sm">暂无匹配的图纸记录</Text>
              </Box>
            )}
          </ScrollArea>
        </Paper>
      </Box>
    </Box>
  );
};

export default RecordsPage;
