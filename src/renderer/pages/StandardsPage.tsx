import React, { useState } from 'react';
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Group,
  Paper,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';

import { PageScaffold } from '../components/ui/PageScaffold';
import { useCreateStandard, useDeleteStandard, useStandards, useUpdateStandard } from '../hooks/useWindowApi';
import { useWindowStore } from '../stores/windowStore';
import { useShallow } from 'zustand/react/shallow';
import {
  StandardEditorModal,
  StandardFormValue,
  buildPatternFromPrefixes,
  defaultStandardForm,
} from '../features/standards/StandardEditorModal';

const extractPrefixLabel = (pattern: string) => {
  const multiMatch = pattern.match(/^\^\(\?:([^)]+)\)/);
  if (multiMatch) return multiMatch[1].replace(/\|/g, ',');

  const singleMatch = pattern.match(/^\^?([A-Z]+)/i);
  return singleMatch?.[1] || 'C';
};

const detectPatternMode = (pattern: string) => {
  if (pattern.startsWith('.*')) return 'contains';
  if (pattern.includes('\\d+') && !pattern.includes('\\d{4}')) return 'flexible';
  return 'standard';
};

const describePatternMode = (pattern: string) => {
  if (pattern.startsWith('.*')) return '只要包含前缀';
  if (pattern.includes('\\d+') && !pattern.includes('\\d{4}')) return '任意位数字';
  return '固定4位数字';
};


