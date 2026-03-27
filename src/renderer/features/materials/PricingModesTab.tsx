import { ActionIcon, Badge, Button, Group, Paper, ScrollArea, Switch, Table, Text, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconCheck, IconCirclePlus, IconEdit, IconTrash, IconX } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useMemo, useState } from 'react';

import {
  useCreateMaterialPricingMode,
  useDeleteMaterialPricingMode,
  useMaterialPricingModes,
  useUpdateMaterialPricingMode,
} from '../../hooks/useWindowApi';

export const PricingModesTab = () => {
  const { data: pricingModes = [] } = useMaterialPricingModes();
  const createPricingMode = useCreateMaterialPricingMode();
  const updatePricingMode = useUpdateMaterialPricingMode();
  const deletePricingMode = useDeleteMaterialPricingMode();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [pendingToggleMap, setPendingToggleMap] = useState<Record<string, boolean>>({});
  const [editName, setEditName] = useState('');
  const [editUnitLabel, setEditUnitLabel] = useState('');
  const [editIncludeInComboTotal, setEditIncludeInComboTotal] = useState(false);
  const effectiveToggleMap = useMemo(
    () => pricingModes.reduce<Record<string, boolean>>((acc, mode) => {
      if (mode.id) acc[mode.id] = pendingToggleMap[mode.id] ?? Boolean(mode.includeInComboTotal);
      return acc;
    }, {}),
    [pendingToggleMap, pricingModes],
  );

  const createForm = useForm({
    initialValues: {
      name: '',
      unitLabel: '',
      includeInComboTotal: false,
    },
    validate: {
      name: (value) => (value.trim() ? null : '请输入单位名称'),
      unitLabel: (value) => (value.trim() ? null : '请输入单位'),
    },
  });

  const startEdit = (id: string, name: string, unitLabel: string, includeInComboTotal: number) => {
    setEditingId(id);
    setEditName(name);
    setEditUnitLabel(unitLabel);
    setEditIncludeInComboTotal(Boolean(includeInComboTotal));
  };

  const saveEdit = async (id: string) => {
    if (!editName.trim() || !editUnitLabel.trim()) {
      notifications.show({ title: '保存失败', message: '单位名称和单位都不能为空', color: 'red' });
      return;
    }

    await updatePricingMode.mutateAsync({
      id,
      data: {
        name: editName.trim(),
        unitLabel: editUnitLabel.trim(),
        includeInComboTotal: editIncludeInComboTotal ? 1 : 0,
      },
    });
    setEditingId(null);
    notifications.show({ title: '更新成功', message: '单位已更新', color: 'teal' });
  };

  const toggleIncludeInComboTotal = async (id: string, checked: boolean) => {
    const current = pricingModes.find((mode) => mode.id === id);
    if (!current) return;
    setPendingToggleMap((map) => ({ ...map, [id]: checked }));
    setTogglingId(id);
    try {
      await updatePricingMode.mutateAsync({
        id,
        data: {
          includeInComboTotal: checked ? 1 : 0,
        },
      });
      notifications.show({
        title: '已更新',
        message: checked ? '该单位将计入组合总价' : '该单位已从组合总价中排除',
        color: 'teal',
      });
      setPendingToggleMap((map) => {
        const next = { ...map };
        delete next[id];
        return next;
      });
    } catch (error) {
      setPendingToggleMap((map) => {
        const next = { ...map };
        delete next[id];
        return next;
      });
      throw error;
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <Paper withBorder radius="md" p="sm">
      <form
        onSubmit={createForm.onSubmit(async (values) => {
          await createPricingMode.mutateAsync({
            name: values.name.trim(),
            unitLabel: values.unitLabel.trim(),
            includeInComboTotal: values.includeInComboTotal ? 1 : 0,
            sortOrder: pricingModes.length,
          });
          createForm.reset();
          notifications.show({ title: '添加成功', message: '新的单位已创建', color: 'teal' });
        })}
      >
        <Group align="flex-end" mb="sm" gap="sm" wrap="nowrap">
          <TextInput size="sm" label="单位名称" placeholder="例如：按长度" style={{ flex: 1 }} {...createForm.getInputProps('name')} />
          <TextInput size="sm" label="单位" placeholder="例如：米/m" w={180} {...createForm.getInputProps('unitLabel')} />
          <Switch
            size="sm"
            label="计入组合总价"
            checked={createForm.values.includeInComboTotal}
            onChange={(event) => createForm.setFieldValue('includeInComboTotal', event.currentTarget.checked)}
          />
          <Button size="sm" type="submit" color="teal" leftSection={<IconCirclePlus size={16} />} loading={createPricingMode.isPending}>
            新增单位
          </Button>
        </Group>
      </form>

      <ScrollArea h="calc(100vh - 250px)">
        <Table withTableBorder striped highlightOnHover verticalSpacing="sm" horizontalSpacing="sm" stickyHeader>
          <Table.Thead bg="gray.0">
            <Table.Tr>
              <Table.Th ta="center">单位名称</Table.Th>
              <Table.Th ta="center">单位</Table.Th>
              <Table.Th ta="center">组合总价</Table.Th>
              <Table.Th ta="center">类型</Table.Th>
              <Table.Th ta="center">操作</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {pricingModes.map((mode) => {
              const isEditing = editingId === mode.id;
              const isBuiltin = ['area', 'perimeter', 'fixed'].includes(mode.id || '');

              return (
                <Table.Tr key={mode.id}>
                  <Table.Td ta="center">
                    {isEditing ? <TextInput size="sm" value={editName} onChange={(event) => setEditName(event.currentTarget.value)} /> : <Text size="sm" fw={600}>{mode.name}</Text>}
                  </Table.Td>
                  <Table.Td ta="center">
                    {isEditing ? <TextInput size="sm" value={editUnitLabel} onChange={(event) => setEditUnitLabel(event.currentTarget.value)} /> : <Text size="sm">{mode.unitLabel}</Text>}
                  </Table.Td>
                  <Table.Td ta="center">
                    {isEditing ? (
                      <Group justify="center">
                        <Switch
                          size="sm"
                          checked={editIncludeInComboTotal}
                          onChange={(event) => setEditIncludeInComboTotal(event.currentTarget.checked)}
                          onLabel="是"
                          offLabel="否"
                        />
                      </Group>
                    ) : (
                      <Group justify="center">
                        <Switch
                          size="sm"
                          checked={mode.id ? effectiveToggleMap[mode.id] ?? Boolean(mode.includeInComboTotal) : Boolean(mode.includeInComboTotal)}
                          onChange={(event) => toggleIncludeInComboTotal(mode.id || '', event.currentTarget.checked)}
                          onLabel="是"
                          offLabel="否"
                          disabled={!mode.id || togglingId === mode.id}
                        />
                      </Group>
                    )}
                  </Table.Td>
                  <Table.Td ta="center">
                    <Group justify="center">
                      <Badge size="sm" variant="light" color={isBuiltin ? 'blue' : 'gray'}>
                        {isBuiltin ? '系统默认' : '自定义'}
                      </Badge>
                    </Group>
                  </Table.Td>
                  <Table.Td ta="center">
                    <Group gap={6} justify="center" wrap="nowrap">
                      {isEditing ? (
                        <>
                          <ActionIcon size="sm" color="teal" onClick={() => saveEdit(mode.id || '')}>
                            <IconCheck size={16} />
                          </ActionIcon>
                          <ActionIcon size="sm" color="gray" onClick={() => setEditingId(null)}>
                            <IconX size={16} />
                          </ActionIcon>
                        </>
                      ) : (
                        <>
                          <ActionIcon size="sm" variant="light" color="indigo" onClick={() => startEdit(mode.id || '', mode.name, mode.unitLabel, mode.includeInComboTotal || 0)}>
                            <IconEdit size={16} />
                          </ActionIcon>
                          <ActionIcon
                            size="sm"
                            variant="light"
                            color="red"
                            disabled={isBuiltin}
                            onClick={async () => {
                              try {
                                await deletePricingMode.mutateAsync(mode.id || '');
                                notifications.show({ title: '删除成功', message: '单位已删除', color: 'teal' });
                              } catch (error: any) {
                                notifications.show({ title: '删除失败', message: error.message || '当前单位仍被使用', color: 'red' });
                              }
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
      </ScrollArea>
    </Paper>
  );
};
