import React from 'react';
import { MantineProvider, Button, Group, FileButton, Stack, Title, Text, createTheme, Paper } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { IconFileTypeDxf } from '@tabler/icons-react';

import { AppLayout } from './components/ui/AppLayout';
import { DxfViewer } from './features/DxfViewer/DxfViewer';
import { WindowList } from './features/WindowList/WindowList';
import { useWindows, useDeleteWindow } from './hooks/useWindowApi';
import { useDxfProcessor } from './hooks/useDxfProcessor';

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
  const deleteWinMutation = useDeleteWindow();
  const { entities, processDxf, isProcessing } = useDxfProcessor();

  return (
    <AppLayout
      headerTitle="DXF 窗户智能算料系统"
      navbar={
        <WindowList
          windows={windows}
          onDelete={(id) => deleteWinMutation.mutate(id)}
          onEdit={(window) => console.log('Edit window:', window)}
        />
      }
    >
      <Stack gap="md" h="100%">
        <Paper withBorder p="md" radius="sm">
          <Group justify="space-between">
            <Stack gap={4}>
              <Title order={4}>工程底图展示</Title>
              <Text size="xs" c="dimmed">
                支持 DXF 解析渲染、无限缩放、列表联动
              </Text>
            </Stack>
            <FileButton 
              onChange={(file) => file && processDxf(file)} 
              accept=".dxf"
            >
              {(props) => (
                <Button
                  {...props}
                  loading={isProcessing}
                  leftSection={<IconFileTypeDxf size={20} />}
                  variant="filled"
                >
                  导入 DXF 底图
                </Button>
              )}
            </FileButton>
          </Group>
        </Paper>

        {entities.length > 0 ? (
          <DxfViewer dxfEntities={entities} windows={windows} />
        ) : (
          <Paper
            withBorder
            radius="sm"
            p="xl"
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8f9fa' }}
          >
            <Stack align="center" gap="xs">
              <IconFileTypeDxf size={48} stroke={1.5} color="var(--mantine-color-dimmed)" />
              <Text c="dimmed">请上传并解析 DXF 文件以开始</Text>
            </Stack>
          </Paper>
        )}
      </Stack>
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