const StandardsPage = () => {
  const { data: standards = [] } = useStandards();
  const createStandard = useCreateStandard();
  const deleteStandard = useDeleteStandard();
  const updateStandard = useUpdateStandard();
  const { selectedStandardId } = useWindowStore(useShallow((state) => ({
    selectedStandardId: state.selectedStandardId,
  })));

  const [createOpened, setCreateOpened] = useState(false);
  const [editingStandard, setEditingStandard] = useState<any | null>(null);
  const [editForm, setEditForm] = useState<StandardFormValue>(defaultStandardForm);

  const handleCreateSubmit = async (createForm: StandardFormValue) => {
    if (!createForm.name.trim()) {
      notifications.show({ title: '请输入名称', message: '规则名称不能为空。', color: 'red' });
      return;
    }

    await createStandard.mutateAsync({
      name: createForm.name.trim(),
      windowPattern: buildPatternFromPrefixes(createForm.prefix, createForm.mode),
      doorPattern: 'M\\d{4}',
      wallAreaThreshold: createForm.wallAreaThreshold,
      minWindowArea: createForm.minWindowArea,
      minSideLength: createForm.minSideLength,
      labelMaxDistance: createForm.labelMaxDistance,
      layerIncludeKeywords: createForm.layerIncludeKeywords,
      layerExcludeKeywords: createForm.layerExcludeKeywords,
    });

    notifications.show({ title: '已保存', message: '识别标准已创建', color: 'teal' });
    setCreateOpened(false);
  };

  const openEditModal = (item: any) => {
    setEditingStandard(item);
    setEditForm({
      name: item.name,
      prefix: extractPrefixLabel(item.windowPattern),
      mode: detectPatternMode(item.windowPattern),
      wallAreaThreshold: item.wallAreaThreshold ?? 4,
      minWindowArea: item.minWindowArea ?? 0.08,
      minSideLength: item.minSideLength ?? 180,
      labelMaxDistance: item.labelMaxDistance ?? 600,
      layerIncludeKeywords: item.layerIncludeKeywords ?? '窗,window,win',
      layerExcludeKeywords: item.layerExcludeKeywords ?? '标注,text,dim,轴网,图框,title',
    });
  };

  const handleEditSubmit = async (nextForm: StandardFormValue) => {
    if (!editingStandard || !nextForm.name.trim()) return;

    await updateStandard.mutateAsync({
      id: editingStandard.id,
      data: {
        name: nextForm.name.trim(),
        windowPattern: buildPatternFromPrefixes(nextForm.prefix, nextForm.mode),
        doorPattern: 'M\\d{4}',
        wallAreaThreshold: nextForm.wallAreaThreshold,
        minWindowArea: nextForm.minWindowArea,
        minSideLength: nextForm.minSideLength,
        labelMaxDistance: nextForm.labelMaxDistance,
        layerIncludeKeywords: nextForm.layerIncludeKeywords,
        layerExcludeKeywords: nextForm.layerExcludeKeywords,
      },
    });

    setEditingStandard(null);
    notifications.show({ title: '已更新', message: '识别标准已保存', color: 'teal' });
  };

  return (
    <PageScaffold
      title="识别标准"
      description="标准按业务规则配置：前缀、图层、尺寸阈值。反向和撇号后缀会自动识别，不需要自己写复杂正则。"
      actions={(
        <Button
          leftSection={<IconPlus size={16} />}
          onClick={() => {
            setCreateOpened(true);
          }}
        >
          新建规则
        </Button>
      )}
    >
      <Paper withBorder p="md" radius={12} style={{ display: 'flex', minHeight: 0 }}>
        <Stack gap="sm" className="soft-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', paddingRight: 4, paddingBottom: 8 }}>
          <Group justify="space-between" align="flex-start">
            <Box>
              <Title order={4}>已有规则</Title>
              <Text size="sm" c="dimmed" mt={4}>
                建议先只填真窗前缀，例如 `C`。如果项目里大样前缀不同，单独建一条规则，不要和真窗混填。
              </Text>
            </Box>
            <Badge variant="light" color="gray">
              共 {standards.length} 条
            </Badge>
          </Group>

          {standards.map((item: any) => (
            <Paper
              key={item.id}
              withBorder
              radius={12}
              p="md"
              bg={item.id === selectedStandardId ? 'var(--primary-soft)' : '#fff'}
            >
              <Group justify="space-between" align="flex-start">
                <Box>
                  <Text fw={700}>{item.name}</Text>
                  <Group gap="xs" mt={8}>
                    <Badge variant="light" color="gray">
                      前缀 {extractPrefixLabel(item.windowPattern)}
                    </Badge>
                    <Badge variant="light" color="blue">
                      {describePatternMode(item.windowPattern)}
                    </Badge>
                    {item.id === selectedStandardId ? (
                      <Badge variant="light" color="teal">
                        当前使用中
                      </Badge>
                    ) : null}
                  </Group>
                  <Text size="sm" c="dimmed" mt={8}>
                    墙体阈值：{item.wallAreaThreshold} ㎡
                  </Text>
                  <Text size="sm" c="dimmed">
                    最小窗面积：{item.minWindowArea ?? 0.08} ㎡ / 最小边长：{item.minSideLength ?? 180} mm
                  </Text>
                  <Text size="sm" c="dimmed">
                    最大匹配距离：{item.labelMaxDistance ?? 600} mm
                  </Text>
                  <Text size="sm" c="dimmed">
                    自动支持后缀：反、'、中文/字母变体
                  </Text>
                  <Text size="sm" c="dimmed">
                    优先图层：{item.layerIncludeKeywords || '未设置'}
                  </Text>
                  <Text size="sm" c="dimmed">
                    排除图层：{item.layerExcludeKeywords || '未设置'}
                  </Text>
                </Box>
                <Group gap="xs">
                  <Button variant="default" onClick={() => openEditModal(item)}>
                    修改
                  </Button>
                  <ActionIcon color="red" variant="subtle" onClick={() => deleteStandard.mutate(item.id)} disabled={item.id === 'default-std'}>
                    <IconTrash size={16} />
                  </ActionIcon>
                </Group>
              </Group>
            </Paper>
          ))}
        </Stack>
      </Paper>

      <StandardEditorModal
        opened={createOpened}
        onClose={() => setCreateOpened(false)}
        title="新建识别标准"
        submitLabel="保存规则"
        initialValue={defaultStandardForm}
        loading={createStandard.isPending}
        onSubmit={handleCreateSubmit}
      />

      <StandardEditorModal
        opened={!!editingStandard}
        onClose={() => setEditingStandard(null)}
        title="修改识别标准"
        submitLabel="保存修改"
        initialValue={editForm}
        loading={updateStandard.isPending}
        onSubmit={handleEditSubmit}
      />
    </PageScaffold>
  );
};

export default StandardsPage;
