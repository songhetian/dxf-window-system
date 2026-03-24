import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AppShell, Burger, Group, NavLink, Title, useMantineTheme } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { 
  IconLayoutDashboard, 
  IconCategory, 
  IconPackage, 
  IconCalculator, 
  IconHistory, 
  IconSettings 
} from '@tabler/icons-react';
import { Link, useLocation } from 'react-router-dom';

// Lazy load views (simplified for now)
import { CategoryManagement } from './views/CategoryManagement';
import { CombinationBuilder } from './views/CombinationBuilder';
import { CalculationCenter } from './views/CalculationCenter';
import { CalculationRecords } from './views/CalculationRecords';

export default function App() {
  const [opened, { toggle }] = useDisclosure();
  const location = useLocation();
  const theme = useMantineTheme();

  const navItems = [
    { label: '仪表盘', icon: IconLayoutDashboard, link: '/' },
    { label: '分类与主材', icon: IconCategory, link: '/categories' },
    { label: '成品组合', icon: IconPackage, link: '/combinations' },
    { label: '计算中心', icon: IconCalculator, link: '/calculation-center' },
    { label: '计算库', icon: IconHistory, link: '/records' },
    { label: '系统设置', icon: IconSettings, link: '/settings' },
  ];

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{
        width: 260,
        breakpoint: 'sm',
        collapsed: { mobile: !opened },
      }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="full" px="md">
          <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
          <Title order={3} c="teal" fw={900}>MoserGlassPro</Title>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="xs">
        {navItems.map((item) => (
          <NavLink
            key={item.label}
            component={Link}
            to={item.link}
            label={item.label}
            leftSection={<item.icon size="1.2rem" stroke={1.5} />}
            active={location.pathname === item.link}
            color="teal"
            variant="filled"
          />
        ))}
      </AppShell.Navbar>

      <AppShell.Main bg="#f8fdfa">
        <Routes>
          <Route path="/" element={<div>Dashboard (Coming soon)</div>} />
          <Route path="/categories" element={<CategoryManagement />} />
          <Route path="/combinations" element={<CombinationBuilder />} />
          <Route path="/calculation-center" element={<CalculationCenter />} />
          <Route path="/records" element={<CalculationRecords />} />
          <Route path="/settings" element={<div>Settings (Coming soon)</div>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppShell.Main>
    </AppShell>
  );
}
