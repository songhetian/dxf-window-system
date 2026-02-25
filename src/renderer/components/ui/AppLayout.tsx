import { AppShell, Burger, Group, NavLink, Title, ActionIcon, Tooltip } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { ReactNode } from 'react';
import { useWindowStore } from '../../stores/windowStore';

interface AppLayoutProps {
  children: ReactNode;
  navbar: ReactNode;
  headerTitle: string;
}

/**
 * 工业级 App 布局 (AppShell)
 * 采用左右结构，遵循 Mantine v7 标准
 * 使用 radius="sm" 以实现小圆角风格
 */
export const AppLayout = ({ children, navbar, headerTitle }: AppLayoutProps) => {
  const [opened, { toggle }] = useDisclosure();
  const { unit, setUnit } = useWindowStore();

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{
        width: 350, // 侧边栏宽度稍大，适合显示详细的窗户列表
        breakpoint: 'sm',
        collapsed: { mobile: !opened },
      }}
      padding="md"
    >
      <AppShell.Header p="sm">
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            <Title order={3} style={{ fontWeight: 800 }}>{headerTitle}</Title>
          </Group>
          
          <Group>
            <Tooltip label="切换单位 (mm/m)">
              <ActionIcon
                variant="light"
                size="lg"
                onClick={() => setUnit(unit === 'mm' ? 'm' : 'mm')}
                radius="sm"
              >
                {unit.toUpperCase()}
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md" style={{ overflowY: 'auto' }}>
        {navbar}
      </AppShell.Navbar>

      <AppShell.Main style={{ display: 'flex', flexDirection: 'column' }}>
        {children}
      </AppShell.Main>
    </AppShell>
  );
};
