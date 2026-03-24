import React, { useState } from 'react';
import { 
  Title, 
  Tabs, 
  Button, 
  Group, 
  Table, 
  Modal, 
  TextInput, 
  Select, 
  Switch, 
  ActionIcon, 
  Stack, 
  NumberInput,
  Paper,
  Text,
  Badge,
  Grid,
  Box
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconPlus, IconEdit, IconTrash, IconCirclePlus, IconSearch } from '@tabler/icons-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { notifications } from '@mantine/notifications';

export function CategoryManagement() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<string | null>('BASIC');
  const [searchQuery, setSearchQuery] = useState('');
  const [catModalOpened, { open: openCatModal, close: closeCatModal }] = useDisclosure(false);
  const [compModalOpened, { open: openCompModal, close: closeCompModal }] = useDisclosure(false);
  
  const [selectedCatId, setSelectedCatId] = useState<number | null>(null);

  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: api.getCategories });
  const { data: components = [] } = useQuery({ queryKey: ['components'], queryFn: api.getComponents });

  const createCatMutation = useMutation({
    mutationFn: api.createCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      closeCatModal();
      notifications.show({ title: '成功', message: '分类已创建', color: 'teal' });
    }
  });

  const createCompMutation = useMutation({
    mutationFn: api.createComponent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['components'] });
      closeCompModal();
      notifications.show({ title: '成功', message: '项已创建', color: 'teal' });
    }
  });

  const deleteCompMutation = useMutation({
    mutationFn: api.deleteComponent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['components'] });
      notifications.show({ title: '成功', message: '项已删除', color: 'red' });
    }
  });

  const filteredCategories = categories.filter((c: any) => 
    c.type === activeTab && 
    (c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
     components.some((comp: any) => comp.categoryId === c.id && comp.name.toLowerCase().includes(searchQuery.toLowerCase())))
  );

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-end">
        <Box style={{ flexGrow: 1 }}>
          <Title order={2} mb="xs">分类与项库管理</Title>
          <TextInput 
            placeholder="在当前分类中搜索项或分类名称..." 
            leftSection={<IconSearch size={16} />}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.currentTarget.value)}
            radius="md"
            size="md"
            styles={{ input: { border: '1px solid var(--mantine-color-slate-500)' } }}
          />
        </Box>
        <Button 
          size="md"
          leftSection={<IconPlus size={18} />} 
          onClick={() => { openCatModal(); }}
        >
          新建顶级分类
        </Button>
      </Group>

      <Tabs value={activeTab} onChange={setActiveTab} color="teal" variant="outline" radius="md">
        <Tabs.List mb="md">
          <Tabs.Tab value="BASIC" style={{ height: 44, fontSize: 15, fontWeight: 600 }}>基础类 (窗户主材)</Tabs.Tab>
          <Tabs.Tab value="ACCESSORY" style={{ height: 44, fontSize: 15, fontWeight: 600 }}>配件类 (五金辅材)</Tabs.Tab>
          <Tabs.Tab value="RATES" style={{ height: 44, fontSize: 15, fontWeight: 600 }}>额外费率</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="BASIC">
          <CategoryList 
            categories={filteredCategories} 
            components={components}
            searchQuery={searchQuery}
            onAddComponent={(catId: number) => { setSelectedCatId(catId); openCompModal(); }}
            onDeleteComponent={(id: number) => deleteCompMutation.mutate(id)}
          />
        </Tabs.Panel>
        
        <Tabs.Panel value="ACCESSORY">
          <CategoryList 
            categories={filteredCategories} 
            components={components}
            searchQuery={searchQuery}
            onAddComponent={(catId: number) => { setSelectedCatId(catId); openCompModal(); }}
            onDeleteComponent={(id: number) => deleteCompMutation.mutate(id)}
          />
        </Tabs.Panel>

        <Tabs.Panel value="RATES">
          <ExtraRateList />
        </Tabs.Panel>
      </Tabs>

      {/* Modals remain the same but with improved styling */}
      <Modal opened={catModalOpened} onClose={closeCatModal} title="创建新分类" centered>
        <Stack>
          <TextInput label="名称" placeholder="如：五金、玻璃胶" required id="cat-name" />
          <Select 
            label="所属类型" 
            data={[{ value: 'BASIC', label: '基础类' }, { value: 'ACCESSORY', label: '配件类' }]} 
            defaultValue={activeTab || 'BASIC'}
            id="cat-type"
          />
          <Select 
            label="计价单位" 
            data={[
              { value: 'SQM', label: '平米 (按面积)' }, 
              { value: 'LINEAR', label: '延米 (按周长/长度)' }, 
              { value: 'PIECE', label: '件 (按个数)' },
              { value: 'BOTTLE', label: '瓶 (按瓶)' }
            ]} 
            defaultValue="SQM"
            id="cat-unit"
          />
          <Switch label="允许在同一组合中重复出现" id="cat-repeatable" />
          <Button color="teal" onClick={() => {
            const name = (document.getElementById('cat-name') as HTMLInputElement).value;
            const type = (document.getElementById('cat-type') as HTMLInputElement).value;
            const unitType = (document.getElementById('cat-unit') as HTMLInputElement).value;
            const isRepeatable = (document.getElementById('cat-repeatable') as HTMLInputElement).checked;
            if (name) createCatMutation.mutate({ name, type, unitType, isRepeatable });
          }}>提交保存</Button>
        </Stack>
      </Modal>

      <Modal opened={compModalOpened} onClose={closeCompModal} title="添加具体项" centered>
        <Stack>
          <TextInput label="名称" placeholder="输入规格/名称" required id="comp-name" />
          <NumberInput label="代理采购价 (¥)" defaultValue={0} precision={2} id="comp-agency" min={0} />
          <NumberInput label="市场零售价 (¥)" defaultValue={0} precision={2} id="comp-retail" min={0} />
          <Button color="teal" onClick={() => {
            const name = (document.getElementById('comp-name') as HTMLInputElement).value;
            const agencyPrice = parseFloat((document.getElementById('comp-agency') as HTMLInputElement).value.replace(/,/g, '') || '0');
            const retailPrice = parseFloat((document.getElementById('comp-retail') as HTMLInputElement).value.replace(/,/g, '') || '0');
            if (name && selectedCatId) {
              createCompMutation.mutate({ 
                name, 
                agencyPrice, 
                retailPrice, 
                categoryId: selectedCatId,
                unitType: categories.find((c: any) => c.id === selectedCatId)?.unitType
              });
            }
          }}>加入库中</Button>
        </Stack>
      </Modal>
    </Stack>
  );
}

