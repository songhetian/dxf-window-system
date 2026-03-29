import { Box, NavLink, Stack, Text } from '@mantine/core';
import {
  IconFileInvoice,
  IconFolders,
  IconPackages,
  IconReceiptTax,
  IconReceipt2,
  IconScanPosition,
} from '@tabler/icons-react';
import { useLocation, useNavigate } from 'react-router-dom';

const items = [
  { path: '/analysis', label: '窗型测算', icon: IconScanPosition },
  { path: '/materials', label: '材料单价', icon: IconReceipt2 },
  { path: '/products', label: '新建组合', icon: IconPackages },
  { path: '/product-library', label: '组合清单', icon: IconFolders },
  { path: '/rates', label: '费率设置', icon: IconReceiptTax },
  { path: '/quotation', label: '项目报价', icon: IconFileInvoice },
];

export const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <Box className="sidebar-shell">
      <Box className="sidebar-panel no-drag">
        <Box className="sidebar-brand">
          <Text fw={800} size="lg">门窗造价</Text>
          <Text size="sm" c="dimmed" mt={4}>
            从窗型测算到项目报价
          </Text>
        </Box>

        <Box className="sidebar-nav">
          <Text className="sidebar-section-label">功能导航</Text>
          <Stack gap={6}>
            {items.map((item) => (
              <NavLink
                key={item.path}
                label={item.label}
                leftSection={<item.icon size={18} />}
                active={location.pathname === item.path}
                onClick={() => navigate(item.path)}
                variant="light"
                color="green"
                styles={{
                  root: {
                    borderRadius: 14,
                    minHeight: 44,
                    border: location.pathname === item.path ? '1px solid var(--primary-line)' : '1px solid transparent',
                    background: location.pathname === item.path ? 'rgba(23, 119, 78, 0.1)' : 'transparent',
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
    </Box>
  );
};
