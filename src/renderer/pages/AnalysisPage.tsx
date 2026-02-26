import React, { useState, useRef, useCallback } from 'react';
import { Button, Group, FileButton, Stack, Title, Text, Paper, Progress, Box, TextInput, Modal, ActionIcon, Tooltip, Badge, Center, Loader, Menu, Select } from '@mantine/core';
import { IconFileCode, IconRefresh, IconTrash, IconDeviceFloppy, IconFocusCentered, IconDownload, IconChevronDown, IconSettings } from '@tabler/icons-react';
import { modals } from '@mantine/modals';

import { DxfViewer, DxfViewerRef } from '../features/DxfViewer/DxfViewer';
import { WindowList } from '../features/WindowList/WindowList';
import { useDxfProcessor } from '../hooks/useDxfProcessor';
import { usePdfExport } from '../hooks/usePdfExport';
import { useWindowApi, useStandards } from '../hooks/useWindowApi';
import { useWindowStore } from '../stores/windowStore';
import { WindowItem } from '../../shared/schemas';

const AnalysisPage = () => {
  const { processedResult, pendingWindows, fileName, processDxf, isProcessing, progress, saveToDb, clear } = useDxfProcessor();
  const { exportPdf, exportExcel } = usePdfExport();
  const { unit } = useWindowStore();
  const viewerRef = useRef<DxfViewerRef>(null);
  
  const [saveModalOpened, setSaveModalOpened] = useState(false);
  const [drawingTitle, setDrawingTitle] = useState('');
  const [importKey, setImportKey] = useState(0);

  const { data: standards = [] } = useStandards();
  const { selectedStandardId, setSelectedStandardId, setIdentRules } = useWindowStore();

  const handleSave = async () => {
    if (!drawingTitle) return;
    await saveToDb(drawingTitle);
    setSaveModalOpened(false);
    setDrawingTitle('');
  };

  const openClearConfirm = useCallback(() => {
    modals.openConfirmModal({
      title: '确认清空当前工程',
      centered: true,
      children: <Text size="sm">此操作将清空所有解析数据和未保存的记录，确认继续？</Text>,
      labels: { confirm: '确认清空', cancel: '取消' },
      confirmProps: { color: 'red' },
      onConfirm: () => {
        clear();
        setImportKey(prev => prev + 1);
      },
    });
  }, [clear]);

  const handleFileSelect = (file: File) => {
    modals.openConfirmModal({
      title: '识别标准选择',
      centered: true,
      children: (
        <Stack gap="sm">
          <Text size="sm">请选择本次图纸解析所使用的识别标准：</Text>
          <Select
            data={standards.map((s: any) => ({ value: s.id, label: s.name }))}
            value={selectedStandardId}
            onChange={(val) => {
              const std = standards.find((s: any) => s.id === val);
              if (std) {
                setSelectedStandardId(std.id);
                setIdentRules({
                  windowPrefix: std.windowPattern.charAt(0),
                  windowPattern: std.windowPattern,
                  wallAreaThreshold: std.wallAreaThreshold
                });
              }
            }}
            placeholder="请选择标准"
            leftSection={<IconSettings size={16} />}
          />
          <Text size="xs" c="dimmed">
            系统将依据该标准的编号规则（如 C+数字）和墙体面积阈值自动识别窗户。
          </Text>
        </Stack>
      ),
      labels: { confirm: '开始解析', cancel: '取消' },
      onConfirm: () => processDxf(file),
    });
  };

  return (
    <Box style={{ display: 'flex', height: '100vh', width: '100%', overflow: 'hidden', flexDirection: 'column' }}>
      <Paper h={60} px="md" shadow="none" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #DEE2E6', background: '#fff', flexShrink: 0, zIndex: 10 }}>
        <Box style={{ width: 80 }} />
        <Group gap="sm" style={{ flex: 1, minWidth: 0 }}>
           <Title order={5} style={{ color: '#1A1B1E', fontWeight: 800, whiteSpace: 'nowrap' }}>智能解析工作台</Title>
           {fileName && <Badge variant="filled" color="blue" size="sm" radius="xs" style={{ flexShrink: 1 }}>{fileName}</Badge>}
        </Group>

        <Group gap="xs" wrap="nowrap" style={{ flexShrink: 0 }}>
          {processedResult && (
            <Menu shadow="md" width={150}>
              <Menu.Target>
                <Button variant="light" color="blue" size="sm" leftSection={<IconDownload size={16} />} rightSection={<IconChevronDown size={14} />}>
                  导出结果
                </Button>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item leftSection={<IconDownload size={14} color="green" />} onClick={() => exportExcel(pendingWindows as WindowItem[], unit)}>导出 Excel</Menu.Item>
                <Menu.Item leftSection={<IconDownload size={14} color="orange" />} onClick={() => exportPdf(pendingWindows as WindowItem[], unit)}>生成 PDF 报表</Menu.Item>
              </Menu.Dropdown>
            </Menu>
          )}

          {processedResult && (
            <Tooltip label="视图复位">
              <ActionIcon variant="light" color="blue" size={32} onClick={() => viewerRef.current?.reset()}>
                <IconFocusCentered size={18} />
              </ActionIcon>
            </Tooltip>
          )}
          
          <Button variant="subtle" color="red" size="sm" onClick={openClearConfirm} disabled={!processedResult && pendingWindows.length === 0}>清空</Button>
          
          <FileButton key={importKey} onChange={(file) => file && handleFileSelect(file)} accept=".dxf">
            {(props) => <Button {...props} variant="filled" size="sm" color="blue" leftSection={<IconFileCode size={16} />} loading={isProcessing}>导入 DXF</Button>}
          </FileButton>

          {pendingWindows.length > 0 && (
            <Button color="green" size="sm" leftSection={<IconDeviceFloppy size={16} />} onClick={() => { setDrawingTitle(fileName.replace('.dxf', '')); setSaveModalOpened(true); }}>
              确认保存
            </Button>
          )}
        </Group>
      </Paper>

      <Box style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <Box style={{ width: 340, minWidth: 340, flexShrink: 0, borderRight: '1px solid #DEE2E6', background: '#fff', display: 'flex', flexDirection: 'column' }}>
          <Box p="sm" style={{ borderBottom: '1px solid #F1F3F5', background: '#F8F9FA' }}>
            <Group justify="space-between">
              <Text size="xs" weight={800} color="gray.7">已识别清单</Text>
              <Badge color="blue" variant="filled" size="xs">{pendingWindows.length}</Badge>
            </Group>
          </Box>
          <Box style={{ flex: 1, overflow: 'hidden' }}>
            <WindowList windows={pendingWindows as WindowItem[]} onDelete={() => {}} onEdit={() => {}} onFocus={(win) => viewerRef.current?.zoomToWindow(win)} />
          </Box>
        </Box>

        <Box style={{ flex: 1, position: 'relative', background: '#F1F3F5', overflow: 'hidden' }}>
          {isProcessing ? (
            <Center h="100%" style={{ background: '#fff', zIndex: 1000, position: 'absolute', inset: 0 }}>
              <Stack align="center" gap="lg">
                <Loader size="xl" variant="bars" color="blue" />
                <Stack gap={4} align="center">
                  <Text size="md" weight={700} color="blue">深度解析百万级构件中...</Text>
                  <Text size="sm" color="dimmed">完成进度: {progress}%</Text>
                </Stack>
                <Box w={300}><Progress value={progress} size="sm" color="blue" animated striped radius="xl" /></Box>
              </Stack>
            </Center>
          ) : processedResult ? (
            <DxfViewer ref={viewerRef} processedResult={processedResult} windows={pendingWindows as WindowItem[]} />
          ) : (
            <Center h="100%">
              <Stack align="center" gap="sm">
                <IconFileCode size={64} stroke={1} color="#ADB5BD" />
                <Text c="dimmed" size="sm" fw={500}>请导入工程图纸以开始识别</Text>
              </Stack>
            </Center>
          )}
        </Box>
      </Box>

      <Modal opened={saveModalOpened} onClose={() => setSaveModalOpened(false)} title="保存工程记录" centered size="sm">
        <Stack gap="md" p="xs">
          <TextInput label="记录标题" placeholder="例如：1# 楼标准层" value={drawingTitle} onChange={(e) => setDrawingTitle(e.currentTarget.value)} required data-autofocus />
          <Button onClick={handleSave} fullWidth size="md">确认并保存</Button>
        </Stack>
      </Modal>
    </Box>
  );
};

export default AnalysisPage;
