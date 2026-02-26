import { Paper, Stack, Text, Badge, Group, ActionIcon, Collapse, Divider, Box, Grid, ThemeIcon } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconTrash, IconEdit, IconChevronDown, IconChevronUp, IconFocus, IconDimensions, IconBookmark } from '@tabler/icons-react';
import { useMemo, memo } from 'react';
import { Virtuoso } from 'react-virtuoso';
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
      // 关键改进：优先使用名称作为分组键 (如 C1515)
      const groupKey = win.name || `${Math.round(win.width)}-${Math.round(win.height)}`;
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

  if (windows.length === 0) {
    return <Text c="dimmed" size="xs" ta="center" py="xl">导入解析后自动生成构件列表</Text>;
  }

  return (
    <Box style={{ height: 'calc(100vh - 110px)' }}>
      <Virtuoso
        style={{ height: '100%' }}
        data={groupedWindows}
        itemContent={(index, group) => (
          <Box p="xs" pt={index === 0 ? 'xs' : 0}>
             <WindowGroupCard group={group} onDelete={onDelete} onEdit={onEdit} onFocus={onFocus} />
          </Box>
        )}
      />
    </Box>
  );
};

const DataTag = memo(({ label, value, unit, color = "gray" }: { label: string; value: string | number; unit: string; color?: string }) => (
  <Box>
    <Text size="9px" c="dimmed" tt="uppercase" fw={700} style={{ lineHeight: 1 }}>{label}</Text>
    <Group gap={2} align="baseline">
      <Text size="xs" fw={700} color={`${color}.8`}>{value}</Text>
      <Text size="9px" c="dimmed">{unit}</Text>
    </Group>
  </Box>
));

const WindowGroupCard = memo(({ group, onDelete, onEdit, onFocus }: { group: any, onDelete: any, onEdit: any, onFocus?: any }) => {
  const [opened, { toggle }] = useDisclosure(false);
  const { unit, setActiveWindowId, activeWindowId } = useWindowStore();
  const unitSym = getUnitSymbol(unit);
  const areaSym = getAreaSymbol(unit);

  const isSample = group.items[0]?.category === "参考大样";
  const isSelected = useMemo(() => group.items.some((i:any) => i.id === activeWindowId), [group.items, activeWindowId]);

  return (
    <Paper withBorder radius="sm" shadow="none" style={{ 
      overflow: 'hidden', 
      borderColor: isSelected ? 'var(--mantine-color-blue-6)' : (isSample ? 'var(--mantine-color-orange-3)' : undefined),
      borderWidth: isSample ? 2 : 1
    }}>
      <Box p="sm" style={{ 
        cursor: 'pointer', 
        background: isSelected ? 'var(--mantine-color-blue-0)' : (isSample ? 'var(--mantine-color-orange-0)' : '#fff') 
      }} onClick={toggle}>
        <Stack gap="xs">
          <Group justify="space-between" wrap="nowrap">
            <Group gap={6}>
              <ThemeIcon variant="light" size="sm" color={isSample ? "orange" : "blue"}>
                {isSample ? <IconBookmark size={14} /> : <IconDimensions size={14} />}
              </ThemeIcon>
              <Text size="sm" fw={800} color={isSample ? "orange.9" : "blue.9"} style={{ whiteSpace: 'nowrap' }}>
                {isSample ? '[大样] ' : ''}规格: {formatUnit(group.width, unit)} × {formatUnit(group.height, unit)}
              </Text>
            </Group>
            <Badge size="sm" variant="filled" color={isSample ? "orange" : "blue"} radius="sm">
              {group.items.length}
            </Badge>
          </Group>
          <Grid gutter="xs">
            <Grid.Col span={6}><DataTag label="累计面积" value={formatUnit(group.totalArea, unit)} unit={areaSym} color="blue" /></Grid.Col>
            <Grid.Col span={6}><DataTag label="累计周长" value={formatUnit(group.totalPerimeter, unit)} unit={unitSym} color="blue" /></Grid.Col>
          </Grid>
        </Stack>
      </Box>

      <Collapse in={opened}>
        <Box bg="gray.0" p={4} style={{ borderTop: '1px solid #eee' }}>
          <Stack gap={4}>
            {group.items.map((win: any, idx: number) => (
              <WindowItemCard 
                key={win.id || idx} 
                win={win} 
                idx={idx} 
                unit={unit} 
                unitSym={unitSym} 
                areaSym={areaSym} 
                activeWindowId={activeWindowId}
                setActiveWindowId={setActiveWindowId}
                onFocus={onFocus}
                onEdit={onEdit}
              />
            ))}
          </Stack>
        </Box>
      </Collapse>
    </Paper>
  );
});

const WindowItemCard = memo(({ win, idx, unit, unitSym, areaSym, activeWindowId, setActiveWindowId, onFocus, onEdit }: any) => (
  <Paper 
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
        <Text size="xs" fw={700} truncate>#{idx + 1} {win.name}</Text>
        <Group gap={4}>
          <ActionIcon size="sm" variant="subtle" onClick={(e) => { e.stopPropagation(); onFocus?.(win); }}><IconFocus size={14} /></ActionIcon>
          <ActionIcon size="sm" variant="subtle" color="blue" onClick={(e) => { e.stopPropagation(); onEdit(win); }}><IconEdit size={14} /></ActionIcon>
        </Group>
      </Group>
      <Grid gutter={4}>
        <Grid.Col span={6}><DataTag label="面积" value={formatUnit(win.area, unit)} unit={areaSym} /></Grid.Col>
        <Grid.Col span={6}><DataTag label="周长" value={formatUnit(win.perimeter || 0, unit)} unit={unitSym} /></Grid.Col>
        <Grid.Col span={4}><DataTag label="Handle" value={win.handle || '-'} unit="" /></Grid.Col>
        <Grid.Col span={4}><DataTag label="圆弧占比" value={win.arcRatio ?? 0} unit="%" /></Grid.Col>
        <Grid.Col span={4}><DataTag label="对称率" value={win.symmetryRate ?? 0} unit="%" /></Grid.Col>
      </Grid>
    </Stack>
  </Paper>
));


export default WindowList;
