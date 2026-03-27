import React, { startTransition, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Center,
  Divider,
  FileButton,
  Group,
  Loader,
  Modal,
  Paper,
  Progress,
  ScrollArea,
  Select,
  Stack,
  Tabs,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { IconDeviceFloppy, IconFileCode, IconFocusCentered, IconPlus, IconSettings, IconTrash } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import { useNavigate } from 'react-router-dom';

import { DxfViewer, DxfViewerRef } from '../features/DxfViewer/DxfViewer';
import { WindowList } from '../features/WindowList/WindowList';
import { useDxfProcessor } from '../hooks/useDxfProcessor';
import { useCreateStandard, useStandards } from '../hooks/useWindowApi';
import { useWindowStore } from '../stores/windowStore';
import { WindowItem } from '../../shared/schemas';
import { PageScaffold } from '../components/ui/PageScaffold';
import {
  StandardEditorModal,
  StandardFormValue,
  buildPatternFromPrefixes,
  defaultStandardForm,
} from '../features/standards/StandardEditorModal';
import { useShallow } from 'zustand/react/shallow';

const extractPrefixLabel = (pattern: string) => {
  const multiMatch = pattern.match(/^\^\(\?:([^)]+)\)/);
  if (multiMatch) return multiMatch[1].replace(/\|/g, ',');

  const singleMatch = pattern.match(/^\^?([A-Z]+)/i);
  return singleMatch?.[1] || 'C';
};

