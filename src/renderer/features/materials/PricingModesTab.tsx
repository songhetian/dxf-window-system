import { ActionIcon, Badge, Button, Group, Paper, Table, Text, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconCheck, IconCirclePlus, IconEdit, IconTrash, IconX } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useState } from 'react';

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
  const [editName, setEditName] = useState('');
  const [editUnitLabel, setEditUnitLabel] = useState('');

  const createForm = useForm({
    initialValues: {
      name: '',
      unitLabel: '',
    },
    validate: {
      name: (value) => (value.trim() ? null : '请输入单位名称'),
      unitLabel: (value) => (value.trim() ? null : '请输入单位'),
    },
  });

  const startEdit = (id: string, name: string, unitLabel: string) => {
    setEditingId(id);
    setEditName(name);
    setEditUnitLabel(unitLabel);
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
      },
    });
    setEditingId(null);
    notifications.show({ title: '更新成功', message: '单位已更新', color: 'teal' });
  };

  return (
    <Paper withBorder radius="md" p="md">
      <form
        onSubmit={createForm.onSubmit(async (values) => {
          await createPricingMode.mutateAsync({
            name: values.name.trim(),
            unitLabel: values.unitLabel.trim(),
            sortOrder: pricingModes.length,
          });
          createForm.reset();
          notifications.show({ title: '添加成功', message: '新的单位已创建', color: 'teal' });
        })}
      >
        <Group align="flex-end" mb="md">
          <TextInput label="单位名称" placeholder="例如：按长度" style={{ flex: 1 }} {...createForm.getInputProps('name')} />
          <TextInput label="单位" placeholder="例如：米/m" w={140} {...createForm.getInputProps('unitLabel')} />
          <Button type="submit" color="teal" leftSection={<IconCirclePlus size={18} />} loading={createPricingMode.isPending}>
            新增单位
          </Button>
        </Group>
      </form>

      <Table withTableBorder striped highlightOnHover verticalSpacing="sm" horizontalSpacing="md">
        <Table.Thead bg="gray.0">
          <Table.Tr>
            <Table.Th ta="center">单位名称</Table.Th>
            <Table.Th ta="center">单位</Table.Th>
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
                  {isEditing ? <TextInput value={editName} onChange={(event) => setEditName(event.currentTarget.value)} /> : <Text fw={600}>{mode.name}</Text>}
                </Table.Td>
                <Table.Td ta="center">
                  {isEditing ? <TextInput value={editUnitLabel} onChange={(event) => setEditUnitLabel(event.currentTarget.value)} /> : <Text>{mode.unitLabel}</Text>}
                </Table.Td>
                <Table.Td ta="center">
                  <Badge variant="light" color={isBuiltin ? 'blue' : 'gray'}>
                    {isBuiltin ? '系统默认' : '自定义'}
                  </Badge>
                </Table.Td>
                <Table.Td ta="center">
                  <Group gap="xs" justify="center">
                    {isEditing ? (
                      <>
                        <ActionIcon color="teal" onClick={() => saveEdit(mode.id || '')}>
                          <IconCheck size={16} />
                        </ActionIcon>
                        <ActionIcon color="gray" onClick={() => setEditingId(null)}>
                          <IconX size={16} />
                        </ActionIcon>
                      </>
                    ) : (
                      <>
                        <ActionIcon variant="light" color="indigo" onClick={() => startEdit(mode.id || '', mode.name, mode.unitLabel)}>
                          <IconEdit size={16} />
                        </ActionIcon>
                        <ActionIcon
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
    </Paper>
  );
};
