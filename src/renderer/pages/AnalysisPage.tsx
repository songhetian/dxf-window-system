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
  const { activeWindowId, selectedStandardId, setSelectedStandardId, setIdentRules, setPricingDraft, addPricingQueueItem } = useWindowStore(useShallow((state) => ({
    activeWindowId: state.activeWindowId,
    selectedStandardId: state.selectedStandardId,
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
  const [showAllExcludedLayers, setShowAllExcludedLayers] = useState(false);
  const [showAllUnmatchedMarkers, setShowAllUnmatchedMarkers] = useState(false);
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
    setShowAllExcludedLayers(false);
    setShowAllUnmatchedMarkers(false);

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
    await rerunRecognition(nextLayers);
  }, [enabledExcludedLayers, rerunRecognition]);

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
      <Box h="100%" style={{ display: 'grid', gridTemplateColumns: '320px minmax(0, 1fr)', gap: 12 }}>
        <Paper withBorder radius={12} p="md" style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
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

            {recognitionSummary && showRecognitionReport ? (
              <Paper withBorder radius={12} p="sm" bg="#f8fafc">
                <Stack gap="xs">
                  <Group justify="space-between" align="center">
                    <Text fw={600} size="sm">识别报告</Text>
                    <Badge color={recognitionSummary.unmatchedLabels.length > 0 ? 'yellow' : 'teal'} variant="light">
                      {recognitionSummary.matchedLabels} / {recognitionSummary.totalLabels}
                    </Badge>
                  </Group>
                  <Text size="xs" c="dimmed">
                    参与图层：{recognitionSummary.activeEntityLayers.slice(0, 4).join('、') || '无'}
                  </Text>
                  <Divider />
                  <Box>
                    <Group justify="space-between" align="center" mb={6}>
                      <Text size="xs" fw={600}>被排除图层</Text>
                      <Text size="xs" c="dimmed">临时启用后会重新试识别</Text>
                    </Group>
                    {recognitionSummary.excludedLayerDetails.length > 0 ? (
                      <ScrollArea.Autosize mah={108} type="auto">
                        <Stack gap={6}>
                          {(showAllExcludedLayers
                            ? recognitionSummary.excludedLayerDetails
                            : recognitionSummary.excludedLayerDetails.slice(0, 8)
                          ).map((item) => {
                            const isEnabled = enabledExcludedLayers.includes(item.layer);
                            return (
                              <Button
                                key={item.layer}
                                fullWidth
                                justify="space-between"
                                size="compact-sm"
                                variant={isEnabled ? 'filled' : 'light'}
                                color={isEnabled ? 'blue' : 'gray'}
                                onClick={() => toggleExcludedLayer(item.layer)}
                                loading={isProcessing}
                              >
                                {item.layer} {isEnabled ? '已启用' : '已排除'} ({item.entityCount}{item.labelCount > 0 ? ` / 标注${item.labelCount}` : ''})
                              </Button>
                            );
                          })}
                          {recognitionSummary.excludedLayerDetails.length > 8 ? (
                            <Button
                              variant="subtle"
                              size="compact-xs"
                              onClick={() => setShowAllExcludedLayers((value) => !value)}
                            >
                              {showAllExcludedLayers ? '收起图层' : `展开剩余 ${recognitionSummary.excludedLayerDetails.length - 8} 项`}
                            </Button>
                          ) : null}
                        </Stack>
                      </ScrollArea.Autosize>
                    ) : (
                      <Text size="xs" c="dimmed">无</Text>
                    )}
                  </Box>
                  <Divider />
                  <Box>
                    <Group justify="space-between" align="center" mb={6}>
                      <Text size="xs" fw={600}>未匹配编号</Text>
                      <Text size="xs" c="dimmed">点击后直接定位问题标注</Text>
                    </Group>
                    {recognitionSummary.unmatchedLabelMarkers.length > 0 ? (
                      <ScrollArea.Autosize mah={140} type="auto">
                        <Stack gap={6}>
                          {(showAllUnmatchedMarkers
                            ? recognitionSummary.unmatchedLabelMarkers
                            : recognitionSummary.unmatchedLabelMarkers.slice(0, 12)
                          ).map((marker, index) => {
                            const isFocused = focusedMarker?.text === marker.text
                              && focusedMarker?.x === marker.x
                              && focusedMarker?.y === marker.y;
                            return (
                              <Button
                                key={`${marker.text}-${marker.x}-${marker.y}-${index}`}
                                fullWidth
                                justify="space-between"
                                size="compact-sm"
                                variant={isFocused ? 'filled' : 'light'}
                                color={isFocused ? 'red' : 'yellow'}
                                onClick={() => focusUnmatchedMarker(marker)}
                              >
                                {marker.text}
                              </Button>
                            );
                          })}
                          {recognitionSummary.unmatchedLabelMarkers.length > 12 ? (
                            <Button
                              variant="subtle"
                              size="compact-xs"
                              onClick={() => setShowAllUnmatchedMarkers((value) => !value)}
                            >
                              {showAllUnmatchedMarkers ? '收起编号' : `展开剩余 ${recognitionSummary.unmatchedLabelMarkers.length - 12} 项`}
                            </Button>
                          ) : null}
                        </Stack>
                      </ScrollArea.Autosize>
                    ) : (
                      <Text size="xs" c="dimmed">无</Text>
                    )}
                  </Box>
                </Stack>
              </Paper>
            ) : recognitionSummary ? (
              <Paper withBorder radius={12} p="sm" bg="#f8fafc">
                <Text size="xs" c="dimmed">识别报告加载中...</Text>
              </Paper>
            ) : null}

            <Box style={{ flex: 1, minHeight: 0 }}>
              {showWindowList ? (
                <WindowList windows={deferredPendingWindows as WindowItem[]} onDelete={() => undefined} onEdit={() => undefined} onFocus={(item) => viewerRef.current?.zoomToWindow(item)} />
              ) : processedResult ? (
                <Paper withBorder radius={12} p="sm">
                  <Text size="xs" c="dimmed">窗列表加载中...</Text>
                </Paper>
              ) : null}
            </Box>

            {deferredPendingWindows.length > 0 ? (
              <Stack gap="xs">
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
                  带入报价中心
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
                  加入报价准备区
                </Button>
                <Button
                  variant="light"
                  onClick={() => {
                    realWindows.forEach((item) => {
                      addPricingQueueItem({
                        id: item.id || crypto.randomUUID(),
                        sourceName: item.name,
                        width: item.width,
                        height: item.height,
                        quantity: 1,
                      });
                    });
                    navigate('/pricing');
                  }}
                >
                  全部真窗加入报价准备区
                </Button>
                <Button
                  leftSection={<IconDeviceFloppy size={16} />}
                  onClick={() => {
                    setDrawingTitle(fileName.replace('.dxf', ''));
                    setSaveOpened(true);
                  }}
                >
                  保存识别结果
                </Button>
              </Stack>
            ) : null}
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
