import { Card, Group, SimpleGrid, Text } from '@mantine/core';
import {
  IconLayoutGrid,
  IconReportMoney,
  IconRuler2,
  IconStack2,
  IconTrendingUp,
} from '@tabler/icons-react';

export const QuotationStatsCards = ({
  stats,
}: {
  stats: {
    sheetCount: number;
    itemCount: number;
    totalArea: number;
    totalCost: number;
    totalRetail: number;
  } | null;
}) => {
  if (!stats) return null;

  return (
    <SimpleGrid cols={{ base: 2, md: 5 }} spacing="sm" mb="md">
      <Card withBorder radius="lg" padding="md">
        <Group justify="space-between" mb={6}>
          <Text size="xs" c="dimmed">计算工作表</Text>
          <IconLayoutGrid size={16} color="var(--primary)" />
        </Group>
        <Text fw={800} size="xl">{stats.sheetCount}</Text>
        <Text size="xs" c="dimmed">已归档工作表数量</Text>
      </Card>
      <Card withBorder radius="lg" padding="md">
        <Group justify="space-between" mb={6}>
          <Text size="xs" c="dimmed">窗型项</Text>
          <IconStack2 size={16} color="var(--primary)" />
        </Group>
        <Text fw={800} size="xl">{stats.itemCount}</Text>
        <Text size="xs" c="dimmed">来自计算中心的窗型项</Text>
      </Card>
      <Card withBorder radius="lg" padding="md">
        <Group justify="space-between" mb={6}>
          <Text size="xs" c="dimmed">总面积</Text>
          <IconRuler2 size={16} color="var(--primary)" />
        </Group>
        <Text fw={800} size="xl">{stats.totalArea.toFixed(2)}</Text>
        <Text size="xs" c="dimmed">㎡</Text>
      </Card>
      <Card withBorder radius="lg" padding="md">
        <Group justify="space-between" mb={6}>
          <Text size="xs" c="dimmed">总成本</Text>
          <IconReportMoney size={16} color="var(--primary)" />
        </Group>
        <Text fw={800} size="xl">¥{stats.totalCost.toFixed(0)}</Text>
        <Text size="xs" c="dimmed">来自已保存工作表</Text>
      </Card>
      <Card withBorder radius="lg" padding="md">
        <Group justify="space-between" mb={6}>
          <Text size="xs" c="dimmed">测算销售</Text>
          <IconTrendingUp size={16} color="#2563eb" />
        </Group>
        <Text fw={800} size="xl" c="blue.7">¥{stats.totalRetail.toFixed(0)}</Text>
        <Text size="xs" c="dimmed">计算中心建议销售</Text>
      </Card>
    </SimpleGrid>
  );
};
