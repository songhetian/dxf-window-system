import { Badge, Box, Card, Center, Divider, Group, Modal, Paper, ScrollArea, SegmentedControl, SimpleGrid, Stack, Table, Text, TextInput, ThemeIcon } from '@mantine/core';
import { IconChartBar, IconChevronDown, IconChevronRight, IconFiles, IconLayoutGrid, IconSearch, IconTag } from '@tabler/icons-react';

export const QuotationSheetDetailModal = ({
  opened,
  onClose,
  sheetDetail,
  sheetAllocationSummary,
  sheetDetailFilter,
  setSheetDetailFilter,
  sheetDetailSearch,
  setSheetDetailSearch,
  sheetDetailView,
  setSheetDetailView,
  groupedSheetItems,
  expandedTypeGroups,
  setExpandedTypeGroups,
  filteredSheetItems,
  sheetBreakdownData,
  topWindowItems,
  topProductsInSheet,
}: any) => (
  <Modal
    opened={opened}
    onClose={onClose}
    title={null}
    withCloseButton
    centered
    size="85%"
    closeOnClickOutside
    closeOnEscape
    overlayProps={{ backgroundOpacity: 0.2, blur: 10 }}
    styles={{
      content: {
        background: 'rgba(248, 250, 252, 0.72)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.55)',
        boxShadow: '0 28px 90px rgba(15, 23, 42, 0.24)',
      },
      header: {
        background: 'transparent',
        minHeight: 24,
        paddingBottom: 0,
      },
      body: {
        padding: 20,
      },
    }}
  >
    {sheetDetail ? (
      <Stack gap="lg" maw={1480} mx="auto">
        <Paper withBorder radius="xl" p="xl" style={{ background: 'linear-gradient(135deg, rgba(20,184,166,0.14) 0%, rgba(240,253,250,0.88) 35%, rgba(255,255,255,0.82) 100%)', borderColor: 'rgba(255,255,255,0.58)' }}>
          <Group justify="space-between" align="flex-start" wrap="nowrap">
            <Box>
              <Group gap="sm" mb={10}>
                <ThemeIcon variant="light" color="teal" radius="xl" size={40}>
                  <IconLayoutGrid size={18} />
                </ThemeIcon>
                <Box>
                  <Text fw={900} size="xl">明细概览</Text>
                  <Text size="sm" c="dimmed">创建时间 {new Date(sheetDetail.createdAt || Date.now()).toLocaleString()}</Text>
                </Box>
              </Group>
              <Group gap="sm" wrap="wrap">
                <Badge color="teal" variant="light">{sheetDetail.items?.length || 0} 个窗型项</Badge>
                <Badge color="blue" variant="light">{sheetDetail.allocationLabels?.length || 0} 个分配标签</Badge>
                <Badge color="gray" variant="light">{new Set((sheetDetail.items || []).map((item: any) => item.windowType || '未分类')).size} 个类型</Badge>
              </Group>
            </Box>
            <Paper radius="lg" px="md" py="sm" withBorder style={{ minWidth: 220, background: 'rgba(255,255,255,0.78)' }}>
              <Text size="xs" c="dimmed" mb={4}>综合毛利</Text>
              <Text fw={900} size="xl" c={Number(sheetDetail.totalRetail || 0) - Number(sheetDetail.totalCost || 0) >= 0 ? 'teal' : 'red'}>
                ¥{(Number(sheetDetail.totalRetail || 0) - Number(sheetDetail.totalCost || 0)).toFixed(0)}
              </Text>
              <Text size="xs" c="dimmed">
                毛利率 {(((Number(sheetDetail.totalRetail || 0) - Number(sheetDetail.totalCost || 0)) / (Number(sheetDetail.totalRetail || 0) || 1)) * 100).toFixed(1)}%
              </Text>
            </Paper>
          </Group>
        </Paper>

        <SimpleGrid cols={{ base: 2, lg: 6 }} spacing="sm">
          <Card withBorder radius="xl" padding="md"><Text size="xs" c="dimmed">窗型项</Text><Text fw={800} size="xl">{sheetDetail.items?.length || 0}</Text></Card>
          <Card withBorder radius="xl" padding="md"><Text size="xs" c="dimmed">总面积</Text><Text fw={800} size="xl">{Number(sheetDetail.totalArea || 0).toFixed(2)}</Text><Text size="xs" c="dimmed">㎡</Text></Card>
          <Card withBorder radius="xl" padding="md"><Text size="xs" c="dimmed">总成本</Text><Text fw={800} size="xl">¥{Number(sheetDetail.totalCost || 0).toFixed(0)}</Text></Card>
          <Card withBorder radius="xl" padding="md"><Text size="xs" c="dimmed">总销售</Text><Text fw={800} size="xl" c="blue">¥{Number(sheetDetail.totalRetail || 0).toFixed(0)}</Text></Card>
          <Card withBorder radius="xl" padding="md"><Text size="xs" c="dimmed">成本均价</Text><Text fw={800} size="xl">¥{(Number(sheetDetail.totalCost || 0) / (Number(sheetDetail.totalArea || 0) || 1)).toFixed(0)}</Text><Text size="xs" c="dimmed">/㎡</Text></Card>
          <Card withBorder radius="xl" padding="md"><Text size="xs" c="dimmed">销售均价</Text><Text fw={800} size="xl" c="blue">¥{(Number(sheetDetail.totalRetail || 0) / (Number(sheetDetail.totalArea || 0) || 1)).toFixed(0)}</Text><Text size="xs" c="dimmed">/㎡</Text></Card>
        </SimpleGrid>

        <SimpleGrid cols={{ base: 1, xl: 3 }} spacing="md">
          <Paper withBorder radius="xl" p="md">
            <Group gap="xs" mb="sm">
              <IconTag size={16} color="teal" />
              <Text fw={800} size="sm">分配标签概览</Text>
            </Group>
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
              {sheetAllocationSummary.slice(0, 10).map((entry: { label: string; quantity: number }) => (
                <Paper key={entry.label} withBorder radius="lg" p="sm" style={{ background: sheetDetailFilter === entry.label ? 'rgba(20,184,166,0.08)' : 'white', cursor: 'pointer' }} onClick={() => setSheetDetailFilter((current: string) => current === entry.label ? 'all' : entry.label)}>
                  <Group justify="space-between" align="center">
                    <Text size="sm" fw={700}>{entry.label}</Text>
                    <Badge variant="filled" color={sheetDetailFilter === entry.label ? 'teal' : 'gray'}>{entry.quantity}</Badge>
                  </Group>
                </Paper>
              ))}
              {sheetAllocationSummary.length === 0 && <Text size="xs" c="dimmed">暂无数量分配</Text>}
            </SimpleGrid>
          </Paper>

          <Paper withBorder radius="xl" p="md">
            <Group gap="xs" mb="sm">
              <IconChartBar size={16} color="teal" />
              <Text fw={800} size="sm">工作表摘要</Text>
            </Group>
            <Stack gap="xs">
              <Group justify="space-between"><Text size="sm">窗型类型数</Text><Text fw={700}>{new Set((sheetDetail.items || []).map((item: any) => item.windowType || '未分类')).size}</Text></Group>
              <Group justify="space-between"><Text size="sm">设计编号数</Text><Text fw={700}>{new Set((sheetDetail.items || []).map((item: any) => item.designNumber || '未命名')).size}</Text></Group>
              <Group justify="space-between"><Text size="sm">总数量</Text><Text fw={700}>{(sheetDetail.items || []).reduce((sum: number, item: any) => sum + Number(item.quantity || 0), 0)}</Text></Group>
              <Group justify="space-between"><Text size="sm">最近更新时间</Text><Text fw={700}>{new Date(sheetDetail.updatedAt || sheetDetail.createdAt || Date.now()).toLocaleDateString()}</Text></Group>
            </Stack>
          </Paper>

          <Paper withBorder radius="xl" p="md" style={{ background: 'linear-gradient(180deg, rgba(239,246,255,0.7) 0%, rgba(255,255,255,1) 100%)' }}>
            <Text fw={800} size="sm" mb="sm">价格对比</Text>
            <Stack gap="xs">
              <Group justify="space-between"><Text size="sm">总销售</Text><Text fw={800} c="blue">¥{Number(sheetDetail.totalRetail || 0).toFixed(2)}</Text></Group>
              <Group justify="space-between"><Text size="sm">总成本</Text><Text fw={800} c="teal">¥{Number(sheetDetail.totalCost || 0).toFixed(2)}</Text></Group>
              <Group justify="space-between"><Text size="sm">毛利额</Text><Text fw={800} c={Number(sheetDetail.totalRetail || 0) - Number(sheetDetail.totalCost || 0) >= 0 ? 'orange.7' : 'red'}>¥{(Number(sheetDetail.totalRetail || 0) - Number(sheetDetail.totalCost || 0)).toFixed(2)}</Text></Group>
              <Group justify="space-between"><Text size="sm">毛利率</Text><Text fw={800}>{(((Number(sheetDetail.totalRetail || 0) - Number(sheetDetail.totalCost || 0)) / (Number(sheetDetail.totalRetail || 0) || 1)) * 100).toFixed(1)}%</Text></Group>
            </Stack>
          </Paper>
        </SimpleGrid>

        <SimpleGrid cols={{ base: 1, xl: 3 }} spacing="md">
          <Paper withBorder radius="xl" p="md">
            <Text fw={800} size="sm" mb="sm">这张表的成本构成</Text>
            {sheetBreakdownData.summary.length > 0 ? (
              <Stack gap="xs">
                {sheetBreakdownData.summary.map((item: any) => (
                  <Paper key={item.key} withBorder radius="lg" p="sm">
                    <Group justify="space-between" align="flex-start" wrap="nowrap">
                      <Box>
                        <Badge color={item.color} variant="light">{item.label}</Badge>
                        <Text size="xs" c="dimmed" mt={6}>占比 {item.costShare.toFixed(1)}% · 单方 ¥{item.costPerSqm.toFixed(0)}/㎡</Text>
                      </Box>
                      <Text size="sm" fw={800} c="teal.7">¥{item.cost.toFixed(0)}</Text>
                    </Group>
                  </Paper>
                ))}
              </Stack>
            ) : (
              <Center py="xl"><Text size="sm" c="dimmed">这张工作表还没有可分析的构成明细</Text></Center>
            )}
          </Paper>

          <Paper withBorder radius="xl" p="md">
            <Text fw={800} size="sm" mb="sm">拉高成本的窗型</Text>
            <Stack gap="xs">
              {topWindowItems.length > 0 ? topWindowItems.map((item: any, index: number) => (
                <Paper key={item.id} withBorder radius="lg" p="sm">
                  <Group justify="space-between" align="flex-start" wrap="nowrap">
                    <Box style={{ minWidth: 0, flex: 1 }}>
                      <Group gap="xs" mb={4}>
                        <Badge variant="filled" color={index === 0 ? 'red' : index === 1 ? 'orange' : 'yellow'}>TOP {index + 1}</Badge>
                        <Text fw={800} size="sm" truncate>{item.designNumber}</Text>
                      </Group>
                      <Text size="xs" c="dimmed">{item.windowType || '未分类'} · {item.width} × {item.height} mm · 数量 {item.quantity}</Text>
                    </Box>
                    <Stack gap={2} align="flex-end">
                      <Text size="sm" fw={800} c="teal.7">¥{Number(item.totalPrice || 0).toFixed(0)}</Text>
                      <Text size="xs" c="dimmed">占比 {item.costShare.toFixed(1)}%</Text>
                    </Stack>
                  </Group>
                </Paper>
              )) : (
                <Text size="sm" c="dimmed">当前筛选条件下没有窗型数据。</Text>
              )}
            </Stack>
          </Paper>

          <Paper withBorder radius="xl" p="md" style={{ background: 'linear-gradient(180deg, rgba(255,247,237,0.72) 0%, rgba(255,255,255,1) 100%)' }}>
            <Text fw={800} size="sm" mb="sm">使用最多 / 金额最高的组合</Text>
            <Stack gap="xs">
              {topProductsInSheet.length > 0 ? topProductsInSheet.map((item: any) => (
                <Paper key={`${item.name}-${item.count}`} withBorder radius="lg" p="sm" style={{ background: 'rgba(255,255,255,0.92)' }}>
                  <Group justify="space-between" align="flex-start" wrap="nowrap">
                    <Box style={{ minWidth: 0, flex: 1 }}>
                      <Text fw={800} size="sm" truncate>{item.name}</Text>
                      <Text size="xs" c="dimmed" mt={4}>使用数量 {item.count} · 销售 ¥{item.retail.toFixed(0)}</Text>
                    </Box>
                    <Text size="sm" fw={800} c="orange.7">¥{item.cost.toFixed(0)}</Text>
                  </Group>
                </Paper>
              )) : (
                <Text size="sm" c="dimmed">当前筛选条件下没有组合数据。</Text>
              )}
            </Stack>
          </Paper>
        </SimpleGrid>

        <Paper withBorder radius="xl" p="md">
          <Group justify="space-between" align="center" wrap="wrap" mb="sm">
            <Text fw={800} size="sm">窗型明细</Text>
            <Group gap="sm" wrap="wrap">
              <TextInput size="xs" w={220} placeholder="按设计编号搜索..." leftSection={<IconSearch size={14} />} value={sheetDetailSearch} onChange={(event) => setSheetDetailSearch(event.currentTarget.value)} />
              <SegmentedControl
                size="xs"
                value={sheetDetailView}
                onChange={(value) => setSheetDetailView(value as 'table' | 'grouped')}
                data={[
                  { value: 'grouped', label: '按类型分组' },
                  { value: 'table', label: '表格视图' },
                ]}
              />
              <SegmentedControl
                size="xs"
                value={sheetDetailFilter}
                onChange={setSheetDetailFilter}
                data={[
                  { value: 'all', label: '全部' },
                  ...sheetAllocationSummary.slice(0, 4).map((entry: { label: string; quantity: number }) => ({ value: entry.label, label: entry.label })),
                ]}
              />
            </Group>
          </Group>
          <Divider mb="md" />

          {sheetDetailView === 'grouped' ? (
            <Stack gap="sm">
              {groupedSheetItems.map((group: any) => {
                const expanded = expandedTypeGroups.includes(group.type);
                return (
                  <Paper key={group.type} withBorder radius="xl" p="sm" style={{ background: expanded ? 'rgba(20,184,166,0.04)' : 'white' }}>
                    <Group justify="space-between" align="center" style={{ cursor: 'pointer' }} onClick={() => setExpandedTypeGroups((current: string[]) => expanded ? current.filter((entry) => entry !== group.type) : [...current, group.type])}>
                      <Group gap="sm">
                        <ThemeIcon variant="light" color="teal" radius="md">
                          {expanded ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
                        </ThemeIcon>
                        <Box>
                          <Text fw={800} size="sm">{group.type}</Text>
                          <Text size="xs" c="dimmed">{group.items.length} 个窗型，数量 {group.quantity}</Text>
                        </Box>
                      </Group>
                      <Group gap="xs">
                        <Badge variant="light" color="teal">成本 ¥{group.totalCost.toFixed(0)}</Badge>
                        <Badge variant="light" color="blue">销售 ¥{group.items.reduce((sum: number, item: any) => sum + Number(item.totalRetailPrice || 0), 0).toFixed(0)}</Badge>
                      </Group>
                    </Group>

                    {expanded && (
                      <Stack gap="sm" mt="sm">
                        {group.items.map((item: any) => (
                          <Paper key={item.id} withBorder radius="lg" p="md" style={{ background: 'white' }}>
                            <Group justify="space-between" align="flex-start" wrap="nowrap">
                              <Box style={{ flex: 1, minWidth: 0 }}>
                                <Group gap="xs" mb={4}>
                                  <Text fw={800} size="sm">{item.designNumber}</Text>
                                  <Badge size="xs" variant="light" color="gray">{item.quantity} 樘</Badge>
                                </Group>
                                <Text size="xs" c="dimmed" mb={8}>{item.width} × {item.height} mm</Text>
                                <SimpleGrid cols={{ base: 2, md: 4 }} spacing="xs">
                                  <Paper withBorder radius="md" p="xs"><Text size="10px" c="dimmed">成本单价</Text><Text fw={800} c="teal">¥{Number(item.unitPrice || 0).toFixed(2)}</Text></Paper>
                                  <Paper withBorder radius="md" p="xs"><Text size="10px" c="dimmed">销售单价</Text><Text fw={800} c="blue">¥{Number(item.unitRetailPrice || 0).toFixed(2)}</Text></Paper>
                                  <Paper withBorder radius="md" p="xs"><Text size="10px" c="dimmed">成本合价</Text><Text fw={800}>¥{Number(item.totalPrice || 0).toFixed(2)}</Text></Paper>
                                  <Paper withBorder radius="md" p="xs"><Text size="10px" c="dimmed">销售合价</Text><Text fw={800} c="blue">¥{Number(item.totalRetailPrice || 0).toFixed(2)}</Text></Paper>
                                </SimpleGrid>
                              </Box>
                              <Stack gap={6} w={180}>
                                {(item.allocations || []).length > 0 ? (
                                  (item.allocations || []).map((allocation: any) => (
                                    <Paper key={`${item.id}-${allocation.label}`} withBorder radius="md" px="xs" py={6} style={{ background: 'rgba(248,250,252,0.9)' }}>
                                      <Group justify="space-between" align="center" wrap="nowrap">
                                        <Text size="xs" fw={700}>{allocation.label}</Text>
                                        <Badge size="sm" variant="light" color="teal">{allocation.quantity}</Badge>
                                      </Group>
                                    </Paper>
                                  ))
                                ) : (
                                  <Text size="xs" c="dimmed">无分配</Text>
                                )}
                              </Stack>
                            </Group>
                          </Paper>
                        ))}
                      </Stack>
                    )}
                  </Paper>
                );
              })}
            </Stack>
          ) : (
            <Table striped highlightOnHover verticalSpacing="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>类型</Table.Th>
                  <Table.Th>设计编号</Table.Th>
                  <Table.Th>尺寸</Table.Th>
                  <Table.Th>数量</Table.Th>
                  <Table.Th>成本单价</Table.Th>
                  <Table.Th>销售单价</Table.Th>
                  <Table.Th>成本合价</Table.Th>
                  <Table.Th>销售合价</Table.Th>
                  <Table.Th>分配标签</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {filteredSheetItems.slice(0, 24).map((item: any) => (
                  <Table.Tr key={item.id}>
                    <Table.Td>{item.windowType || '-'}</Table.Td>
                    <Table.Td fw={700}>{item.designNumber}</Table.Td>
                    <Table.Td>{item.width} × {item.height}</Table.Td>
                    <Table.Td>{item.quantity}</Table.Td>
                    <Table.Td c="teal.7">¥{Number(item.unitPrice || 0).toFixed(2)}</Table.Td>
                    <Table.Td c="blue.7">¥{Number(item.unitRetailPrice || 0).toFixed(2)}</Table.Td>
                    <Table.Td fw={700}>¥{Number(item.totalPrice || 0).toFixed(2)}</Table.Td>
                    <Table.Td fw={700} c="blue.7">¥{Number(item.totalRetailPrice || 0).toFixed(2)}</Table.Td>
                    <Table.Td>
                      <Stack gap={6}>
                        {(item.allocations || []).length > 0 ? (
                          (item.allocations || []).map((allocation: any) => (
                            <Paper key={`${item.id}-${allocation.label}`} withBorder radius="md" px="xs" py={6} style={{ background: 'rgba(248,250,252,0.9)' }}>
                              <Group justify="space-between" align="center" wrap="nowrap">
                                <Text size="xs" fw={700}>{allocation.label}</Text>
                                <Badge size="sm" variant="light" color="teal">{allocation.quantity}</Badge>
                              </Group>
                            </Paper>
                          ))
                        ) : (
                          <Text size="xs" c="dimmed">无分配</Text>
                        )}
                      </Stack>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}

          {(filteredSheetItems.length || 0) > 24 && (
            <Text size="xs" c="dimmed">当前筛选下仅展示前 24 条窗型项，完整数据可通过导出查看。</Text>
          )}
          {filteredSheetItems.length === 0 && (
            <Center py="xl">
              <Text size="sm" c="dimmed">当前筛选条件下没有匹配的设计编号</Text>
            </Center>
          )}
        </Paper>
      </Stack>
    ) : (
      <Center py="xl">
        <Stack align="center" gap="xs">
          <IconFiles size={48} color="var(--mantine-color-gray-4)" />
          <Text c="dimmed">正在加载工作表详情...</Text>
        </Stack>
      </Center>
    )}
  </Modal>
);
