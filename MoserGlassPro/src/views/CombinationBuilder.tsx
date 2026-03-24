import React, { useState } from 'react';
import { 
  Title, 
  Grid, 
  Paper, 
  Stack, 
  Text, 
  Group, 
  Button, 
  TextInput, 
  Divider,
  Badge,
  ActionIcon,
  NumberInput,
  ScrollArea
} from '@mantine/core';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { IconTrash, IconDeviceFloppy, IconDragDrop } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';

export function CombinationBuilder() {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [selectedComponents, setSelectedComponents] = useState<any[]>([]);

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: api.getCategories
  });

  const { data: components = [] } = useQuery({
    queryKey: ['components'],
    queryFn: api.getComponents
  });

  const createComboMutation = useMutation({
    mutationFn: api.createCombination,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['combinations'] });
      setName('');
      setSelectedComponents([]);
      notifications.show({ title: '成功', message: '成品组合已保存', color: 'teal' });
    }
  });

  const basicCategories = categories.filter((c: any) => c.type === 'BASIC');

  const addComponent = (comp: any) => {
    if (selectedComponents.find(c => c.id === comp.id)) {
      notifications.show({ title: '提示', message: '该项已在组合中', color: 'blue' });
      return;
    }
    setSelectedComponents([...selectedComponents, { ...comp, quantity: 1 }]);
  };

  const removeComponent = (id: number) => {
    setSelectedComponents(selectedComponents.filter(c => c.id !== id));
  };

  const updateQuantity = (id: number, val: number) => {
    setSelectedComponents(selectedComponents.map(c => c.id === id ? { ...c, quantity: val } : c));
  };

  const totalAgencyPrice = selectedComponents.reduce((sum, c) => sum + c.agencyPrice * c.quantity, 0);
  const totalRetailPrice = selectedComponents.reduce((sum, c) => sum + c.retailPrice * c.quantity, 0);

  const handleSave = () => {
    if (!name) return notifications.show({ title: '错误', message: '请输入组合名称', color: 'red' });
    if (selectedComponents.length === 0) return notifications.show({ title: '错误', message: '请至少添加一个组件', color: 'red' });
    
    // Calculate Hash: sort by component ID and join
    const hash = selectedComponents.map(c => c.id).sort().join('-');
    
    createComboMutation.mutate({
      name,
      hash,
      agencyPrice: totalAgencyPrice,
      retailPrice: totalRetailPrice,
      components: selectedComponents.map(c => ({ componentId: c.id, quantity: c.quantity }))
    });
  };

  return (
    <Stack gap="md">
      <Title order={2}>成品组合构建</Title>
      
      <Grid gutter="md">
        {/* Left: Component Library */}
        <Grid.Col span={4}>
          <Paper withBorder p="md" radius="md" h="70vh">
            <Text fw={700} mb="md">基础组件库</Text>
            <ScrollArea h="calc(70vh - 60px)">
              <Stack gap="sm">
                {basicCategories.map((cat: any) => (
                  <div key={cat.id}>
                    <Text size="xs" fw={700} c="teal" mb={5}>{cat.name}</Text>
                    <Stack gap={4}>
                      {components.filter((c: any) => c.categoryId === cat.id).map((comp: any) => (
                        <Paper 
                          key={comp.id} 
                          withBorder 
                          p="xs" 
                          style={{ cursor: 'pointer', borderColor: 'var(--mantine-color-teal-2)' }}
                          onClick={() => addComponent(comp)}
                          component="div"
                        >
                          <Group justify="space-between">
                            <Text size="sm">{comp.name}</Text>
                            <Badge size="xs" color="teal">¥{comp.retailPrice}</Badge>
                          </Group>
                        </Paper>
                      ))}
                    </Stack>
                    <Divider my="sm" />
                  </div>
                ))}
              </Stack>
            </ScrollArea>
          </Paper>
        </Grid.Col>

        {/* Right: Construction Area */}
        <Grid.Col span={8}>
          <Paper withBorder p="md" radius="md" h="70vh">
            <Stack justify="space-between" h="full">
              <div>
                <Group justify="space-between" mb="md">
                  <TextInput 
                    placeholder="组合名称 (如: 断桥铝-5G-超白)" 
                    style={{ flex: 1 }} 
                    value={name}
                    onChange={(e) => setName(e.currentTarget.value)}
                  />
                  <Button 
                    leftSection={<IconDeviceFloppy size={16} />} 
                    onClick={handleSave}
                    loading={createComboMutation.isPending}
                  >
                    保存组合
                  </Button>
                </Group>

                <Divider mb="md" label="组合内容" labelPosition="center" />

                {selectedComponents.length === 0 ? (
                  <Stack align="center" py="xl" c="dimmed">
                    <IconDragDrop size={48} stroke={1} />
                    <Text>点击左侧组件加入组合</Text>
                  </Stack>
                ) : (
                  <ScrollArea h="calc(70vh - 250px)">
                    <Stack gap="xs">
                      {selectedComponents.map((comp) => (
                        <Paper key={comp.id} withBorder p="sm">
                          <Grid align="center">
                            <Grid.Col span={6}>
                              <Text size="sm" fw={500}>{comp.name}</Text>
                            </Grid.Col>
                            <Grid.Col span={4}>
                              <Group gap="xs">
                                <Text size="xs">数量:</Text>
                                <NumberInput 
                                  size="xs" 
                                  w={60} 
                                  value={comp.quantity} 
                                  onChange={(val) => updateQuantity(comp.id, Number(val))}
                                  min={0.01}
                                />
                              </Group>
                            </Grid.Col>
                            <Grid.Col span={2}>
                              <Group justify="flex-end">
                                <ActionIcon color="red" variant="subtle" onClick={() => removeComponent(comp.id)}>
                                  <IconTrash size={16} />
                                </ActionIcon>
                              </Group>
                            </Grid.Col>
                          </Grid>
                        </Paper>
                      ))}
                    </Stack>
                  </ScrollArea>
                )}
              </div>

              <Paper p="md" bg="teal.0" radius="md">
                <Group justify="space-between">
                  <div>
                    <Text size="xs" c="dimmed">预估代理成本</Text>
                    <Text fw={700} c="teal">¥{totalAgencyPrice.toFixed(2)} / 单位</Text>
                  </div>
                  <div>
                    <Text size="xs" c="dimmed">预估零售价格</Text>
                    <Text fw={700} c="teal" size="lg">¥{totalRetailPrice.toFixed(2)} / 单位</Text>
                  </div>
                </Group>
              </Paper>
            </Stack>
          </Paper>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
