import { Paper, Stack, Text, Badge, Group, ActionIcon, Collapse, Divider, ScrollArea, Box, Grid, ThemeIcon } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconTrash, IconEdit, IconChevronDown, IconChevronUp, IconFocus, IconDimensions, IconRuler, IconSum } from '@tabler/icons-react';
import { useMemo } from 'react';
import { WindowItem } from '../../../shared/schemas';
import { useWindowStore, formatUnit, getUnitSymbol, getAreaSymbol } from '../../stores/windowStore';

interface WindowListProps {
  windows: WindowItem[];
  onDelete: (id: string) => void;
  onEdit: (window: WindowItem) => void;
  onFocus?: (window: WindowItem) => void;
}

export const WindowList = ({ windows, onDelete, onEdit, onFocus }: WindowListProps) => {
  const groupedWindows = useMemo(() => {
    const groups: Record<string, { key: string; items: WindowItem[]; width: number; height: number; shapeType: string; totalArea: number; totalPerimeter: number }> = {};
    windows.forEach((win) => {
      const groupKey = `${Math.round(win.width)}-${Math.round(win.height)}-${win.shapeType}`;
      if (!groups[groupKey]) {
        groups[groupKey] = { 
          key: groupKey, items: [], width: win.width, height: win.height, 
          shapeType: win.shapeType, totalArea: 0, totalPerimeter: 0 
        };
      }
      groups[groupKey].items.push(win);
      groups[groupKey].totalArea += win.area;
      groups[groupKey].totalPerimeter += win.perimeter || 0;
    });
    return Object.values(groups).sort((a, b) => b.items.length - a.items.length);
  }, [windows]);

  return (
    <ScrollArea h="calc(100vh - 110px)" offsetScrollbars scrollbarSize={4}>
      <Stack gap="sm" p="xs">
        {groupedWindows.map((group) => (
          <WindowGroupCard key={group.key} group={group} onDelete={onDelete} onEdit={onEdit} onFocus={onFocus} />
        ))}
        {windows.length === 0 && <Text c="dimmed" size="xs" ta="center" py="xl">导入解析后自动生成构件列表</Text>}
      </Stack>
    </ScrollArea>
  );
};

const DataTag = ({ label, value, unit, color = "gray" }: { label: string; value: string | number; unit: string; color?: string }) => (
  <Box>
    <Text size="9px" c="dimmed" tt="uppercase" fw={700} style={{ lineHeight: 1 }}>{label}</Text>
    <Group gap={2} align="baseline">
      <Text size="xs" fw={700} color={`${color}.8`}>{value}</Text>
      <Text size="9px" c="dimmed">{unit}</Text>
    </Group>
  </Box>
);

const WindowGroupCard = ({ group, onDelete, onEdit, onFocus }: { group: any, onDelete: any, onEdit: any, onFocus?: any }) => {
  const [opened, { toggle }] = useDisclosure(false);
  const { unit, setActiveWindowId, activeWindowId } = useWindowStore();
  const unitSym = getUnitSymbol(unit);
  const areaSym = getAreaSymbol(unit);

  const isSelected = useMemo(() => group.items.some((i:any) => i.id === activeWindowId), [group.items, activeWindowId]);

  return (
    <Paper withBorder radius="sm" shadow="xs" style={{ overflow: 'hidden', borderColor: isSelected ? 'var(--mantine-color-blue-6)' : undefined }}>
      {/* 汇总层：显示该规格的总览 */}
      <Box p="sm" style={{ cursor: 'pointer', background: isSelected ? 'var(--mantine-color-blue-0)' : '#fff' }} onClick={toggle}>
        <Stack gap="xs">
          <Group justify="space-between" wrap="nowrap">
            <Group gap={6}>
              <ThemeIcon variant="light" size="sm" color="blue"><IconDimensions size={14} /></ThemeIcon>
              <Text size="sm" fw={800} color="blue.9">
                规格: {formatUnit(group.width, unit)} × {formatUnit(group.height, unit)} {unitSym}
              </Text>
            </Group>
            <Badge size="md" variant="filled" color="blue" radius="sm">
              {group.items.length} 樘
            </Badge>
          </Group>
          
          <Divider variant="dotted" label={<Text size="9px" c="dimmed" fw={700}>该规格汇总</Text>} labelPosition="left" />
          
          <Grid gutter="xs">
            <Grid.Col span={6}><DataTag label="累计面积" value={formatUnit(group.totalArea, unit)} unit={areaSym} color="blue" /></Grid.Col>
            <Grid.Col span={6}><DataTag label="累计周长" value={formatUnit(group.totalPerimeter, unit)} unit={unitSym} color="blue" /></Grid.Col>
          </Grid>
        </Stack>
      </Box>

      <Collapse in={opened}>
        <Box bg="gray.0" p={4}>
          <Stack gap={4}>
            {group.items.map((win: WindowItem, idx: number) => (
              <Paper 
                key={win.id || idx} 
                p="xs" 
                withBorder
                radius="xs"
                style={{ 
                  background: activeWindowId === win.id ? 'var(--mantine-color-blue-1)' : '#fff',
                  borderColor: activeWindowId === win.id ? 'var(--mantine-color-blue-3)' : '#eee',
                  cursor: 'pointer'
                }}
                onClick={(e) => { e.stopPropagation(); setActiveWindowId(win.id || ''); onFocus?.(win); }}
              >
                <Stack gap={6}>
                  <Group justify="space-between" wrap="nowrap">
                    <Text size="xs" fw={700}>#{idx + 1} {win.name}</Text>
                    <Group gap={4}>
                      <ActionIcon size="sm" variant="subtle" onClick={(e) => { e.stopPropagation(); onFocus?.(win); }}><IconFocus size={14} /></ActionIcon>
                      <ActionIcon size="sm" variant="subtle" color="blue" onClick={(e) => { e.stopPropagation(); onEdit(win); }}><IconEdit size={14} /></ActionIcon>
                    </Group>
                  </Group>
                  {/* 单体详细参数 */}
                  <Grid gutter={4}>
                    <Grid.Col span={6}><DataTag label="单体面积" value={formatUnit(win.area, unit)} unit={areaSym} /></Grid.Col>
                    <Grid.Col span={6}><DataTag label="单体周长" value={formatUnit(win.perimeter || 0, unit)} unit={unitSym} /></Grid.Col>
                  </Grid>
                </Stack>
              </Paper>
            ))}
          </Stack>
        </Box>
      </Collapse>
    </Paper>
  );
};

export default WindowList;
