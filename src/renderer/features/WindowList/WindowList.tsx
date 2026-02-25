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
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconTrash, IconEdit, IconChevronDown, IconChevronUp, IconFocus } from '@tabler/icons-react';
import { WindowItem } from '../../../shared/schemas';
import { useWindowStore, formatUnit, getUnitSymbol, getAreaSymbol } from '../../stores/windowStore';

interface WindowListProps {
  windows: WindowItem[];
  onDelete: (id: string) => void;
  onEdit: (window: WindowItem) => void;
}

export const WindowList = ({ windows, onDelete, onEdit }: WindowListProps) => {
  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Text weight={700} size="sm" c="dimmed">已解析窗户数量: {windows.length}</Text>
      </Group>

      <ScrollArea h="calc(100vh - 180px)" offsetScrollbars>
        <Stack gap="sm">
          {windows.map((window) => (
            <WindowCard
              key={window.id}
              window={window}
              onDelete={onDelete}
              onEdit={onEdit}
            />
          ))}
          {windows.length === 0 && (
            <Paper p="xl" withBorder radius="sm" style={{ borderStyle: 'dashed' }}>
              <Text c="dimmed" align="center">未解析到任何窗户</Text>
            </Paper>
          )}
        </Stack>
      </ScrollArea>
    </Stack>
  );
};

interface WindowCardProps {
  window: WindowItem;
  onDelete: (id: string) => void;
  onEdit: (window: WindowItem) => void;
}

const WindowCard = ({ window, onDelete, onEdit }: WindowCardProps) => {
  const [opened, { toggle }] = useDisclosure(false);
  const { unit, setActiveWindowId, activeWindowId } = useWindowStore();
  const isActive = activeWindowId === window.id;

  return (
    <Paper
      withBorder
      p="sm"
      radius="sm"
      shadow={isActive ? 'sm' : 'xs'}
      style={{
        transition: 'all 0.2s ease',
        borderColor: isActive ? 'var(--mantine-color-blue-filled)' : undefined,
        cursor: 'pointer',
      }}
      onClick={() => {
        setActiveWindowId(window.id!);
        toggle();
      }}
    >
      <Stack gap="xs">
        <Group justify="space-between" wrap="nowrap">
          <Group gap="xs">
            <Text weight={700} size="sm">{window.name}</Text>
            <Badge size="xs" radius="sm" variant="light">{window.shapeType}</Badge>
          </Group>
          <Group gap={4}>
            <ActionIcon
              variant="subtle"
              color="blue"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(window);
              }}
            >
              <IconEdit size={16} />
            </ActionIcon>
            <ActionIcon
              variant="subtle"
              color="red"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(window.id!);
              }}
            >
              <IconTrash size={16} />
            </ActionIcon>
          </Group>
        </Group>

        <Group justify="space-between" align="flex-end">
          <Stack gap={0}>
            <Text size="xs" c="dimmed">尺寸 ({getUnitSymbol(unit)})</Text>
            <Text size="sm" weight={500}>
              {formatUnit(window.width, unit)} x {formatUnit(window.height, unit)}
            </Text>
          </Stack>
          <Stack gap={0} align="flex-end">
            <Text size="xs" c="dimmed">面积 ({getAreaSymbol(unit)})</Text>
            <Text size="sm" color="blue" weight={700}>
              {formatUnit(window.area, unit)}
            </Text>
          </Stack>
        </Group>

        <Collapse in={opened}>
          <SimpleGrid cols={2} mt="xs">
            <Stack gap={0}>
              <Text size="xs" c="dimmed">周长 ({getUnitSymbol(unit)})</Text>
              <Text size="xs">{formatUnit(window.perimeter, unit)}</Text>
            </Stack>
            <Stack gap={0}>
              <Text size="xs" c="dimmed">顶点数</Text>
              <Text size="xs">{window.points.length}</Text>
            </Stack>
          </SimpleGrid>
          
          <Button
            fullWidth
            mt="sm"
            size="compact-xs"
            leftSection={<IconFocus size={14} />}
            variant="light"
            onClick={(e) => {
              e.stopPropagation();
              setActiveWindowId(window.id!);
              // 调用 Zoom-to-fit
            }}
          >
            定位此窗户
          </Button>
        </Collapse>
      </Stack>
    </Paper>
  );
};
