import { Box, NavLink, Stack, Text } from '@mantine/core';
import {
  IconFileCode,
  IconHistory,
  IconLayoutGrid,
  IconListSearch,
  IconPackage,
  IconRulerMeasure,
  IconCalculator,
  IconPercentage,
} from '@tabler/icons-react';
import { useLocation, useNavigate } from 'react-router-dom';

const items = [
  { path: '/', label: '图纸识别', icon: IconFileCode },
  { path: '/materials', label: '材料库', icon: IconListSearch },
  { path: '/products', label: '组合设置', icon: IconPackage },
  { path: '/product-library', label: '组合库', icon: IconLayoutGrid },
  { path: '/pricing', label: '报价中心', icon: IconCalculator },
  { path: '/rates', label: '费率设置', icon: IconPercentage },
  { path: '/records', label: '记录中心', icon: IconHistory },
  { path: '/standards', label: '识别标准', icon: IconRulerMeasure },
];

export const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <Box w={220} p={12}>
      <Box
        className="no-drag"
        h="100%"
        style={{
          border: '1px solid var(--border-color)',
          borderRadius: 16,
          background: '#fff',
          boxShadow: 'var(--shadow-sm)',
          overflow: 'hidden',
        }}
      >
        <Box p={16} style={{ borderBottom: '1px solid var(--border-color)' }}>
          <Text fw={800} size="lg">DXF Window</Text>
          <Text size="sm" c="dimmed" mt={4}>
            识别、报价、归档
          </Text>
        </Box>

        <Stack gap={6} p={10}>
          {items.map((item) => (
            <NavLink
              key={item.path}
              label={item.label}
              leftSection={<item.icon size={18} />}
              active={location.pathname === item.path}
              onClick={() => navigate(item.path)}
              variant="light"
              color="blue"
              styles={{
                root: {
                  borderRadius: 10,
                },
                label: {
                  fontWeight: 700,
                },
              }}
            />
          ))}
        </Stack>
      </Box>
    </Box>
  );
};
