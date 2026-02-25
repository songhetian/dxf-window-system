import { Modal, TextInput, Select, Button, Group, Stack } from '@mantine/core';
import { useForm, zodResolver } from '@mantine/form';
import { useEffect } from 'react';
import { WindowItem, UpdateWindowSchema } from '../../../shared/schemas';

interface EditWindowModalProps {
  opened: boolean;
  onClose: () => void;
  windowItem: WindowItem | null;
  onSave: (id: string, data: Partial<WindowItem>) => void;
  isSaving: boolean;
}

export const EditWindowModal = ({ opened, onClose, windowItem, onSave, isSaving }: EditWindowModalProps) => {
  const form = useForm({
    initialValues: {
      name: '',
      category: '默认',
    },
    validate: zodResolver(UpdateWindowSchema),
  });

  useEffect(() => {
    if (windowItem) {
      form.setValues({
        name: windowItem.name,
        category: windowItem.category,
      });
    }
  }, [windowItem]);

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="修改窗户信息"
      radius="sm"
      centered
    >
      <form onSubmit={form.onSubmit((values) => onSave(windowItem!.id!, values))}>
        <Stack gap="md">
          <TextInput
            label="窗户名称"
            placeholder="输入窗户名称"
            radius="sm"
            required
            {...form.getInputProps('name')}
          />
          <Select
            label="分类"
            placeholder="选择分类"
            data={['默认', '外窗', '内窗', '异形窗', '落地窗']}
            radius="sm"
            {...form.getInputProps('category')}
          />
          <Group justify="flex-end" mt="md">
            <Button variant="subtle" onClick={onClose} radius="sm">取消</Button>
            <Button type="submit" loading={isSaving} radius="sm">保存修改</Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
};
