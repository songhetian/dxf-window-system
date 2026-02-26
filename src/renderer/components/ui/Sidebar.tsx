import { NavLink, Stack, Tooltip, ActionIcon, Box, useMantineTheme } from '@mantine/core';
import { IconFileCode, IconHistory, IconSettings, IconLayoutSidebarLeftCollapse, IconLayoutSidebarLeftExpand } from '@tabler/icons-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';

export const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const theme = useMantineTheme();

  const menuItems = [
    { icon: IconFileCode, label: '图纸解析', path: '/' },
    { icon: IconHistory, label: '图纸记录', path: '/records' },
  ];

  return (
    <Box
      style={{
        width: collapsed ? 60 : 200,
        transition: 'width 0.2s ease',
        borderRight: '1px solid #E9ECEF',
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        background: '#fff',
      }}
    >
      <Stack gap={0} p="xs" style={{ flex: 1 }}>
        <Box mb="xl" pl={collapsed ? 0 : 'xs'} style={{ textAlign: collapsed ? 'center' : 'left' }}>
           {!collapsed && <Box style={{ fontWeight: 800, fontSize: 18, color: theme.colors.blue[7] }}>DXF Pro</Box>}
           {collapsed && <Box style={{ fontWeight: 800, fontSize: 14, color: theme.colors.blue[7] }}>D</Box>}
        </Box>

        {menuItems.map((item) => (
          <Tooltip key={item.path} label={item.label} position="right" disabled={!collapsed}>
            <NavLink
              label={collapsed ? '' : item.label}
              leftSection={<item.icon size={20} stroke={1.5} />}
              active={location.pathname === item.path}
              onClick={() => navigate(item.path)}
              variant="light"
              color="blue"
              styles={{
                root: {
                  borderRadius: theme.radius.sm,
                  marginBottom: 4,
                  height: 44,
                }
              }}
            />
          </Tooltip>
        ))}
      </Stack>

      <Box p="xs" style={{ borderTop: '1px solid #F1F3F5' }}>
        <Tooltip label={collapsed ? '展开侧边栏' : '折叠侧边栏'} position="right">
          <ActionIcon
            variant="subtle"
            color="gray"
            size="lg"
            onClick={() => setCollapsed(!collapsed)}
            style={{ width: '100%' }}
          >
            {collapsed ? <IconLayoutSidebarLeftExpand size={20} /> : <IconLayoutSidebarLeftCollapse size={20} />}
          </ActionIcon>
        </Tooltip>
      </Box>
    </Box>
  );
};
