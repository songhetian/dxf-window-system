import { ActionIcon, Badge, Box, Button, Card, Center, Group, Select, SimpleGrid, Stack, Text, ThemeIcon } from '@mantine/core';
import { IconBuilding, IconChevronRight, IconGripVertical, IconSortDescending, IconTrash } from '@tabler/icons-react';

type SheetRateMeta = {
  isOverride: boolean;
  totalPercentage: number;
  sourceLabel: string;
};

type SheetCardItem = {
  id?: string;
  sheetName: string;
  itemCount: number;
  totalArea: number;
  totalCost: number;
  totalRetail: number;
  createdAt?: string;
};

export const QuotationSheetsPanel = ({
  sheets,
  selectedSheetId,
  draggingSheetId,
  sheetSort,
  sheetRateMetaMap,
  onSortChange,
  onSelect,
  onOpenDetail,
  onDelete,
  onDragStart,
  onDragEnd,
  onDrop,
}: {
  sheets: SheetCardItem[];
  selectedSheetId: string | null;
  draggingSheetId: string | null;
  sheetSort: string;
  sheetRateMetaMap: Map<string, SheetRateMeta>;
  onSortChange: (value: 'custom' | 'created_desc' | 'created_asc' | 'name_asc' | 'cost_desc') => void;
  onSelect: (id: string | null) => void;
  onOpenDetail: (id: string | null) => void;
  onDelete: (sheet: SheetCardItem) => void;
  onDragStart: (id: string | null) => void;
  onDragEnd: () => void;
  onDrop: (id: string) => void;
}) => {
  if (sheets.length === 0) {
    return <Center py="xl"><Text c="dimmed">暂无从计算中心保存的工作表</Text></Center>;
  }

  return (
    <Stack gap="sm">
      <Group justify="space-between" align="center">
        <Text size="xs" c="dimmed">这里按工作表管理测算结果，适合逐张核对成本、销售和面积。</Text>
        <Select
          size="xs"
          w={200}
          leftSection={<IconSortDescending size={14} />}
          value={sheetSort}
          onChange={(value) => onSortChange((value as 'custom' | 'created_desc' | 'created_asc' | 'name_asc' | 'cost_desc') || 'custom')}
          data={[
            { value: 'custom', label: '手动拖拽排序' },
            { value: 'created_desc', label: '按时间倒序' },
            { value: 'created_asc', label: '按时间正序' },
            { value: 'name_asc', label: '按名称排序' },
            { value: 'cost_desc', label: '按成本倒序' },
          ]}
        />
      </Group>

      <SimpleGrid cols={{ base: 1, md: 2, xl: 3 }} spacing="sm">
        {sheets.map((sheet, index) => {
          const rateMeta = sheetRateMetaMap.get(sheet.id || '');

          return (
            <Card
              key={sheet.id}
              withBorder
              radius="xl"
              padding="md"
              onClick={() => onSelect(sheet.id || null)}
              draggable
              onDragStart={() => onDragStart(sheet.id || null)}
              onDragEnd={onDragEnd}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => sheet.id && onDrop(sheet.id)}
              style={{
                cursor: 'grab',
                background: selectedSheetId === sheet.id
                  ? 'linear-gradient(180deg, rgba(219,234,254,0.78) 0%, rgba(255,255,255,1) 100%)'
                  : rateMeta?.isOverride
                    ? 'linear-gradient(180deg, rgba(255,237,213,0.72) 0%, rgba(255,255,255,1) 100%)'
                    : (index % 2 === 0 ? 'linear-gradient(180deg, rgba(247,252,249,1) 0%, rgba(255,255,255,1) 100%)' : 'linear-gradient(180deg, rgba(255,255,255,1) 0%, rgba(250,251,252,1) 100%)'),
                borderColor: draggingSheetId === sheet.id
                  ? 'var(--mantine-color-teal-5)'
                  : selectedSheetId === sheet.id
                    ? 'rgba(59, 130, 246, 0.35)'
                    : (rateMeta?.isOverride ? 'rgba(249, 115, 22, 0.28)' : 'rgba(15, 118, 110, 0.12)'),
                boxShadow: draggingSheetId === sheet.id ? '0 14px 32px rgba(13, 148, 136, 0.16)' : '0 10px 24px rgba(15, 23, 42, 0.05)',
                opacity: draggingSheetId === sheet.id ? 0.72 : 1,
              }}
            >
              <Group justify="space-between" align="flex-start" mb="sm">
                <Box style={{ flex: 1, minWidth: 0 }}>
                  <Group gap={8} wrap="nowrap" mb={4}>
                    <ThemeIcon variant="subtle" color="gray" radius="md">
                      <IconGripVertical size={15} />
                    </ThemeIcon>
                    <Text fw={800} size="sm" truncate>{sheet.sheetName}</Text>
                  </Group>
                  <Group gap={6} wrap="wrap">
                    {rateMeta?.isOverride ? (
                      <Badge size="xs" variant="light" color="orange">单独费率</Badge>
                    ) : (
                      <Badge size="xs" variant="light" color="gray">沿用整体费率</Badge>
                    )}
                    <Badge size="xs" variant="dot" color={rateMeta?.isOverride ? 'orange' : 'teal'}>
                      {Number(rateMeta?.totalPercentage || 0).toFixed(2)}%
                    </Badge>
                  </Group>
                  <Text size="xs" c="dimmed" mt={4}>保存于 {new Date(sheet.createdAt || Date.now()).toLocaleDateString()}</Text>
                </Box>
                <Group gap={6}>
                  <ThemeIcon variant="light" color="teal" radius="md">
                    <IconBuilding size={16} />
                  </ThemeIcon>
                  <ActionIcon color="red" variant="subtle" onClick={() => onDelete(sheet)}>
                    <IconTrash size={16} />
                  </ActionIcon>
                </Group>
              </Group>

              <SimpleGrid cols={2} spacing={8} mb="sm">
                <Box>
                  <Text size="xs" c="dimmed">窗型项</Text>
                  <Text fw={700}>{sheet.itemCount} 项</Text>
                </Box>
                <Box>
                  <Text size="xs" c="dimmed">总面积</Text>
                  <Text fw={700}>{sheet.totalArea.toFixed(2)} ㎡</Text>
                </Box>
                <Box>
                  <Text size="xs" c="dimmed">总成本</Text>
                  <Text fw={700} c="teal">¥{sheet.totalCost.toFixed(0)}</Text>
                </Box>
                <Box>
                  <Text size="xs" c="dimmed">总销售</Text>
                  <Text fw={700} c="blue">¥{sheet.totalRetail.toFixed(0)}</Text>
                </Box>
                <Box>
                  <Text size="xs" c="dimmed">成本单方</Text>
                  <Text fw={700}>¥{(Number(sheet.totalCost || 0) / Math.max(Number(sheet.totalArea || 0), 1)).toFixed(0)}/㎡</Text>
                </Box>
                <Box>
                  <Text size="xs" c="dimmed">费率状态</Text>
                  <Text fw={700} c={rateMeta?.isOverride ? 'orange.7' : 'gray.7'}>
                    {rateMeta?.sourceLabel}
                  </Text>
                </Box>
              </SimpleGrid>

              <Button
                variant="light"
                color="teal"
                fullWidth
                rightSection={<IconChevronRight size={14} />}
                onClick={(event) => {
                  event.stopPropagation();
                  onOpenDetail(sheet.id || null);
                }}
              >
                查看详情
              </Button>
            </Card>
          );
        })}
      </SimpleGrid>
    </Stack>
  );
};
