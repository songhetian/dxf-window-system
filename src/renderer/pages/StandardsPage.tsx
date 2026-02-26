import React, { useState, useMemo } from 'react';
import { Box, Title, Text, Stack, Paper, Group, Button, TextInput, NumberInput, ActionIcon, Card, Badge, SegmentedControl, Divider, Alert, ScrollArea, Center, Loader } from '@mantine/core';
import { IconPlus, IconTrash, IconCheck, IconEye, IconBulb } from '@tabler/icons-react';
import { useStandards, useCreateStandard, useDeleteStandard } from '../hooks/useWindowApi';
import { useWindowStore } from '../stores/windowStore';
import { notifications } from '@mantine/notifications';

const StandardsPage = () => {
  const { data: standards = [], isLoading } = useStandards();
  const createMutation = useCreateStandard();
  const deleteMutation = useDeleteStandard();
  const { selectedStandardId, setSelectedStandardId, setIdentRules } = useWindowStore();
  
  const [name, setName] = useState('');
  const [prefix, setPrefix] = useState('C');
  const [matchType, setMatchType] = useState('standard');
  const [wallSize, setWallSize] = useState(10);

  const generatedPattern = useMemo(() => {
    const p = prefix.toUpperCase();
    if (matchType === 'standard') return `${p}\\d{4}`;
    if (matchType === 'flexible') return `${p}\\d+`;
    return `.*${p}.*`;
  }, [prefix, matchType]);

  const examples = useMemo(() => {
    const p = prefix.toUpperCase();
    if (matchType === 'standard') return [`${p}1515`, `${p}0707`, `${p}1215`].join(', ');
    if (matchType === 'flexible') return [`${p}1`, `${p}12345`].join(', ');
    return [`W-${p}-01`, `TYPE-${p}`].join(', ');
  }, [prefix, matchType]);

  const handleCreate = async () => {
    if (!name) {
      notifications.show({ title: '请输入名称', message: '请给这个规则起个名字', color: 'red' });
      return;
    }
    await createMutation.mutateAsync({
      name,
      windowPattern: generatedPattern,
      doorPattern: 'M\\d{4}',
      wallAreaThreshold: wallSize
    });
    setName('');
    notifications.show({ title: '标准已添加', message: '新的识别规则已保存', color: 'green' });
  };

  const applyStandard = (std: any) => {
    setSelectedStandardId(std.id);
    setIdentRules({
      windowPrefix: prefix,
      windowPattern: std.windowPattern,
      wallAreaThreshold: std.wallAreaThreshold
    });
    notifications.show({ title: '已成功切换', message: `当前生效：${std.name}`, color: 'blue' });
  };

  if (isLoading) return <Center h="100%"><Loader /></Center>;

  return (
    <ScrollArea h="100vh" p="xl">
      <Box style={{ maxWidth: 900, margin: '0 auto', paddingBottom: 80 }}>
        <Stack gap="xl">
          <Box>
            <Title order={2} mb={4}>智能识别向导</Title>
            <Text size="sm" c="dimmed">配置图纸识别规则，让系统更聪明地自动分拣窗户和门</Text>
          </Box>

          <Paper withBorder p="xl" radius="md" shadow="sm">
            <Stack gap="lg">
              <Title order={4}>第一步：起个名字</Title>
              <TextInput placeholder="例如：通用标准、特定厂家标准..." value={name} onChange={(e) => setName(e.target.value)} />
              <Divider />
              <Title order={4}>第二步：定义窗户编号格式</Title>
              <Group grow>
                <TextInput label="前缀字母" placeholder="通常是 C" value={prefix} onChange={(e) => setPrefix(e.target.value.toUpperCase())} />
                <Stack gap={4}>
                  <Text size="sm" fw={500}>匹配精准度</Text>
                  <SegmentedControl value={matchType} onChange={setMatchType} data={[
                    { label: '标准(4位)', value: 'standard' },
                    { label: '模糊(任意)', value: 'flexible' },
                    { label: '包含字母', value: 'contains' },
                  ]} />
                </Stack>
              </Group>
              <Alert icon={<IconEye size={16} />} title="匹配效果预览" color="blue">
                系统会识别：<Text span fw={700}>{examples}</Text>
              </Alert>
              <Divider />
              <Title order={4}>第三步：杂物过滤强度</Title>
              <NumberInput label="过滤强度 (㎡)" style={{ width: 200 }} value={wallSize} onChange={(val) => setWallSize(Number(val))} suffix=" ㎡" />
              <Button size="lg" leftSection={<IconPlus size={20} />} onClick={handleCreate} loading={createMutation.isPending} fullWidth mt="md">保存新标准</Button>
            </Stack>
          </Paper>

          <Stack gap="md">
            <Title order={4}>已保存的识别规则列表</Title>
            {standards.length === 0 && <Text c="dimmed" ta="center" py="xl">暂无数据</Text>}
            {standards.map((std: any) => (
              <Card key={std.id} withBorder padding="lg" radius="md" style={{
                borderColor: selectedStandardId === std.id ? 'var(--mantine-color-blue-6)' : undefined,
                backgroundColor: selectedStandardId === std.id ? 'var(--mantine-color-blue-0)' : undefined,
              }}>
                <Group justify="space-between">
                  <Box>
                    <Group gap="xs">
                      <Text fw={800} size="lg">{std.name}</Text>
                      {selectedStandardId === std.id && <Badge color="blue" variant="filled">生效中</Badge>}
                    </Group>
                    <Text size="xs" c="dimmed" mt={4}>模式: {std.windowPattern} | 阈值: {std.wallAreaThreshold}㎡</Text>
                  </Box>
                  <Group>
                    <Button variant={selectedStandardId === std.id ? "filled" : "light"} onClick={() => applyStandard(std)} disabled={selectedStandardId === std.id}>应用</Button>
                    <ActionIcon variant="subtle" color="red" size="lg" onClick={() => deleteMutation.mutate(std.id)} disabled={std.id === 'default-std'}>
                      <IconTrash size={20} />
                    </ActionIcon>
                  </Group>
                </Group>
              </Card>
            ))}
          </Stack>
        </Stack>
      </Box>
    </ScrollArea>
  );
};

export default StandardsPage;
