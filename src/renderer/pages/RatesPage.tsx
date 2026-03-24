import React, { useState } from 'react';
import { ActionIcon, Box, Button, NumberInput, Paper, SimpleGrid, Stack, Text, TextInput, Title } from '@mantine/core';
import { IconPercentage, IconPlus, IconTrash } from '@tabler/icons-react';

import { PageScaffold } from '../components/ui/PageScaffold';
import { useCreatePricingRate, useDeletePricingRate, usePricingRates } from '../hooks/useWindowApi';

export default function RatesPage() {
  const { data: rates = [] } = usePricingRates();
  const createRate = useCreatePricingRate();
  const deleteRate = useDeletePricingRate();

  const [name, setName] = useState('');
  const [percentage, setPercentage] = useState(0);

  return (
    <PageScaffold
      title="费率设置"
      description="费率单独管理，在报价中心选择使用。适合维护安装费、运输费、损耗费等常用项目。"
    >
      <Box h="100%" style={{ display: 'grid', gridTemplateColumns: '360px minmax(0, 1fr)', gap: 12 }}>
        <Paper withBorder radius={12} p="lg">
          <Stack>
            <Title order={4}>新增费率</Title>
            <Text size="sm" c="dimmed">
              新增后，报价中心会直接可选。
            </Text>
            <TextInput label="费率名称" value={name} onChange={(event) => setName(event.currentTarget.value)} placeholder="例如：安装费、运输费" />
            <NumberInput label="百分比 (%)" value={percentage} onChange={(value) => setPercentage(Number(value) || 0)} min={0} />
            <Button
              leftSection={<IconPlus size={16} />}
              onClick={async () => {
                if (!name.trim()) return;
                await createRate.mutateAsync({ name: name.trim(), percentage, isActive: 1 });
                setName('');
                setPercentage(0);
              }}
            >
              保存费率
            </Button>
          </Stack>
        </Paper>

        <Paper withBorder radius={12} p="lg" style={{ minHeight: 0 }}>
          <Stack gap="md">
            <Title order={4}>费率卡片</Title>
            <SimpleGrid cols={{ base: 1, md: 2, xl: 3 }} spacing="md">
              {rates.map((rate) => (
                <Paper key={rate.id} withBorder radius={12} p="md" bg="var(--bg-subtle)">
                  <Stack gap="sm">
                    <Box>
                      <Text fw={800}>{rate.name}</Text>
                      <Text size="sm" c="dimmed" mt={4}>
                        最近维护 {rate.createdAt ? new Date(rate.createdAt).toLocaleDateString() : '-'}
                      </Text>
                    </Box>
                    <Box>
                      <Text size="xs" c="dimmed">费率值</Text>
                      <Title order={3}>{rate.percentage}%</Title>
                    </Box>
                    <ActionIcon color="red" variant="subtle" onClick={() => deleteRate.mutate(rate.id || '')}>
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Stack>
                </Paper>
              ))}
            </SimpleGrid>
            {rates.length === 0 ? (
              <Paper withBorder radius={12} p="xl" ta="center" bg="var(--bg-subtle)">
                <IconPercentage size={28} />
                <Text mt="sm">还没有费率，先在左侧新增一条。</Text>
              </Paper>
            ) : null}
          </Stack>
        </Paper>
      </Box>
    </PageScaffold>
  );
}
