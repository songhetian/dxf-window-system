import { AppShell, Burger, Group, NavLink, Title, ActionIcon, Tooltip, Stack, Text, Badge } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { ReactNode, useState } from 'react';
import { useWindowStore } from '../../stores/windowStore';
import { IconSettings } from '@tabler/icons-react';
import { CalculationSettingsModal } from '../../features/DxfViewer/CalculationSettingsModal';

interface AppLayoutProps {
  children: ReactNode;
  navbar: ReactNode;
  headerTitle: string;
}

export const AppLayout = ({ children, navbar, headerTitle }: AppLayoutProps) => {
  const [opened, { toggle }] = useDisclosure();
  const [settingsOpened, { open, close }] = useDisclosure(false);
  const { unit, setUnit } = useWindowStore();

  return (
    <>
    <AppShell
      header={{ height: 60 }}
      navbar={{
        width: 380, // 稍微拓宽侧边栏以适应归类列表
        breakpoint: 'sm',
        collapsed: { mobile: !opened },
      }}
      padding="md"
    >
      <AppShell.Header p="sm" style={{ borderBottom: '1px solid #E9ECEF' }}>
        <Group h="100%" px="md" justify="space-between">
          <Group gap="xl">
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            <Stack gap={0}>
              <Title order={3} style={{ fontWeight: 800, color: '#1A1B1E' }}>{headerTitle}</Title>
              <Text size="xs" c="dimmed">工业级智能门窗算料系统 v1.0</Text>
            </Stack>
          </Group>
          
          <Group gap="xs">
            <Badge variant="dot" color="green" size="lg" radius="sm">主进程已连接</Badge>
            <Tooltip label="算料参数设置">
              <ActionIcon
                variant="light"
                size="lg"
                color="gray"
                onClick={open}
                radius="sm"
              >
                <IconSettings size={20} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="切换单位">
              <ActionIcon
                variant="light"
                size="lg"
                onClick={() => setUnit(unit === 'mm' ? 'm' : 'mm')}
                radius="sm"
                color="blue"
              >
                {unit.toUpperCase()}
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="xs" style={{ overflowY: 'hidden', backgroundColor: '#F8F9FA' }}>
        {navbar}
      </AppShell.Navbar>

      <AppShell.Main style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        backgroundColor: '#F1F3F5',
        height: '100vh', // 强制占满全屏高度
        overflow: 'hidden' // 防止双滚动条
      }}>
        {children}
      </AppShell.Main>
    </AppShell>
    <CalculationSettingsModal opened={settingsOpened} onClose={close} />
    </>
  );
};