function ExtraRateList() {
  const queryClient = useQueryClient();
  const { data: rates = [] } = useQuery({ queryKey: ['extra-rates'], queryFn: api.getExtraRates });
  
  const createMutation = useMutation({
    mutationFn: api.createExtraRate,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['extra-rates'] })
  });

  return (
    <Paper withBorder p="xl" radius="md">
      <Group justify="space-between" mb="xl">
        <Box>
          <Text fw={700} size="lg">额外费率配置</Text>
          <Text size="xs" c="dimmed">基于总金额的百分比计算，如税金、管理费等</Text>
        </Box>
        <Button variant="light" color="teal" onClick={() => {
          const name = prompt('请输入费率名称（如：管理费）');
          const percentage = parseFloat(prompt('请输入百分比（如：5 代表 5%）', '0') || '0');
          if (name) createMutation.mutate({ name, percentage });
        }}>+ 添加费率</Button>
      </Group>
      <Table verticalSpacing="md" horizontalSpacing="md">
        <Table.Thead bg="gray.0">
          <Table.Tr>
            <Table.Th>费率项目名称</Table.Th>
            <Table.Th>百分比 (%)</Table.Th>
            <Table.Th>当前状态</Table.Th>
            <Table.Th w={100}>操作</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rates.length === 0 ? (
             <Table.Tr><Table.Td colSpan={4} align="center" c="dimmed">暂无费率定义</Table.Td></Table.Tr>
          ) : rates.map((r: any) => (
            <Table.Tr key={r.id}>
              <Table.Td fw={600}>{r.name}</Table.Td>
              <Table.Td>
                <Badge color="teal" variant="light" size="lg">{r.percentage}%</Badge>
              </Table.Td>
              <Table.Td>
                <Switch checked={r.isActive} color="teal" readOnly />
              </Table.Td>
              <Table.Td>
                <ActionIcon color="red" variant="subtle"><IconTrash size={16} /></ActionIcon>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Paper>
  );
}

function CategoryList({ categories, components, searchQuery, onAddComponent, onDeleteComponent }: any) {
  return (
    <Grid gutter="xl">
      {categories.map((cat: any) => {
        const catComponents = components.filter((comp: any) => 
          comp.categoryId === cat.id && 
          (comp.name.toLowerCase().includes(searchQuery.toLowerCase()) || cat.name.toLowerCase().includes(searchQuery.toLowerCase()))
        );

        return (
          <Grid.Col key={cat.id} span={{ base: 12, md: 6, lg: 4 }}>
            <Paper withBorder p="md" radius="md" bg="white" style={{ transition: 'all 0.2s ease', borderTop: '3px solid var(--mantine-color-teal-6)' }}>
              <Group justify="space-between" mb="md">
                <Box>
                  <Text fw={800} size="md" c="teal.9">{cat.name}</Text>
                  <Group gap={4} mt={2}>
                    <Badge size="xs" color="gray" variant="outline">{cat.unitType}</Badge>
                    {cat.isRepeatable && <Badge size="xs" color="blue" variant="dot">可重复</Badge>}
                  </Group>
                </Box>
                <ActionIcon variant="filled" color="teal" radius="xl" onClick={() => onAddComponent(cat.id)}>
                  <IconCirclePlus size={20} />
                </ActionIcon>
              </Group>
              
              <Table variant="simple" layout="fixed" verticalSpacing="xs">
                <Table.Thead bg="gray.0">
                  <Table.Tr>
                    <Table.Th w="45%"><Text size="xs" fw={700}>名称</Text></Table.Th>
                    <Table.Th><Text size="xs" fw={700}>价格</Text></Table.Th>
                    <Table.Th w={40}></Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {catComponents.length === 0 ? (
                    <Table.Tr><Table.Td colSpan={3} align="center"><Text size="xs" c="dimmed">暂无数据</Text></Table.Td></Table.Tr>
                  ) : catComponents.map((comp: any) => (
                    <Table.Tr key={comp.id}>
                      <Table.Td><Text size="sm" fw={500} truncate>{comp.name}</Text></Table.Td>
                      <Table.Td>
                        <Stack gap={0}>
                          <Text size="xs" c="dimmed">代: ¥{comp.agencyPrice}</Text>
                          <Text size="xs" fw={700} c="teal">售: ¥{comp.retailPrice}</Text>
                        </Stack>
                      </Table.Td>
                      <Table.Td>
                        <ActionIcon variant="subtle" color="red" size="sm" onClick={() => onDeleteComponent(comp.id)}>
                          <IconTrash size={14} />
                        </ActionIcon>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Paper>
          </Grid.Col>
        );
      })}
    </Grid>
  );
}
