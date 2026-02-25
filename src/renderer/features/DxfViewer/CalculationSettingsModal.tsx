import { Modal, NumberInput, Stack, Group, Button, Text } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useWindowStore } from '../../stores/windowStore';
import { useEffect } from 'react';

interface CalculationSettingsModalProps {
  opened: boolean;
  onClose: () => void;
}

export const CalculationSettingsModal = ({ opened, onClose }: CalculationSettingsModalProps) => {
  const { scaleFactor, setScaleFactor, profileWidth, setProfileWidth, unitWeight, setUnitWeight } = useWindowStore();
  
  const form = useForm({
    initialValues: {
      scaleFactor,
      profileWidth,
      unitWeight,
    },
  });

  const handleSave = (values: typeof form.values) => {
    setScaleFactor(values.scaleFactor);
    setProfileWidth(values.profileWidth);
    setUnitWeight(values.unitWeight);
    onClose();
  };

  useEffect(() => {
    if (opened) {
      form.setValues({ scaleFactor, profileWidth, unitWeight });
    }
  }, [opened]);

  return (
    <Modal opened={opened} onClose={onClose} title="工业级算料参数设置" radius="sm" centered>
      <form onSubmit={form.onSubmit(handleSave)}>
        <Stack gap="md">
          <NumberInput
            label="绘图比例因子"
            description="1个 DXF 单位 = 多少 mm (例如 1:100 请输入 100)"
            min={0.0001}
            step={1}
            precision={4}
            {...form.getInputProps('scaleFactor')}
          />
          <NumberInput
            label="型材框宽 (mm)"
            description="用于估算净玻璃面积"
            min={0}
            step={1}
            {...form.getInputProps('profileWidth')}
          />
          <NumberInput
            label="型材米重 (kg/m)"
            description="用于估算型材总重量"
            min={0}
            precision={2}
            step={0.1}
            {...form.getInputProps('unitWeight')}
          />
          
          <Group justify="flex-end" mt="md">
            <Button variant="subtle" onClick={onClose}>取消</Button>
            <Button type="submit">保存并应用</Button>
          </Group>
          
          <Text size="xs" c="dimmed" mt="xs">
            * 修改设置后，下次导入 DXF 文件时将按照新参数进行算料。
          </Text>
        </Stack>
      </form>
    </Modal>
  );
};