const AnalysisPage = () => {
  const viewerRef = useRef<DxfViewerRef>(null);
  const navigate = useNavigate();
  const { processedResult, pendingWindows, fileName, processDxf, rerunRecognition, isProcessing, progress, saveToDb, clear } = useDxfProcessor();
  const { data: standards = [] } = useStandards();
  const createStandard = useCreateStandard();
  const { activeWindowId, selectedStandardId, identRules, setSelectedStandardId, setIdentRules, setPricingDraft, addPricingQueueItem } = useWindowStore(useShallow((state) => ({
    activeWindowId: state.activeWindowId,
    selectedStandardId: state.selectedStandardId,
    identRules: state.identRules,
    setSelectedStandardId: state.setSelectedStandardId,
    setIdentRules: state.setIdentRules,
    setPricingDraft: state.setPricingDraft,
    addPricingQueueItem: state.addPricingQueueItem,
  })));

  const [saveOpened, setSaveOpened] = useState(false);
  const [createStandardOpened, setCreateStandardOpened] = useState(false);
  const [drawingTitle, setDrawingTitle] = useState('');
  const [importKey, setImportKey] = useState(0);
  const [enabledExcludedLayers, setEnabledExcludedLayers] = useState<string[]>([]);
  const [focusedMarker, setFocusedMarker] = useState<{ text: string; x: number; y: number; layer: string } | null>(null);
  const [showRecognitionReport, setShowRecognitionReport] = useState(false);
  const [showWindowList, setShowWindowList] = useState(false);
  const [processingExcludedLayer, setProcessingExcludedLayer] = useState<string | null>(null);
  const lastMarkerFocusRef = useRef<{ key: string; at: number } | null>(null);
  const lastExcludedToggleRef = useRef<{ key: string; at: number } | null>(null);

  const deferredPendingWindows = useDeferredValue(pendingWindows);
  const deferredRecognitionSummary = useDeferredValue(processedResult?.recognitionSummary ?? null);

  const activeWindow = useMemo(
    () => deferredPendingWindows.find((item) => item.id === activeWindowId) || deferredPendingWindows[0] || null,
    [activeWindowId, deferredPendingWindows],
  );
  const realWindows = useMemo(
    () => deferredPendingWindows.filter((item) => item.category === '真窗'),
    [deferredPendingWindows],
  );
  const recognitionSummary = deferredRecognitionSummary;

  useEffect(() => {
    setShowRecognitionReport(false);
    setShowWindowList(false);
    if (!processedResult) return;

    const reportTimer = window.setTimeout(() => {
      setShowRecognitionReport(true);
    }, 80);
    const listTimer = window.setTimeout(() => {
      setShowWindowList(true);
    }, 220);

    return () => {
      window.clearTimeout(reportTimer);
      window.clearTimeout(listTimer);
    };
  }, [processedResult]);

  const applyStandard = useCallback((id: string | null) => {
    const standard = standards.find((item: any) => item.id === id);
    if (!standard) return;
    setSelectedStandardId(standard.id);
    setIdentRules({
      windowPrefix: extractPrefixLabel(standard.windowPattern),
      windowPattern: standard.windowPattern,
      wallAreaThreshold: standard.wallAreaThreshold,
      minWindowArea: standard.minWindowArea ?? 0.08,
      minSideLength: standard.minSideLength ?? 180,
      labelMaxDistance: standard.labelMaxDistance ?? 600,
      layerIncludeKeywords: standard.layerIncludeKeywords ?? '窗,window,win',
      layerExcludeKeywords: standard.layerExcludeKeywords ?? '标注,text,dim,轴网,图框,title',
    });
  }, [setIdentRules, setSelectedStandardId, standards]);

  const confirmImport = (file: File) => {
    setEnabledExcludedLayers([]);
    setFocusedMarker(null);
    processDxf(file);
  };

  const confirmClear = () => {
    modals.openConfirmModal({
      title: '清空当前图纸',
      centered: true,
      children: <Text size="sm">会移除当前识别结果和未保存清单。</Text>,
      labels: { confirm: '确认清空', cancel: '取消' },
      confirmProps: { color: 'red' },
      onConfirm: () => {
        setEnabledExcludedLayers([]);
        setFocusedMarker(null);
        setProcessingExcludedLayer(null);
        clear();
        setImportKey((value) => value + 1);
      },
    });
  };

  const handleSave = async () => {
    if (!drawingTitle.trim()) return;
    await saveToDb(drawingTitle.trim());
    setSaveOpened(false);
    setDrawingTitle('');
  };

  const focusUnmatchedMarker = useCallback((marker: { text: string; x: number; y: number; layer: string }) => {
    const markerKey = `${marker.text}:${marker.x}:${marker.y}`;
    const now = Date.now();
    if (lastMarkerFocusRef.current?.key === markerKey && now - lastMarkerFocusRef.current.at < 250) {
      return;
    }
    lastMarkerFocusRef.current = { key: markerKey, at: now };
    if (focusedMarker?.text === marker.text && focusedMarker?.x === marker.x && focusedMarker?.y === marker.y) {
      return;
    }
    startTransition(() => {
      setFocusedMarker(marker);
    });
    viewerRef.current?.zoomToMarker(marker);
  }, [focusedMarker]);

  const toggleExcludedLayer = useCallback(async (layer: string) => {
    if (processingExcludedLayer) return;
    const now = Date.now();
    if (lastExcludedToggleRef.current?.key === layer && now - lastExcludedToggleRef.current.at < 300) {
      return;
    }
    lastExcludedToggleRef.current = { key: layer, at: now };
    const nextLayers = enabledExcludedLayers.includes(layer)
      ? enabledExcludedLayers.filter((item) => item !== layer)
      : [...enabledExcludedLayers, layer];

    startTransition(() => {
      setEnabledExcludedLayers(nextLayers);
      setFocusedMarker(null);
    });
    setProcessingExcludedLayer(layer);
    try {
      await rerunRecognition(nextLayers);
    } finally {
      setProcessingExcludedLayer(null);
    }
  }, [enabledExcludedLayers, processingExcludedLayer, rerunRecognition]);

  const handleCreateStandard = useCallback(async (form: StandardFormValue) => {
    if (!form.name.trim()) {
      notifications.show({ title: '请输入名称', message: '规则名称不能为空。', color: 'red' });
      return;
    }

    const created = await createStandard.mutateAsync({
      name: form.name.trim(),
      windowPattern: buildPatternFromPrefixes(form.prefix, form.mode),
      doorPattern: 'M\\d{4}',
      wallAreaThreshold: form.wallAreaThreshold,
      minWindowArea: form.minWindowArea,
      minSideLength: form.minSideLength,
      labelMaxDistance: form.labelMaxDistance,
      layerIncludeKeywords: form.layerIncludeKeywords,
      layerExcludeKeywords: form.layerExcludeKeywords,
    });

    const createdStandard = created?.data ?? created;
    if (createdStandard?.id) {
      applyStandard(createdStandard.id);
    }
    notifications.show({ title: '已保存', message: '识别标准已创建并选中', color: 'teal' });
    setCreateStandardOpened(false);
  }, [
    applyStandard,
    createStandard,
  ]);

  return (
    <PageScaffold
      title="图纸识别"
      description="顶部切换识别规则，导入 DXF 后直接识别。左侧只保留结果检查，不再把规则列表铺满。"
      actions={
        <Group gap="sm" align="end">
          <Select
            data={standards.map((item: any) => ({ value: item.id, label: item.name }))}
            value={selectedStandardId}
            onChange={applyStandard}
            placeholder="选择识别规则"
            leftSection={<IconSettings size={14} />}
            w={240}
            styles={{ input: { minHeight: 36 } }}
          />
          <Button variant="default" leftSection={<IconPlus size={16} />} onClick={() => setCreateStandardOpened(true)}>
            新建规则
          </Button>
          <Button variant="default" leftSection={<IconTrash size={16} />} onClick={confirmClear} disabled={!processedResult && pendingWindows.length === 0}>
            清空
          </Button>
          <FileButton key={importKey} onChange={(file) => file && confirmImport(file)} accept=".dxf">
            {(props) => (
              <Button {...props} leftSection={<IconFileCode size={16} />} loading={isProcessing}>
                导入 DXF
              </Button>
            )}
          </FileButton>
        </Group>
      }
    >
      <Box h="100%" style={{ display: 'grid', gridTemplateColumns: '420px minmax(0, 1fr)', gap: 12 }}>
        <Paper withBorder radius={12} p="md" style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
          <Stack gap="md" style={{ flex: 1, minHeight: 0 }}>
            <Box>
              <Group justify="space-between" align="center">
                <Box>
                  <Text size="sm" c="dimmed">识别结果</Text>
                  <Title order={4} mt={4}>{fileName || '尚未导入图纸'}</Title>
                </Box>
                <Badge>{pendingWindows.length} 项</Badge>
              </Group>
              <Text size="sm" c="dimmed" mt={8}>
                左侧只显示识别后的内容。点击条目，右侧会自动定位到对应窗型。
              </Text>
            </Box>

            <Tabs defaultValue="windows" keepMounted={false} style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <Tabs.List grow>
                <Tabs.Tab value="windows">识别结果</Tabs.Tab>
                <Tabs.Tab value="report" rightSection={recognitionSummary ? (
                  <Badge size="xs" variant="light" color={recognitionSummary.unmatchedLabels.length > 0 ? 'yellow' : 'teal'}>
                    {recognitionSummary.matchedLabels} / {recognitionSummary.totalLabels}
                  </Badge>
                ) : null}>识别报告</Tabs.Tab>
              </Tabs.List>

              <Tabs.Panel value="windows" pt="sm" style={{ flex: 1, minHeight: 0 }}>
                <Stack gap="sm" style={{ height: '100%', minHeight: 0 }}>
                  <Box style={{ flex: 1, minHeight: 0 }}>
                    {showWindowList ? (
                      <WindowList
                        windows={deferredPendingWindows as WindowItem[]}
                        labelCodeStats={recognitionSummary?.labelCodeStats ?? []}
                        onDelete={() => undefined}
                        onEdit={() => undefined}
                        onFocus={(item) => viewerRef.current?.zoomToWindow(item)}
                      />
                    ) : processedResult ? (
                      <Paper withBorder radius={12} p="sm">
                        <Text size="xs" c="dimmed">窗列表加载中...</Text>
                      </Paper>
                    ) : null}
                  </Box>

                  {deferredPendingWindows.length > 0 ? (
                    <Group grow>
                      <Button
                        variant="default"
                        onClick={() => {
                          if (!activeWindow) return;
                          setPricingDraft({
                            sourceName: activeWindow.name,
                            width: activeWindow.width,
                            height: activeWindow.height,
                            quantity: 1,
                          });
                          navigate('/pricing');
                        }}
                      >
                        带入报价
                      </Button>
                      <Button
                        variant="light"
                        onClick={() => {
                          if (!activeWindow) return;
                          addPricingQueueItem({
                            id: activeWindow.id || crypto.randomUUID(),
                            sourceName: activeWindow.name,
                            width: activeWindow.width,
                            height: activeWindow.height,
                            quantity: 1,
                          });
                          navigate('/pricing');
                        }}
                      >
                        加入准备区
                      </Button>
                      <Button
                        leftSection={<IconDeviceFloppy size={16} />}
                        onClick={() => {
                          setDrawingTitle(fileName.replace('.dxf', ''));
                          setSaveOpened(true);
                        }}
                      >
                        保存结果
                      </Button>
                    </Group>
                  ) : null}
                </Stack>
              </Tabs.Panel>

              <Tabs.Panel value="report" pt="sm" style={{ flex: 1, minHeight: 0 }}>
                {recognitionSummary && showRecognitionReport ? (
                  <Paper withBorder radius={12} p="sm" bg="#f8fafc" style={{ height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                    <Stack gap="xs" style={{ flex: 1, minHeight: 0 }}>
                      <Text size="xs" c="dimmed">
                        识别结果 {recognitionSummary.matchedLabels} 项 / 候选编号 {recognitionSummary.totalLabels} 项
                      </Text>
                      <Tabs defaultValue="diagnostic" keepMounted={false} style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                        <Tabs.List grow>
                          <Tabs.Tab value="diagnostic">诊断结果</Tabs.Tab>
                          <Tabs.Tab value="layers">识别图层</Tabs.Tab>
                          <Tabs.Tab value="excluded">被排除图层</Tabs.Tab>
                          <Tabs.Tab value="unmatched">未匹配编号</Tabs.Tab>
                        </Tabs.List>

                        <Tabs.Panel value="diagnostic" pt="xs">
                          <Paper withBorder radius={10} p="xs" bg="#fff">
                            <Stack gap="xs">
                              <Group justify="space-between" align="center">
                                <Text fw={600} size="xs">诊断结果</Text>
                                <Badge variant="light" color={recognitionSummary.matchedLabels > 0 ? 'teal' : 'yellow'}>
                                  {recognitionSummary.matchedLabels > 0 ? '有结果' : '需检查'}
                                </Badge>
                              </Group>
                              <Text size="xs">{recognitionSummary.diagnostic.reason}</Text>
                              <Text size="xs" c="dimmed">
                                原始文字 {recognitionSummary.diagnostic.rawTextCount} 条 / 图层筛后编号 {recognitionSummary.diagnostic.filteredLabelCount} 条 / 规则命中 {recognitionSummary.diagnostic.regexMatchedTextCount} 条
                              </Text>
                              <Text size="xs" c="dimmed">
                                图层筛后几何 {recognitionSummary.diagnostic.filteredEntityCount} 项 / 窗框候选 {recognitionSummary.diagnostic.loopCandidateCount} 个 / 最终识别 {recognitionSummary.matchedLabels} 个
                              </Text>
                              <Text size="xs" c="dimmed">
                                最小边长 {identRules.minSideLength} / 最小窗面积 {identRules.minWindowArea} / 最大匹配距离 {identRules.labelMaxDistance}
                              </Text>
                              <Box>
                                <Text size="xs" fw={600} mb={4}>原图对比</Text>
                                <ScrollArea h={180} type="auto">
                                  <Stack gap={4}>
                                    {recognitionSummary.labelCodeStats.length > 0 ? recognitionSummary.labelCodeStats.map((item) => (
                                      <Paper key={item.code} withBorder p={6} radius="sm" bg={item.rawCount > item.matchedCount ? '#fff8e8' : '#eefbf3'}>
                                        <Group justify="space-between" align="center" wrap="nowrap">
                                          <Text size="xs" ff="monospace" fw={700}>{item.code}</Text>
                                          <Text size="xs" c={item.rawCount > item.matchedCount ? 'orange.8' : 'teal.8'}>
                                            原图 {item.rawCount} / 识别 {item.matchedCount}
                                          </Text>
                                        </Group>
                                      </Paper>
                                    )) : (
                                      <Text size="xs" c="dimmed">无</Text>
                                    )}
                                  </Stack>
                                </ScrollArea>
                              </Box>
                              <Box style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
                                <Box>
                                  <Text size="xs" fw={600} mb={4}>原始文字样本</Text>
                                  <ScrollArea h={140} type="auto">
                                    <Stack gap={4}>
                                      {recognitionSummary.rawLabelSamples.length > 0 ? recognitionSummary.rawLabelSamples.map((code) => (
                                        <Paper key={code} withBorder p={6} radius="sm" bg="#fff">
                                          <Text size="xs" ff="monospace">{code}</Text>
                                        </Paper>
                                      )) : (
                                        <Text size="xs" c="dimmed">无</Text>
                                      )}
                                    </Stack>
                                  </ScrollArea>
                                </Box>
                                <Box>
                                  <Text size="xs" fw={600} mb={4}>候选编号</Text>
                                  <ScrollArea h={140} type="auto">
                                    <Stack gap={4}>
                                      {recognitionSummary.candidateLabelCodes.length > 0 ? recognitionSummary.candidateLabelCodes.map((code) => (
                                        <Paper key={code} withBorder p={6} radius="sm" bg="#fff">
                                          <Text size="xs" ff="monospace">{code}</Text>
                                        </Paper>
                                      )) : (
                                        <Text size="xs" c="dimmed">无</Text>
                                      )}
                                    </Stack>
                                  </ScrollArea>
                                </Box>
                                <Box>
                                  <Text size="xs" fw={600} mb={4}>已识别编号</Text>
                                  <ScrollArea h={140} type="auto">
                                    <Stack gap={4}>
                                      {recognitionSummary.matchedLabelCodes.length > 0 ? recognitionSummary.matchedLabelCodes.map((code) => (
                                        <Paper key={code} withBorder p={6} radius="sm" bg="#eefbf3">
                                          <Text size="xs" ff="monospace" c="teal.8">{code}</Text>
                                        </Paper>
                                      )) : (
                                        <Text size="xs" c="dimmed">无</Text>
                                      )}
                                    </Stack>
                                  </ScrollArea>
                                </Box>
                              </Box>
                            </Stack>
                          </Paper>
                        </Tabs.Panel>

                        <Tabs.Panel value="layers" pt="xs" style={{ flex: 1, minHeight: 0 }}>
                          <Stack gap="xs" style={{ height: '100%', minHeight: 0 }}>
                            <Text size="xs" c="dimmed">当前实际参与窗框识别的几何图层</Text>
                            {recognitionSummary.activeEntityLayers.length > 0 ? (
                              <ScrollArea style={{ flex: 1, minHeight: 0 }} type="auto">
                                <Stack gap={6}>
                                  {recognitionSummary.activeEntityLayers.map((layer) => (
                                    <Badge key={layer} variant="light" color="blue" radius="sm" size="lg" style={{ justifyContent: 'flex-start' }}>
                                      {layer}
                                    </Badge>
                                  ))}
                                </Stack>
                              </ScrollArea>
                            ) : (
                              <Text size="xs" c="dimmed">无</Text>
                            )}
                          </Stack>
                        </Tabs.Panel>

                        <Tabs.Panel value="excluded" pt="xs" style={{ flex: 1, minHeight: 0 }}>
                          <Stack gap="xs" style={{ height: '100%', minHeight: 0 }}>
                            <Text size="xs" c="dimmed">临时启用后会重新试识别</Text>
                            {recognitionSummary.excludedLayerDetails.length > 0 ? (
                              <ScrollArea style={{ flex: 1, minHeight: 0 }} type="auto">
                                <Stack gap={6}>
                                  {recognitionSummary.excludedLayerDetails.map((item) => {
                                    const isEnabled = enabledExcludedLayers.includes(item.layer);
                                    return (
                                      <Button
                                        key={item.layer}
                                        fullWidth
                                        justify="space-between"
                                        size="sm"
                                        variant={isEnabled ? 'filled' : 'light'}
                                        color={isEnabled ? 'blue' : 'gray'}
                                        onClick={() => toggleExcludedLayer(item.layer)}
                                        loading={processingExcludedLayer === item.layer}
                                        disabled={processingExcludedLayer !== null && processingExcludedLayer !== item.layer}
                                        style={{ minHeight: 42, height: 'auto' }}
                                      >
                                        {item.layer} {isEnabled ? '已启用' : '已排除'} ({item.entityCount}{item.labelCount > 0 ? ` / 标注${item.labelCount}` : ''})
                                      </Button>
                                    );
                                  })}
                                </Stack>
                              </ScrollArea>
                            ) : (
                              <Text size="xs" c="dimmed">无</Text>
                            )}
                          </Stack>
                        </Tabs.Panel>

                        <Tabs.Panel value="unmatched" pt="xs" style={{ flex: 1, minHeight: 0 }}>
                          <Stack gap="xs" style={{ height: '100%', minHeight: 0 }}>
                            <Text size="xs" c="dimmed">点击后直接定位问题标注</Text>
                            {recognitionSummary.unmatchedLabelMarkers.length > 0 ? (
                              <ScrollArea style={{ flex: 1, minHeight: 0 }} type="auto">
                                <Stack gap={6}>
                                  {recognitionSummary.unmatchedLabelMarkers.map((marker, index) => {
                                    const isFocused = focusedMarker?.text === marker.text
                                      && focusedMarker?.x === marker.x
                                      && focusedMarker?.y === marker.y;
                                    return (
                                      <Button
                                        key={`${marker.text}-${marker.x}-${marker.y}-${index}`}
                                        fullWidth
                                        justify="space-between"
                                        size="sm"
                                        variant={isFocused ? 'filled' : 'light'}
                                        color={isFocused ? 'red' : 'yellow'}
                                        onClick={() => focusUnmatchedMarker(marker)}
                                        style={{ minHeight: 42, height: 'auto' }}
                                      >
                                        {marker.text}
                                      </Button>
                                    );
                                  })}
                                </Stack>
                              </ScrollArea>
                            ) : (
                              <Text size="xs" c="dimmed">无</Text>
                            )}
                          </Stack>
                        </Tabs.Panel>
                      </Tabs>
                    </Stack>
                  </Paper>
                ) : recognitionSummary ? (
                  <Paper withBorder radius={12} p="sm" bg="#f8fafc">
                    <Text size="xs" c="dimmed">识别报告加载中...</Text>
                  </Paper>
                ) : (
                  <Text size="xs" c="dimmed">识别完成后可在这里查看诊断、被排除图层和未匹配编号。</Text>
                )}
              </Tabs.Panel>
            </Tabs>
          </Stack>
        </Paper>

        <Paper withBorder radius={12} style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
          <Group justify="space-between" p="md" style={{ borderBottom: '1px solid var(--border-color)' }}>
            <Box>
              <Title order={4}>图纸预览</Title>
              <Text size="sm" c="dimmed" mt={4}>
                {fileName || '尚未导入图纸'}
              </Text>
            </Box>
            <ActionIcon variant="default" onClick={() => viewerRef.current?.reset()} disabled={!processedResult}>
              <IconFocusCentered size={18} />
            </ActionIcon>
          </Group>

          <Box style={{ flex: 1, minHeight: 0, position: 'relative' }}>
            {isProcessing ? (
              <Center h="100%">
                <Stack align="center">
                  <Loader />
                  <Text size="sm">正在识别图纸...</Text>
                  <Box w={260}>
                    <Progress value={progress} />
                  </Box>
                </Stack>
              </Center>
            ) : processedResult ? (
              <DxfViewer
                ref={viewerRef}
                processedResult={processedResult}
                windows={pendingWindows as WindowItem[]}
                focusedMarker={focusedMarker}
              />
            ) : (
              <Center h="100%">
                <Stack align="center">
                  <IconFileCode size={36} />
                  <Text>导入 DXF 后在这里查看识别结果</Text>
                </Stack>
              </Center>
            )}
          </Box>
        </Paper>
      </Box>

      <Modal opened={saveOpened} onClose={() => setSaveOpened(false)} title="保存图纸记录" centered>
        <Stack>
          <TextInput label="记录名称" value={drawingTitle} onChange={(event) => setDrawingTitle(event.currentTarget.value)} />
          <Button onClick={handleSave}>确认保存</Button>
        </Stack>
      </Modal>

      <StandardEditorModal
        opened={createStandardOpened}
        onClose={() => setCreateStandardOpened(false)}
        title="新建识别标准"
        submitLabel="保存规则"
        initialValue={defaultStandardForm}
        loading={createStandard.isPending}
        onSubmit={handleCreateStandard}
      />
    </PageScaffold>
  );
};

export default AnalysisPage;
