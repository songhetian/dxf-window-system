import React, { useState, useEffect } from 'react';
import { MantineProvider, Button, Group, FileButton, Stack, Title, Text, createTheme, Paper, Progress, Box } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { IconFileCode, IconDownload } from '@tabler/icons-react';

import { AppLayout } from './components/ui/AppLayout';
import { DxfViewer } from './features/DxfViewer/DxfViewer';
import { WindowList } from './features/WindowList/WindowList';
import { EditWindowModal } from './features/WindowList/EditWindowModal';
import { useWindows, useDeleteWindow, useUpdateWindow } from './hooks/useWindowApi';
import { useDxfProcessor } from './hooks/useDxfProcessor';
import { usePdfExport } from './hooks/usePdfExport';
import { useWindowStore } from './stores/windowStore';
import { WindowItem } from '../shared/schemas';

const theme = createTheme({
  primaryColor: 'blue',
  defaultRadius: 'sm',
  components: {
    Button: { defaultProps: { radius: 'sm' } },
    Paper: { defaultProps: { radius: 'sm' } },
  },
});

const queryClient = new QueryClient();

const WindowManagementApp = () => {
  const { data: windows = [] } = useWindows();
  const { unit } = useWindowStore();
  const deleteWinMutation = useDeleteWindow();
  const updateWinMutation = useUpdateWindow();
  const { dxfData, processDxf, isProcessing, progress } = useDxfProcessor();
  const { exportPdf, exportExcel } = usePdfExport();

  const [editingWindow, setEditingWindow] = useState<WindowItem | null>(null);

  useEffect(() => {
    if ((window as any).electronAPI) {
      (window as any).electronAPI.onApiPort((port: number) => {
        (window as any).API_PORT = port;
        queryClient.invalidateQueries({ queryKey: ['windows'] });
      });
    }
  }, []);

  const handleSaveEdit = async (id: string, data: Partial<WindowItem>) => {
    try {
      await updateWinMutation.mutateAsync({ id, data });
      setEditingWindow(null);
    } catch (err) {
      console.error('Save Edit failed:', err);
    }
  };

  return (
    <AppLayout
      headerTitle="DXF 窗户智能算料系统"
      navbar={
        <WindowList
          windows={windows}
          onDelete={(id) => deleteWinMutation.mutate(id)}
          onEdit={(window) => setEditingWindow(window)}
        />
      }
    >
      {/* 使用真正的 flex 布局，防止遮挡 */}
      <Box style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        
        {/* 顶部按钮区：固定高度 */}
        <Paper withBorder p="md" radius="sm" style={{ position: 'relative', flexShrink: 0 }}>
          <Group justify="space-between" align="center" wrap="nowrap">
            <Stack gap={0} style={{ overflow: 'hidden' }}>
              <Title order={4} style={{ whiteSpace: 'nowrap' }}>工程底图展示</Title>
              <Text size="xs" c="dimmed" truncate>
                {isProcessing ? `深度分析中: ${progress}%` : '全彩色矢量预览 · 智能识别归类'}
              </Text>
            </Stack>
            <Group gap="xs" wrap="nowrap">
              <Button
                variant="light"
                color="green"
                size="sm"
                leftSection={<IconDownload size={16} />}
                onClick={() => exportExcel(windows, unit)}
                disabled={windows.length === 0}
              >
                Excel
              </Button>
              <Button
                variant="filled"
                color="blue"
                size="sm"
                leftSection={<IconDownload size={16} />}
                onClick={() => exportPdf(windows, unit)}
                disabled={windows.length === 0}
              >
                PDF 报表
              </Button>
              <FileButton 
                onChange={(file) => file && processDxf(file)} 
                accept=".dxf"
              >
                {(props) => (
                  <Button
                    {...props}
                    loading={isProcessing}
                    size="sm"
                    leftSection={<IconFileCode size={16} />}
                    variant="filled"
                  >
                    导入 DXF
                  </Button>
                )}
              </FileButton>
            </Group>
          </Group>
          {isProcessing && (
            <Progress 
              value={progress} 
              size="xs" 
              color="blue" 
              striped 
              animated 
              style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}
            />
          )}
        </Paper>

        {/* 绘图区：动态撑满 */}
        <Box style={{ flex: 1, minHeight: 0 }}>
          {dxfData ? (
            <DxfViewer dxfData={dxfData} windows={windows} />
          ) : (
            <Paper
              withBorder
              radius="sm"
              h="100%"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FFFFFF' }}
            >
              <Stack align="center" gap="xs">
                <IconFileCode size={48} stroke={1.5} color="#DEE2E6" />
                <Text c="dimmed" size="sm">请点击上方按钮导入 DXF 图纸</Text>
              </Stack>
            </Paper>
          )}
        </Box>
      </Box>

      <EditWindowModal
        opened={!!editingWindow}
        onClose={() => setEditingWindow(null)}
        windowItem={editingWindow}
        onSave={handleSaveEdit}
        isSaving={updateWinMutation.isPending}
      />
    </AppLayout>
  );
};

export default function App() {
  return (
    <MantineProvider theme={theme}>
      <Notifications />
      <QueryClientProvider client={queryClient}>
        <WindowManagementApp />
      </QueryClientProvider>
    </MantineProvider>
  );
}
