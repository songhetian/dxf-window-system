import { ActionIcon, Badge, Button, Group, Paper, ScrollArea, Stack, Switch, Table, Text, TextInput } from '@mantine/core';
import { IconCheck, IconCirclePlus, IconEdit, IconTrash, IconX } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { memo, useMemo, useState } from 'react';

import {
  useCreateMaterialPricingMode,
  useDeleteMaterialPricingMode,
  useMaterialPricingModes,
  useUpdateMaterialPricingMode,
} from '../../hooks/useWindowApi';

const PricingModeRow = memo(({
  mode,
  isEditing,
  togglingId,
  effectiveChecked,
  editName,
  editUnitLabel,
  editIncludeInComboTotal,
  onEditNameChange,
  onEditUnitLabelChange,
  onEditIncludeChange,
  onSave,
  onCancel,
  onStartEdit,
  onToggleInclude,
  onDelete,
}: any) => {
  const isBuiltin = ['area', 'perimeter', 'fixed'].includes(mode.id || '');

  return (
    <Table.Tr>
      <Table.Td ta="center">
        {isEditing ? <TextInput size="sm" maw={180} value={editName} onChange={(event) => onEditNameChange(event.currentTarget.value)} /> : <Text size="sm" fw={600}>{mode.name}</Text>}
      </Table.Td>
      <Table.Td ta="center">
        {isEditing ? <TextInput size="sm" maw={140} value={editUnitLabel} onChange={(event) => onEditUnitLabelChange(event.currentTarget.value)} /> : <Text size="sm">{mode.unitLabel}</Text>}
      </Table.Td>
      <Table.Td ta="center">
        {isEditing ? (
          <Group justify="center">
            <Switch
              size="sm"
              checked={editIncludeInComboTotal}
              onChange={(event) => onEditIncludeChange(event.currentTarget.checked)}
              onLabel="是"
              offLabel="否"
            />
          </Group>
        ) : (
          <Group justify="center">
            <Switch
              size="sm"
              checked={effectiveChecked}
              onChange={(event) => onToggleInclude(mode.id || '', event.currentTarget.checked)}
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
              <ActionIcon size="sm" color="teal" onClick={() => onSave(mode.id || '')}>
                <IconCheck size={16} />
              </ActionIcon>
              <ActionIcon size="sm" color="gray" onClick={onCancel}>
                <IconX size={16} />
              </ActionIcon>
            </>
          ) : (
            <>
              <ActionIcon size="sm" variant="light" color="indigo" onClick={() => onStartEdit(mode.id || '', mode.name, mode.unitLabel, mode.includeInComboTotal || 0)}>
                <IconEdit size={16} />
              </ActionIcon>
              <ActionIcon
                size="sm"
                variant="light"
                color="red"
                disabled={isBuiltin}
                onClick={() => onDelete(mode)}
              >
                <IconTrash size={16} />
              </ActionIcon>
            </>
          )}
        </Group>
      </Table.Td>
    </Table.Tr>
  );
});

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
  const [newName, setNewName] = useState('');
  const [newUnitLabel, setNewUnitLabel] = useState('');
  const [newIncludeInComboTotal, setNewIncludeInComboTotal] = useState(false);
  const effectiveToggleMap = useMemo(
    () => pricingModes.reduce<Record<string, boolean>>((acc, mode) => {
      if (mode.id) acc[mode.id] = pendingToggleMap[mode.id] ?? Boolean(mode.includeInComboTotal);
      return acc;
    }, {}),
    [pendingToggleMap, pricingModes],
  );

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

  const handleCreate = async () => {
    if (!newName.trim() || !newUnitLabel.trim()) {
      notifications.show({ title: '添加失败', message: '单位名称和单位都不能为空', color: 'red' });
      return;
    }

    await createPricingMode.mutateAsync({
      name: newName.trim(),
      unitLabel: newUnitLabel.trim(),
      includeInComboTotal: newIncludeInComboTotal ? 1 : 0,
      sortOrder: pricingModes.length,
    });
    setNewName('');
    setNewUnitLabel('');
    setNewIncludeInComboTotal(false);
    notifications.show({ title: '添加成功', message: '新的单位已创建', color: 'teal' });
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
    <Stack gap="sm" h="calc(100vh - 220px)">
      <Paper withBorder radius="md" p="sm" className="app-surface">
        <Group align="flex-end" gap="sm" wrap="wrap">
          <TextInput size="sm" label="单位名称" placeholder="例如：按长度" maw={240} miw={180} style={{ flex: 1 }} value={newName} onChange={(event) => setNewName(event.currentTarget.value)} />
          <TextInput size="sm" label="单位" placeholder="例如：米/m" w={140} value={newUnitLabel} onChange={(event) => setNewUnitLabel(event.currentTarget.value)} />
          <Switch
            size="sm"
            label="计入组合总价"
            checked={newIncludeInComboTotal}
            onChange={(event) => setNewIncludeInComboTotal(event.currentTarget.checked)}
          />
          <Button size="sm" color="teal" leftSection={<IconCirclePlus size={16} />} loading={createPricingMode.isPending} onClick={handleCreate}>
            新增单位
          </Button>
        </Group>
      </Paper>

      <Paper withBorder radius="md" className="app-surface app-section">
        <div className="app-section-header">
          <div>
            <div className="app-section-title">单位列表</div>
            <div className="app-section-subtitle">长表格保持滚动，输入时不再拖着整张表一起卡顿。</div>
          </div>
          <Badge size="sm" variant="light" color="blue">{pricingModes.length} 项</Badge>
        </div>
      <ScrollArea className="app-section-body">
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

              return (
                <PricingModeRow
                  key={mode.id}
                  mode={mode}
                  isEditing={isEditing}
                  togglingId={togglingId}
                  effectiveChecked={mode.id ? effectiveToggleMap[mode.id] ?? Boolean(mode.includeInComboTotal) : Boolean(mode.includeInComboTotal)}
                  editName={editName}
                  editUnitLabel={editUnitLabel}
                  editIncludeInComboTotal={editIncludeInComboTotal}
                  onEditNameChange={setEditName}
                  onEditUnitLabelChange={setEditUnitLabel}
                  onEditIncludeChange={setEditIncludeInComboTotal}
                  onSave={saveEdit}
                  onCancel={() => setEditingId(null)}
                  onStartEdit={startEdit}
                  onToggleInclude={toggleIncludeInComboTotal}
                  onDelete={async (row: any) => {
                    try {
                      await deletePricingMode.mutateAsync(row.id || '');
                      notifications.show({ title: '删除成功', message: '单位已删除', color: 'teal' });
                    } catch (error: any) {
                      notifications.show({ title: '删除失败', message: error.message || '当前单位仍被使用', color: 'red' });
                    }
                  }}
                />
              );
            })}
          </Table.Tbody>
        </Table>
      </ScrollArea>
      </Paper>
    </Stack>
  );
};
