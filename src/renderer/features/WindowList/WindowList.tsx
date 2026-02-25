import {
  Paper,
  Stack,
  Text,
  Badge,
  Group,
  ActionIcon,
  Collapse,
  Button,
  SimpleGrid,
  ScrollArea,
  Divider,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconTrash, IconEdit, IconChevronDown, IconChevronUp, IconFocus, IconLayersSubtract } from '@tabler/icons-react';
import { useMemo } from 'react';
import { WindowItem } from '../../../shared/schemas';
import { useWindowStore, formatUnit, getUnitSymbol, getAreaSymbol } from '../../stores/windowStore';

interface WindowListProps {
  windows: WindowItem[];
  onDelete: (id: string) => void;
  onEdit: (window: WindowItem) => void;
}

/**
 * 工业级窗户列表：支持自动归类 (同尺寸/形状聚合)
 * 提升解析后的查看效率
 */
export const WindowList = ({ windows, onDelete, onEdit }: WindowListProps) => {
  // 核心逻辑：根据 宽度、高度、形状类型 自动分组
  const groupedWindows = useMemo(() => {
    const groups: Record<string, { key: string; items: WindowItem[]; width: number; height: number; shapeType: string }> = {};
    
    windows.forEach((win) => {
      // 这里的 Key 使用原始 mm 精度，避免单位转换导致的细微偏差影响分组
      const groupKey = `${Math.round(win.width)}-${Math.round(win.height)}-${win.shapeType}`;
      if (!groups[groupKey]) {
        groups[groupKey] = {
          key: groupKey,
          items: [],
          width: win.width,
          height: win.height,
          shapeType: win.shapeType,
        };
      }
      groups[groupKey].items.push(win);
    });

    return Object.values(groups).sort((a, b) => b.items.length - a.items.length); // 数量多的排前面
  }, [windows]);

  return (
    <Stack gap="md">
      <Group justify="space-between" px="xs">
        <Stack gap={0}>
          <Text weight={700} size="sm">窗户总数: {windows.length}</Text>
          <Text size="xs" c="dimmed">已归类为 {groupedWindows.length} 种规格</Text>
        </Stack>
      </Group>

      <ScrollArea h="calc(100vh - 180px)" offsetScrollbars>
        <Stack gap="sm">
          {groupedWindows.map((group) => (
            <WindowGroupCard
              key={group.key}
              group={group}
              onDelete={onDelete}
              onEdit={onEdit}
            />
          ))}
          {windows.length === 0 && (
            <Paper p="xl" withBorder radius="sm" style={{ borderStyle: 'dashed', background: 'transparent' }}>
              <Stack align="center" gap="xs">
                <Text c="dimmed" size="sm" align="center">尚未解析到任何有效窗户</Text>
                <Text size="xs" c="dimmed" align="center">确保图纸中存在闭合的 LWPOLYLINE 图形</Text>
              </Stack>
            </Paper>
          )}
        </Stack>
      </ScrollArea>
    </Stack>
  );
};

interface WindowGroupCardProps {
  group: { key: string; items: WindowItem[]; width: number; height: number; shapeType: string };
  onDelete: (id: string) => void;
  onEdit: (window: WindowItem) => void;
}

const WindowGroupCard = ({ group, onDelete, onEdit }: WindowGroupCardProps) => {
  const [opened, { toggle }] = useDisclosure(false);
  const { unit, setActiveWindowId, activeWindowId } = useWindowStore();
  
  // 检查当前组内是否有选中的项
  const hasActiveItem = useMemo(() => 
    group.items.some(item => item.id === activeWindowId),
  [group.items, activeWindowId]);

  return (
    <Paper
      withBorder
      radius="sm"
      shadow={hasActiveItem ? 'sm' : 'xs'}
      style={{
        transition: 'all 0.2s ease',
        borderColor: hasActiveItem ? 'var(--mantine-color-blue-filled)' : undefined,
      }}
    >
      <Stack gap={0}>
        {/* 分组头部：展示规格与数量 */}
        <Group p="sm" justify="space-between" wrap="nowrap" onClick={toggle} style={{ cursor: 'pointer' }}>
          <Stack gap={2}>
            <Group gap="xs">
              <Text weight={700} size="sm">
                {formatUnit(group.width, unit)} × {formatUnit(group.height, unit)}
              </Text>
              <Badge size="xs" radius="sm" variant="light">{group.shapeType}</Badge>
            </Group>
            <Text size="xs" c="dimmed">{getUnitSymbol(unit)}</Text>
          </Stack>
          
          <Group gap="xs">
            <Badge color="blue" radius="xl" size="lg" variant="filled">
              {group.items.length} 樘
            </Badge>
            {opened ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
          </Group>
        </Group>

        <Collapse in={opened}>
          <Divider variant="dashed" />
          <Stack gap={0} p="xs">
            {group.items.map((window, index) => (
              <Paper 
                key={window.id} 
                p="xs" 
                radius="xs"
                style={{ 
                  backgroundColor: activeWindowId === window.id ? 'var(--mantine-color-blue-light)' : 'transparent',
                  cursor: 'pointer',
                  borderBottom: '1px solid #F1F3F5'
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveWindowId(window.id!);
                }}
              >
                <Group justify="space-between" wrap="nowrap">
                  <Stack gap={2}>
                    <Text size="xs" weight={700}>#{index + 1} {window.name}</Text>
                    <Group gap="xs">
                      <Text size="10px" c="dimmed">面: {formatUnit(window.area, unit)} {getAreaSymbol(unit)}</Text>
                      <Text size="10px" c="dimmed">玻: {formatUnit(window.glassArea || 0, unit)} {getAreaSymbol(unit)}</Text>
                      <Text size="10px" c="blue">重: {(window.frameWeight || 0).toFixed(2)} kg</Text>
                    </Group>
                  </Stack>
                  <Group gap={4}>
                    <ActionIcon size="sm" variant="subtle" onClick={(e) => {
                      e.stopPropagation();
                      setActiveWindowId(window.id!);
                    }}>
                      <IconFocus size={14} />
                    </ActionIcon>
                    <ActionIcon size="sm" variant="subtle" color="blue" onClick={(e) => {
                      e.stopPropagation();
                      onEdit(window);
                    }}>
                      <IconEdit size={14} />
                    </ActionIcon>
                  </Group>
                </Group>
              </Paper>
            ))}
          </Stack>
        </Collapse>
      </Stack>
    </Paper>
  );
};

// 辅助组件：Tooltip
import { Tooltip } from '@mantine/core';
