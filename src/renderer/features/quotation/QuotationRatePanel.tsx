import { Badge, Box, Button, Group, NumberInput, Paper, ScrollArea, SegmentedControl, SimpleGrid, Stack, Text } from '@mantine/core';

export const QuotationRatePanel = ({
  rateScope,
  onRateScopeChange,
  currentRateTitle,
  currentRateSettings,
  selectedSheetSummary,
  enabledSheetRates,
  projectRateSummary,
  sheetRateSummary,
  onToggleRateEnabled,
  onChangeRatePercentage,
  onSave,
  onResetSheetRates,
}: {
  rateScope: 'project' | 'sheet';
  onRateScopeChange: (value: 'project' | 'sheet') => void;
  currentRateTitle: string;
  currentRateSettings: Array<{ rateId: string; name: string; percentage: number; enabled: boolean }>;
  selectedSheetSummary: any;
  enabledSheetRates: Array<any>;
  projectRateSummary: { text: string; totalPercentage: number };
  sheetRateSummary: { text: string; totalPercentage: number };
  onToggleRateEnabled: (rateId: string, enabled: boolean) => void;
  onChangeRatePercentage: (rateId: string, value: number) => void;
  onSave: () => void;
  onResetSheetRates: () => void;
}) => (
  <Paper withBorder radius="xl" p="md" mb="md">
    <Group justify="space-between" align="flex-start" mb="sm" wrap="wrap">
      <Box>
        <Text fw={800} size="sm">费率使用</Text>
        <Text size="xs" c="dimmed">整体可统一设置；单张工作表如果单独设置，会优先覆盖整体费率。</Text>
      </Box>
      <SegmentedControl
        size="xs"
        value={rateScope}
        onChange={(value) => onRateScopeChange(value as 'project' | 'sheet')}
        data={[
          { value: 'project', label: '整体费率' },
          { value: 'sheet', label: '工作表费率' },
        ]}
      />
    </Group>

    <Group justify="space-between" mb="sm" wrap="wrap">
      <Badge variant="light" color={rateScope === 'sheet' ? 'blue' : 'teal'}>{currentRateTitle}</Badge>
      {selectedSheetSummary && enabledSheetRates.length === 0 && (
        <Text size="xs" c="dimmed">当前工作表未单独设置时，会自动沿用整体费率。</Text>
      )}
    </Group>

    <SimpleGrid cols={{ base: 1, xl: 2 }} spacing="md">
      <Paper withBorder radius="lg" p="sm">
        <ScrollArea h={220} className="soft-scroll">
          <Stack gap="xs" pr="xs">
            {currentRateSettings.map((rate) => (
              <Paper key={`${rateScope}-${rate.rateId}`} withBorder radius="md" p="sm">
                <Group justify="space-between" align="center" wrap="nowrap">
                  <Box style={{ minWidth: 0, flex: 1 }}>
                    <Text fw={700} size="sm" truncate>{rate.name}</Text>
                    <Text size="xs" c="dimmed">按基础报价加成 {rate.percentage.toFixed(2)}%</Text>
                  </Box>
                  <Group gap="xs" wrap="nowrap">
                    <SegmentedControl
                      size="xs"
                      value={rate.enabled ? 'on' : 'off'}
                      onChange={(value) => onToggleRateEnabled(rate.rateId, value === 'on')}
                      data={[
                        { value: 'on', label: '启用' },
                        { value: 'off', label: '关闭' },
                      ]}
                    />
                    <NumberInput
                      size="xs"
                      value={rate.percentage}
                      onChange={(value) => onChangeRatePercentage(rate.rateId, typeof value === 'number' ? value : 0)}
                      min={0}
                      step={0.5}
                      decimalScale={2}
                      w={100}
                    />
                  </Group>
                </Group>
              </Paper>
            ))}
            {currentRateSettings.length === 0 && <Text size="sm" c="dimmed">还没有费率模板，请先去左侧“费率设置”新增。</Text>}
          </Stack>
        </ScrollArea>
      </Paper>

      <Paper withBorder radius="lg" p="sm" style={{ background: 'linear-gradient(180deg, rgba(248,250,252,0.92) 0%, rgba(255,255,255,1) 100%)' }}>
        <Stack gap="sm">
          <Box>
            <Text fw={800} size="sm">当前生效</Text>
            <Text size="xs" c="dimmed">整体：{projectRateSummary.text}</Text>
            <Text size="xs" c="dimmed">整体合计：{projectRateSummary.totalPercentage.toFixed(2)}%</Text>
            <Text size="xs" c="dimmed">工作表：{selectedSheetSummary ? (enabledSheetRates.length > 0 ? sheetRateSummary.text : '未单独设置') : '请先选中工作表'}</Text>
            {selectedSheetSummary && enabledSheetRates.length > 0 && (
              <Text size="xs" c="dimmed">工作表合计：{sheetRateSummary.totalPercentage.toFixed(2)}%</Text>
            )}
          </Box>
          <Group gap="xs">
            <Button size="xs" onClick={onSave}>保存当前费率</Button>
            {rateScope === 'sheet' && (
              <Button size="xs" variant="default" onClick={onResetSheetRates} disabled={!selectedSheetSummary}>
                恢复用整体费率
              </Button>
            )}
          </Group>
        </Stack>
      </Paper>
    </SimpleGrid>
  </Paper>
);
