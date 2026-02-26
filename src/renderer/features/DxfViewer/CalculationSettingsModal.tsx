import { Modal, NumberInput, Stack, Group, Button, Text, TextInput, Divider, Title, Grid } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useWindowStore } from '../../stores/windowStore';
import { useEffect } from 'react';
import { useStandards } from '../../hooks/useWindowApi';
import { useMutation } from '@tanstack/react-query';

const API_BASE = 'http://localhost:6002/api';

interface CalculationSettingsModalProps {
  opened: boolean;
  onClose: () => void;
}

export const CalculationSettingsModal = ({ opened, onClose }: CalculationSettingsModalProps) => {
  const { 
    scaleFactor, setScaleFactor, 
    profileWidth, setProfileWidth, 
    unitWeight, setUnitWeight,
    identRules, setIdentRules,
    selectedStandardId
  } = useWindowStore();
  
  const form = useForm({
    initialValues: {
      scaleFactor,
      profileWidth,
      unitWeight,
      windowPrefix: identRules.windowPrefix,
      windowPattern: identRules.windowPattern,
      wallAreaThreshold: identRules.wallAreaThreshold,
    },
  });

  const { data: standards = [] } = useStandards();
  const updateStandardMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`${API_BASE}/standards/${selectedStandardId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      return res.json();
    },
  });

  const handleSave = async (values: typeof form.values) => {
    // 1. 同步到内存 Store
    setScaleFactor(values.scaleFactor);
    setProfileWidth(values.profileWidth);
    setUnitWeight(values.unitWeight);
    setIdentRules({
      windowPrefix: values.windowPrefix,
      windowPattern: values.windowPattern,
      wallAreaThreshold: values.wallAreaThreshold,
    });

    // 2. 同步到数据库
    if (selectedStandardId) {
      await updateStandardMutation.mutateAsync({
        name: standards.find(s => s.id === selectedStandardId)?.name || '通用标准',
        windowPattern: values.windowPattern,
        doorPattern: 'M\\d{4}',
        wallAreaThreshold: values.wallAreaThreshold,
      });
    }
    
    onClose();
  };

  useEffect(() => {
    if (opened) {
      form.setValues({ 
        scaleFactor, 
        profileWidth, 
        unitWeight,
        windowPrefix: identRules.windowPrefix,
        windowPattern: identRules.windowPattern,
        wallAreaThreshold: identRules.wallAreaThreshold,
      });
    }
  }, [opened, identRules, scaleFactor, profileWidth, unitWeight]);

  return (
    <Modal opened={opened} onClose={onClose} title={<Title order={4}>工程解析与识别参数设置</Title>} size="md" radius="sm" centered>
      <form onSubmit={form.onSubmit(handleSave)}>
        <Stack gap="md">
          <Divider label="1. 物理计算参数" labelPosition="left" />
          <Grid gutter="md">
            <Grid.Col span={6}>
              <NumberInput
                label="图纸缩放倍数"
                description="1个单位代表多少mm"
                min={0.0001}
                step={0.1}
                {...form.getInputProps('scaleFactor')}
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <NumberInput
                label="窗框宽度 (mm)"
                description="型材截面宽度"
                min={0}
                {...form.getInputProps('profileWidth')}
              />
            </Grid.Col>
          </Grid>
          
          <NumberInput
            label="型材米重 (kg/m)"
            description="用于估算型材总重量"
            min={0}
            precision={2}
            step={0.1}
            {...form.getInputProps('unitWeight')}
          />

          <Divider label="2. 智能识别规则" labelPosition="left" mt="sm" />
          
          <TextInput
            label="窗户编号前缀"
            description="例如输入 C，识别 C1515 等"
            placeholder="通常为 C"
            {...form.getInputProps('windowPrefix')}
          />

          <TextInput
            label="匹配正则表达式"
            description="默认 C\\d{4} (C+4位数字)"
            placeholder="C\\d{4}"
            {...form.getInputProps('windowPattern')}
          />

          <NumberInput
            label="墙体面积阈值 (㎡)"
            description="超过此面积才算安装墙体"
            min={1}
            {...form.getInputProps('wallAreaThreshold')}
          />
          
          <Group justify="flex-end" mt="xl">
            <Button variant="subtle" onClick={onClose}>取消</Button>
            <Button type="submit" px="xl" loading={updateStandardMutation.isPending}>保存并应用</Button>
          </Group>
          
          <Text size="xs" c="dimmed" ta="center">
            * 提示：重新导入 DXF 文件即可按新规则识别。
          </Text>
        </Stack>
      </form>
    </Modal>
  );
};
