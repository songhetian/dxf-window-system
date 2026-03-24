import React from 'react';
import { Stack, NavLink, Title, Group, useMantineTheme } from '@mantine/core';
import { 
  IconLayoutDashboard, 
  IconCategory, 
  IconPackage, 
  IconCalculator, 
  IconHistory, 
  IconSettings 
} from '@tabler/icons-react';
import { Link, useLocation } from 'react-router-dom';

export function AppSidebar() {
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
    <Stack gap="xs" p="xs">
      <Group mb="xl" px="sm" mt="sm">
        <Title order={4} c="teal" fw={900} style={{ letterSpacing: '1px' }}>
          MOSER PRO
        </Title>
      </Group>

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
          styles={{
            root: {
              borderRadius: theme.radius.md,
              fontWeight: 500,
            }
          }}
        />
      ))}
    </Stack>
  );
}
