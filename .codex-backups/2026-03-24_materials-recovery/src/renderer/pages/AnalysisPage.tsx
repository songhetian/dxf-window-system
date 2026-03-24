import React, { useCallback, useMemo, useRef, useState } from 'react';
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
  Select,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { IconDeviceFloppy, IconFileCode, IconFocusCentered, IconSettings, IconTrash } from '@tabler/icons-react';
import { modals } from '@mantine/modals';
import { useNavigate } from 'react-router-dom';

import { DxfViewer, DxfViewerRef } from '../features/DxfViewer/DxfViewer';
import { WindowList } from '../features/WindowList/WindowList';
import { useDxfProcessor } from '../hooks/useDxfProcessor';
import { useStandards } from '../hooks/useWindowApi';
import { useWindowStore } from '../stores/windowStore';
import { WindowItem } from '../../shared/schemas';
import { PageScaffold } from '../components/ui/PageScaffold';

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
  const { activeWindowId, selectedStandardId, setSelectedStandardId, setIdentRules, setPricingDraft, addPricingQueueItem } = useWindowStore();

  const [saveOpened, setSaveOpened] = useState(false);
  const [drawingTitle, setDrawingTitle] = useState('');
  const [importKey, setImportKey] = useState(0);
  const [enabledExcludedLayers, setEnabledExcludedLayers] = useState<string[]>([]);
  const [focusedMarker, setFocusedMarker] = useState<{ text: string; x: number; y: number; layer: string } | null>(null);

  const activeStandardName = useMemo(
    () => standards.find((item: any) => item.id === selectedStandardId)?.name || '未选择',
    [selectedStandardId, standards],
  );
  const activeWindow = useMemo(
    () => pendingWindows.find((item) => item.id === activeWindowId) || pendingWindows[0] || null,
    [activeWindowId, pendingWindows],
  );
  const realWindows = useMemo(
    () => pendingWindows.filter((item) => item.category === '真窗'),
    [pendingWindows],
  );
  const recognitionSummary = processedResult?.recognitionSummary ?? null;

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
    modals.openConfirmModal({
      title: '开始识别前确认',
      centered: true,
      children: (
        <Stack gap="sm">
          <Text size="sm">请先确认本次图纸使用的识别标准。</Text>
          <Select
            data={standards.map((item: any) => ({ value: item.id, label: item.name }))}
            value={selectedStandardId}
            onChange={applyStandard}
            placeholder="选择识别标准"
            leftSection={<IconSettings size={14} />}
          />
        </Stack>
      ),
      labels: { confirm: '开始识别', cancel: '取消' },
      onConfirm: () => {
        setEnabledExcludedLayers([]);
        setFocusedMarker(null);
        processDxf(file);
      },
    });
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
    setFocusedMarker(marker);
    viewerRef.current?.zoomToMarker(marker);
  }, []);

  const toggleExcludedLayer = useCallback(async (layer: string) => {
    const nextLayers = enabledExcludedLayers.includes(layer)
      ? enabledExcludedLayers.filter((item) => item !== layer)
      : [...enabledExcludedLayers, layer];

    setEnabledExcludedLayers(nextLayers);
    setFocusedMarker(null);
    await rerunRecognition(nextLayers);
  }, [enabledExcludedLayers, rerunRecognition]);

  return (
    <PageScaffold
      title="图纸识别"
      description="使用顺序很简单：先选择识别标准，再导入 DXF，最后检查左侧清单并保存。"
      actions={
        <Group gap="sm">
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
              <Text size="sm" c="dimmed">当前识别标准</Text>
              <Group justify="space-between" mt={4}>
                <Title order={4}>{activeStandardName}</Title>
                <Badge>{pendingWindows.length} 项</Badge>
              </Group>
              <Text size="sm" c="dimmed" mt={8}>
                识别后点击条目，右侧会自动定位到对应窗型。
              </Text>
            </Box>

            {recognitionSummary ? (
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
                      <Group gap={6}>
                        {recognitionSummary.excludedLayerDetails.map((item) => {
                          const isEnabled = enabledExcludedLayers.includes(item.layer);
                          return (
                            <Button
                              key={item.layer}
                              size="compact-xs"
                              variant={isEnabled ? 'filled' : 'light'}
                              color={isEnabled ? 'blue' : 'gray'}
                              onClick={() => toggleExcludedLayer(item.layer)}
                              loading={isProcessing}
                            >
                              {item.layer} {isEnabled ? '已启用' : '已排除'} ({item.entityCount}{item.labelCount > 0 ? ` / 标注${item.labelCount}` : ''})
                            </Button>
                          );
                        })}
                      </Group>
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
                      <Group gap={6}>
                        {recognitionSummary.unmatchedLabelMarkers.map((marker, index) => {
                          const isFocused = focusedMarker?.text === marker.text
                            && focusedMarker?.x === marker.x
                            && focusedMarker?.y === marker.y;
                          return (
                            <Button
                              key={`${marker.text}-${marker.x}-${marker.y}-${index}`}
                              size="compact-xs"
                              variant={isFocused ? 'filled' : 'light'}
                              color={isFocused ? 'red' : 'yellow'}
                              onClick={() => focusUnmatchedMarker(marker)}
                            >
                              {marker.text}
                            </Button>
                          );
                        })}
                      </Group>
                    ) : (
                      <Text size="xs" c="dimmed">无</Text>
                    )}
                  </Box>
                </Stack>
              </Paper>
            ) : null}

            <Box style={{ flex: 1, minHeight: 0 }}>
              <WindowList windows={pendingWindows as WindowItem[]} onDelete={() => undefined} onEdit={() => undefined} onFocus={(item) => viewerRef.current?.zoomToWindow(item)} />
            </Box>

            {pendingWindows.length > 0 ? (
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
    </PageScaffold>
  );
};

export default AnalysisPage;
