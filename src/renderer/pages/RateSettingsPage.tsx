import { ActionIcon, Badge, Button, Group, NumberInput, Paper, Stack, Table, Text, TextInput, Title } from '@mantine/core';
import { IconCheck, IconEdit, IconPlus, IconTrash, IconX } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useState, type ReactNode } from 'react';

import { PageScaffold } from '../components/ui/PageScaffold';
import {
  useCreatePricingRate,
  useDeletePricingRate,
  usePricingRates,
  useUpdatePricingRate,
} from '../hooks/useWindowApi';

const RateSettingsPage = () => {
  const { data: rates = [] } = usePricingRates();
  const createRate = useCreatePricingRate();
  const updateRate = useUpdatePricingRate();
  const deleteRate = useDeletePricingRate();

  const [name, setName] = useState('');
  const [percentage, setPercentage] = useState<number>(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingPercentage, setEditingPercentage] = useState<number>(0);
  const averageRate = rates.length > 0
    ? rates.reduce((sum, item) => sum + Number(item.percentage || 0), 0) / rates.length
    : 0;

  return (
    <PageScaffold
      title="费率设置"
      description="维护安装、运输、管理等附加费率模板，报价中心会直接引用这里。"
    >
      <BoxLayout>
        <Stack gap="sm">
          <div className="app-stat-grid">
            <div className="app-stat-card">
              <div className="app-stat-label">模板数量</div>
              <div className="app-stat-value">{rates.length}</div>
              <div className="app-stat-note">报价页直接复用</div>
            </div>
            <div className="app-stat-card">
              <div className="app-stat-label">平均费率</div>
              <div className="app-stat-value">{averageRate.toFixed(1)}%</div>
              <div className="app-stat-note">便于校准整体加价带</div>
            </div>
            <div className="app-stat-card">
              <div className="app-stat-label">最高费率</div>
              <div className="app-stat-value">{rates.length > 0 ? Math.max(...rates.map((item) => Number(item.percentage || 0))).toFixed(1) : '0.0'}%</div>
              <div className="app-stat-note">观察费率模板的上界水平</div>
            </div>
          </div>
          <Paper withBorder p="md" className="app-surface app-section app-surface-strong">
            <Stack gap="sm">
              <div className="app-section-header">
                <div>
                  <div className="app-section-title">新增费率</div>
                  <div className="app-section-subtitle">安装、运输、管理等附加项统一在这里维护。</div>
                </div>
                <Badge variant="light" color="teal">影响报价页</Badge>
              </div>
              <div className="page-toolbar">
              <TextInput label="费率名称" placeholder="例如：安装费、运输费" value={name} onChange={(event) => setName(event.currentTarget.value)} />
              <NumberInput
                label="百分比"
                value={percentage}
                onChange={(value) => setPercentage(typeof value === 'number' ? value : 0)}
                min={0}
                step={0.5}
                decimalScale={2}
              />
              <Button
                leftSection={<IconPlus size={16} />}
                onClick={async () => {
                  if (!name.trim()) return;
                  await createRate.mutateAsync({ name: name.trim(), percentage, isActive: 1 });
                  notifications.show({ title: '已保存', message: '费率模板已新增', color: 'teal' });
                  setName('');
                  setPercentage(0);
                }}
                loading={createRate.isPending}
              >
                保存费率
              </Button>
              </div>
            </Stack>
          </Paper>
        </Stack>

        <Paper withBorder p="md" className="app-surface app-section app-surface-strong">
          <Stack gap="sm">
            <div className="app-section-header">
              <div>
                <div className="app-section-title">费率模板</div>
                <div className="app-section-subtitle">报价中心会直接读取这些费率模板。</div>
              </div>
              <Text size="sm" c="dimmed">共 {rates.length} 条</Text>
            </div>
            <Table withTableBorder striped highlightOnHover verticalSpacing="sm" horizontalSpacing="sm" className="app-table-shell">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>名称</Table.Th>
                  <Table.Th ta="right">百分比</Table.Th>
                  <Table.Th ta="center" w={120}>操作</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {rates.map((rate) => {
                  const isEditing = editingId === rate.id;
                  return (
                    <Table.Tr key={rate.id}>
                      <Table.Td>
                        {isEditing
                          ? <TextInput size="sm" value={editingName} onChange={(event) => setEditingName(event.currentTarget.value)} />
                          : <Text fw={700} size="sm">{rate.name}</Text>}
                      </Table.Td>
                      <Table.Td ta="right">
                        {isEditing
                          ? (
                            <NumberInput
                              size="sm"
                              value={editingPercentage}
                              onChange={(value) => setEditingPercentage(typeof value === 'number' ? value : 0)}
                              min={0}
                              step={0.5}
                              decimalScale={2}
                            />
                          )
                          : <Text size="sm">{rate.percentage}%</Text>}
                      </Table.Td>
                      <Table.Td ta="center">
                        <Group gap={6} justify="center" wrap="nowrap">
                          {isEditing ? (
                            <>
                              <ActionIcon
                                size="sm"
                                color="teal"
                                onClick={async () => {
                                  await updateRate.mutateAsync({
                                    id: rate.id || '',
                                    data: { name: editingName.trim(), percentage: editingPercentage },
                                  });
                                  setEditingId(null);
                                  notifications.show({ title: '已更新', message: '费率模板已更新', color: 'teal' });
                                }}
                              >
                                <IconCheck size={16} />
                              </ActionIcon>
                              <ActionIcon size="sm" color="gray" onClick={() => setEditingId(null)}>
                                <IconX size={16} />
                              </ActionIcon>
                            </>
                          ) : (
                            <>
                              <ActionIcon
                                size="sm"
                                variant="light"
                                color="blue"
                                onClick={() => {
                                  setEditingId(rate.id || null);
                                  setEditingName(rate.name);
                                  setEditingPercentage(rate.percentage);
                                }}
                              >
                                <IconEdit size={16} />
                              </ActionIcon>
                              <ActionIcon
                                size="sm"
                                variant="light"
                                color="red"
                                onClick={async () => {
                                  await deleteRate.mutateAsync(rate.id || '');
                                  notifications.show({ title: '已删除', message: '费率模板已删除', color: 'teal' });
                                }}
                              >
                                <IconTrash size={16} />
                              </ActionIcon>
                            </>
                          )}
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </Stack>
        </Paper>
      </BoxLayout>
    </PageScaffold>
  );
};

const BoxLayout = ({ children }: { children: ReactNode }) => (
  <div className="app-split-two">
    {children}
  </div>
);

export default RateSettingsPage;
