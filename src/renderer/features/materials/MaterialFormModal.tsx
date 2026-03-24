import { Button, Group, Modal, NumberInput, Select, SimpleGrid, Stack, Text, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useEffect } from 'react';

type MaterialFormValues = {
  id?: string;
  categoryId: string;
  name: string;
  unitType: string;
  costPrice: number;
  retailPrice: number;
};

interface MaterialFormModalProps {
  opened: boolean;
  title: string;
  categories: Array<{ id?: string; name: string }>;
  pricingModes: Array<{ id?: string; name: string; unitLabel: string }>;
  initialValues: MaterialFormValues;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (values: MaterialFormValues) => Promise<void>;
}

export const MaterialFormModal = ({
  opened,
  title,
  categories,
  pricingModes,
  initialValues,
  loading = false,
  onClose,
  onSubmit,
}: MaterialFormModalProps) => {
  const form = useForm<MaterialFormValues>({
    initialValues,
    validate: {
      categoryId: (value) => (value ? null : '请选择分类'),
      name: (value) => (value.trim() ? null : '请输入材料名称'),
      unitType: (value) => (value ? null : '请选择单位'),
    },
  });

  useEffect(() => {
    if (opened) {
      form.setValues(initialValues);
      form.resetDirty(initialValues);
      form.clearErrors();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    opened,
    initialValues.id,
    initialValues.categoryId,
    initialValues.name,
    initialValues.unitType,
    initialValues.costPrice,
    initialValues.retailPrice,
  ]);

  return (
    <Modal opened={opened} onClose={onClose} title={<Text fw={700} size="lg">{title}</Text>} centered radius="md" size="lg">
      <form onSubmit={form.onSubmit(async (values) => {
        await onSubmit(values);
      })}>
        <Stack>
          <SimpleGrid cols={2}>
            <Select
              label="所属分类"
              data={categories.map((category) => ({ value: category.id || '', label: category.name }))}
              {...form.getInputProps('categoryId')}
            />
            <TextInput label="材料名称" {...form.getInputProps('name')} />
            <Select
              label="单位"
              data={pricingModes.map((mode) => ({
                value: mode.id || '',
                label: `${mode.name} (${mode.unitLabel})`,
              }))}
              {...form.getInputProps('unitType')}
            />
            <TextInput
              label="单位显示"
              value={pricingModes.find((mode) => mode.id === form.values.unitType)?.unitLabel || ''}
              disabled
            />
            <NumberInput label="成本单价" prefix="¥ " decimalScale={2} min={0} {...form.getInputProps('costPrice')} />
            <NumberInput label="销售单价" prefix="¥ " decimalScale={2} min={0} {...form.getInputProps('retailPrice')} />
          </SimpleGrid>

          <Group justify="flex-end" mt="md">
            <Button variant="subtle" onClick={onClose}>取消</Button>
            <Button type="submit" color="teal" loading={loading}>保存</Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
};
