import { ActionIcon, Badge, Box, Center, Group, Paper, ScrollArea, Select, SegmentedControl, SimpleGrid, Stack, Text } from '@mantine/core';
import { IconLayoutGrid, IconSortDescending, IconTag, IconX } from '@tabler/icons-react';

export const QuotationInsightsPanel = ({
  breakdownView,
  setBreakdownView,
  currentBreakdownHint,
  currentBreakdownTitle,
  breakdownHasData,
  currentBreakdownSummary,
  selectedSheetSummary,
  selectedBreakdownBucket,
  setSelectedBreakdownBucket,
  breakdownDetailsOpen,
  setBreakdownDetailsOpen,
  selectedBreakdownItems,
  breakdownBucketMeta,
  selectedConfigName,
  setSelectedConfigName,
  configSourcesOpen,
  setConfigSourcesOpen,
  configSourceSheetFilter,
  setConfigSourceSheetFilter,
  configSourceTypeFilter,
  setConfigSourceTypeFilter,
  configSourceSort,
  setConfigSourceSort,
  configSourceSheetOptions,
  configSourceTypeOptions,
  visibleConfigSources,
  openSheetDetailFromConfigSource,
  topCostSheets,
  selectedSheetId,
  setSelectedSheetId,
  sheetRateMetaMap,
}: any) => (
  <SimpleGrid cols={{ base: 1, xl: 2 }} spacing="md" mb="md">
    <Paper withBorder radius="xl" p="md">
      <Group justify="space-between" mb="sm">
        <Box>
          <Text fw={800} size="sm">成本构成</Text>
          <Text size="xs" c="dimmed">{currentBreakdownHint}</Text>
        </Box>
        <SegmentedControl
          size="xs"
          value={breakdownView}
          onChange={(value) => setBreakdownView(value as 'project' | 'sheet')}
          data={[
            { value: 'project', label: '项目总占比' },
            { value: 'sheet', label: '单张工作表' },
          ]}
        />
      </Group>

      <Group justify="space-between" mb="sm" wrap="wrap">
        <Badge variant="light" color={breakdownView === 'sheet' ? 'blue' : 'teal'}>{currentBreakdownTitle}</Badge>
        {breakdownView === 'sheet' && !selectedSheetSummary && (
          <Text size="xs" c="dimmed">先点击右侧任意工作表卡片</Text>
        )}
      </Group>

      {(breakdownView === 'project' ? breakdownHasData : currentBreakdownSummary.length > 0) ? (
        <Stack gap="sm">
          <ScrollArea h={280} className="soft-scroll">
            <Stack gap="xs" pr="xs">
              {currentBreakdownSummary.map((item: any) => (
                <Paper
                  key={item.key}
                  withBorder
                  radius="lg"
                  p="sm"
                  onClick={() => {
                    setSelectedBreakdownBucket(item.key);
                    setBreakdownDetailsOpen(true);
                  }}
                  style={{
                    cursor: 'pointer',
                    background: selectedBreakdownBucket === item.key ? 'rgba(20,184,166,0.06)' : 'white',
                    borderColor: selectedBreakdownBucket === item.key ? 'rgba(13,148,136,0.35)' : undefined,
                  }}
                >
                  <Group justify="space-between" align="flex-start" wrap="nowrap">
                    <Box>
                      <Badge color={item.color} variant="light">{item.label}</Badge>
                      <Text size="xs" c="dimmed" mt={6}>
                        成本占比 {item.costShare.toFixed(1)}% · 单方成本 ¥{item.costPerSqm.toFixed(0)}/㎡
                      </Text>
                    </Box>
                    <Stack gap={2} align="flex-end">
                      <Text size="sm" c="dimmed">成本 <Text span fw={800} c="teal.7">¥{item.cost.toFixed(0)}</Text></Text>
                      <Text size="sm" c="dimmed">销售 <Text span fw={800} c="blue.7">¥{item.retail.toFixed(0)}</Text></Text>
                    </Stack>
                  </Group>
                </Paper>
              ))}
            </Stack>
          </ScrollArea>

          {breakdownDetailsOpen && (
            <Paper withBorder radius="lg" p="sm">
              <Group justify="space-between" mb="xs">
                <Group gap="xs">
                  <Text fw={800} size="sm">具体配置</Text>
                  {selectedBreakdownBucket && (
                    <Badge color={breakdownBucketMeta[selectedBreakdownBucket].color} variant="light">
                      {breakdownBucketMeta[selectedBreakdownBucket].label}
                    </Badge>
                  )}
                  <Badge variant="dot" color="gray">{selectedBreakdownItems.length} 项</Badge>
                </Group>
                <ActionIcon size="sm" variant="subtle" color="gray" onClick={() => setBreakdownDetailsOpen(false)}>
                  <IconX size={14} />
                </ActionIcon>
              </Group>

              {selectedBreakdownItems.length > 0 ? (
                <ScrollArea h={180} className="soft-scroll">
                  <Stack gap="xs" pr="xs">
                    {selectedBreakdownItems.map((item: any) => (
                      <Paper
                        key={item.name}
                        withBorder
                        radius="md"
                        p="xs"
                        onClick={() => {
                          setSelectedConfigName(item.name);
                          setConfigSourcesOpen(true);
                        }}
                        style={{
                          cursor: 'pointer',
                          background: selectedConfigName === item.name ? 'rgba(20,184,166,0.06)' : 'white',
                          borderColor: selectedConfigName === item.name ? 'rgba(13,148,136,0.30)' : undefined,
                        }}
                      >
                        <Group justify="space-between" align="flex-start" wrap="nowrap">
                          <Box style={{ flex: 1, minWidth: 0 }}>
                            <Text size="sm" fw={700} truncate>{item.name}</Text>
                            <Text size="10px" c="dimmed" mt={4}>
                              {selectedBreakdownBucket ? `${breakdownBucketMeta[selectedBreakdownBucket].label}内占比 ${item.share.toFixed(1)}%` : `分项内占比 ${item.share.toFixed(1)}%`}
                              {` · 当前${breakdownView === 'sheet' ? '工作表' : '项目'}占比 ${item.overallShare.toFixed(1)}%`}
                            </Text>
                          </Box>
                          <Stack gap={0} align="flex-end">
                            <Text size="sm" fw={800} c="teal.7">¥{item.cost.toFixed(0)}</Text>
                            <Text size="10px" c="dimmed">销售 ¥{item.retail.toFixed(0)}</Text>
                          </Stack>
                        </Group>
                      </Paper>
                    ))}
                  </Stack>
                </ScrollArea>
              ) : (
                <Center py="md"><Text size="sm" c="dimmed">当前分项下还没有具体配置</Text></Center>
              )}
            </Paper>
          )}

          {configSourcesOpen && selectedConfigName && (
            <Paper withBorder radius="lg" p="sm">
              <Group justify="space-between" mb="xs">
                <Group gap="xs">
                  <Text fw={800} size="sm">配置来源</Text>
                  <Badge variant="light" color="blue">{selectedConfigName}</Badge>
                  <Badge variant="dot" color="gray">{visibleConfigSources.length} 条</Badge>
                </Group>
                <ActionIcon size="sm" variant="subtle" color="gray" onClick={() => setConfigSourcesOpen(false)}>
                  <IconX size={14} />
                </ActionIcon>
              </Group>

              <Group mb="sm" grow>
                <Select
                  size="xs"
                  value={configSourceSheetFilter}
                  onChange={(value) => setConfigSourceSheetFilter(value || 'all')}
                  data={configSourceSheetOptions}
                  leftSection={<IconLayoutGrid size={14} />}
                />
                <Select
                  size="xs"
                  value={configSourceTypeFilter}
                  onChange={(value) => setConfigSourceTypeFilter(value || 'all')}
                  data={configSourceTypeOptions}
                  leftSection={<IconTag size={14} />}
                />
                <Select
                  size="xs"
                  value={configSourceSort}
                  onChange={(value) => setConfigSourceSort((value as 'cost_desc' | 'quantity_desc' | 'sheet_asc') || 'cost_desc')}
                  data={[
                    { value: 'cost_desc', label: '按金额倒序' },
                    { value: 'quantity_desc', label: '按数量倒序' },
                    { value: 'sheet_asc', label: '按工作表排序' },
                  ]}
                  leftSection={<IconSortDescending size={14} />}
                />
              </Group>

              {visibleConfigSources.length > 0 ? (
                <ScrollArea h={220} className="soft-scroll">
                  <Stack gap="xs" pr="xs">
                    {visibleConfigSources.map((item: any) => (
                      <Paper
                        key={`${item.sheetName}-${item.designNumber}-${item.windowType}`}
                        withBorder
                        radius="md"
                        p="xs"
                        onClick={() => openSheetDetailFromConfigSource(item)}
                        style={{ cursor: 'pointer', background: 'rgba(255,255,255,0.92)' }}
                      >
                        <Group justify="space-between" align="flex-start" wrap="nowrap">
                          <Box style={{ minWidth: 0, flex: 1 }}>
                            <Group gap={6} wrap="wrap" mb={4}>
                              {breakdownView === 'project' && <Badge size="xs" variant="light" color="teal">{item.sheetName}</Badge>}
                              <Badge size="xs" variant="light" color="gray">{item.windowType}</Badge>
                              <Badge size="xs" variant="dot" color="blue">{item.designNumber}</Badge>
                            </Group>
                            <Text size="10px" c="dimmed">数量 {item.quantity} · 来源占比 {item.share.toFixed(1)}% · 点击查看对应工作表</Text>
                          </Box>
                          <Stack gap={0} align="flex-end">
                            <Text size="sm" fw={800} c="teal.7">¥{item.cost.toFixed(0)}</Text>
                            <Text size="10px" c="dimmed">销售 ¥{item.retail.toFixed(0)}</Text>
                          </Stack>
                        </Group>
                      </Paper>
                    ))}
                  </Stack>
                </ScrollArea>
              ) : (
                <Center py="md"><Text size="sm" c="dimmed">当前筛选条件下没有来源明细</Text></Center>
              )}
            </Paper>
          )}
        </Stack>
      ) : (
        <Center py="xl">
          <Stack gap={4} align="center">
            <Text size="sm" c="dimmed">{breakdownView === 'sheet' ? '当前还没有选中工作表，或该工作表暂无构成明细' : '当前项目还没有可汇总的构成明细'}</Text>
            <Text size="xs" c="dimmed">重新保存一次新的工作表后，这里会开始累计主材、玻璃、五金和辅材。</Text>
          </Stack>
        </Center>
      )}
    </Paper>

    <Paper withBorder radius="xl" p="md" style={{ background: 'linear-gradient(180deg, rgba(239,246,255,0.72) 0%, rgba(255,255,255,1) 100%)' }}>
      <Text fw={800} size="sm" mb="sm">成本预警</Text>
      <Stack gap="sm">
        {topCostSheets.length > 0 ? (
          <ScrollArea h={280} className="soft-scroll">
            <Stack gap="sm" pr="xs">
              {topCostSheets.map((sheet: any, index: number) => (
                <Paper
                  key={sheet.id}
                  withBorder
                  radius="lg"
                  p="sm"
                  onClick={() => {
                    setSelectedSheetId(sheet.id || null);
                    setBreakdownView('sheet');
                  }}
                  style={{
                    background: selectedSheetId === sheet.id
                      ? 'rgba(59, 130, 246, 0.10)'
                      : (sheetRateMetaMap.get(sheet.id || '')?.isOverride ? 'rgba(249, 115, 22, 0.08)' : 'rgba(255,255,255,0.88)'),
                    borderColor: selectedSheetId === sheet.id
                      ? 'rgba(59, 130, 246, 0.30)'
                      : (sheetRateMetaMap.get(sheet.id || '')?.isOverride ? 'rgba(249, 115, 22, 0.28)' : undefined),
                    cursor: 'pointer',
                  }}
                >
                  <Group justify="space-between" align="flex-start" wrap="nowrap">
                    <Box style={{ minWidth: 0, flex: 1 }}>
                      <Group gap="xs" mb={4}>
                        <Badge variant="filled" color={index === 0 ? 'red' : index === 1 ? 'orange' : 'yellow'}>TOP {index + 1}</Badge>
                        <Text fw={800} size="sm" truncate>{sheet.sheetName}</Text>
                        {sheetRateMetaMap.get(sheet.id || '')?.isOverride && (
                          <Badge variant="light" color="orange">单独费率</Badge>
                        )}
                      </Group>
                      <Text size="xs" c="dimmed">
                        成本占项目 {sheet.costShare.toFixed(1)}% · 毛利率 {sheet.grossMargin.toFixed(1)}% · 单方 ¥{(Number(sheet.totalCost || 0) / Math.max(Number(sheet.totalArea || 0), 1)).toFixed(0)}/㎡
                      </Text>
                    </Box>
                    <Stack gap={2} align="flex-end">
                      <Text size="sm" fw={800} c="teal.7">¥{Number(sheet.totalCost || 0).toFixed(0)}</Text>
                      <Text size="xs" c="dimmed">{Number(sheet.totalArea || 0).toFixed(2)} ㎡</Text>
                    </Stack>
                  </Group>
                </Paper>
              ))}
            </Stack>
          </ScrollArea>
        ) : (
          <Text size="sm" c="dimmed">当前项目还没有工作表数据。</Text>
        )}

        <Paper withBorder radius="lg" p="sm" style={{ background: 'rgba(255,255,255,0.88)' }}>
          <Stack gap={6}>
            <Text size="sm">1. 先看主材型材和玻璃面材占比，通常这两项最能决定项目底价。</Text>
            <Text size="sm">2. 再看成本最高的工作表，优先复核其组合、尺寸和五金配置。</Text>
            <Text size="sm">3. 如果分项汇总为空，说明这些工作表还是旧数据，重新保存一次即可补齐。</Text>
          </Stack>
        </Paper>
      </Stack>
    </Paper>
  </SimpleGrid>
);
