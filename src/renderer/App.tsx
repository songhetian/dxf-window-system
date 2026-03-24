import React from 'react';
import { MantineProvider, createTheme, Box } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { ModalsProvider } from '@mantine/modals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';

import { Sidebar } from './components/ui/Sidebar';
import AnalysisPage from './pages/AnalysisPage';
import PricingPage from './pages/PricingPage';
import MaterialsPage from './pages/MaterialsPage';
import ProductsPage from './pages/ProductsPage';
import ProductLibraryPage from './pages/ProductLibraryPage';
import RatesPage from './pages/RatesPage';
import RecordsPage from './pages/RecordsPage';
import StandardsPage from './pages/StandardsPage';

const theme = createTheme({
  primaryColor: 'teal',
  defaultRadius: 'md',
  fontFamily: '"Avenir Next", "SF Pro Display", "PingFang SC", "Microsoft YaHei", sans-serif',
  headings: {
    fontFamily: '"Avenir Next", "SF Pro Display", "PingFang SC", "Microsoft YaHei", sans-serif',
  },
  colors: {
    earth: ['#f8fafc', '#f1f5f9', '#e2e8f0', '#cbd5e1', '#94a3b8', '#64748b', '#475569', '#334155', '#1e293b', '#0f172a'],
  },
});

const queryClient = new QueryClient();

const MainLayout = ({ children }: { children: React.ReactNode }) => (
  <Box className="app-shell">
    <Box className="window-drag-bar">DXF 门窗识别系统</Box>
    <Box className="app-body">
      <Sidebar />
      <Box className="app-content">
        <Box className="page-panel">
          <Box h="100%">{children}</Box>
        </Box>
      </Box>
    </Box>
  </Box>
);

export default function App() {
  return (
    <MantineProvider theme={theme}>
      <Notifications />
      <ModalsProvider>
        <QueryClientProvider client={queryClient}>
          <Router>
            <MainLayout>
              <Routes>
                <Route path="/" element={<AnalysisPage />} />
                <Route path="/materials" element={<MaterialsPage />} />
                <Route path="/products" element={<ProductsPage />} />
                <Route path="/product-library" element={<ProductLibraryPage />} />
                <Route path="/pricing" element={<PricingPage />} />
                <Route path="/rates" element={<RatesPage />} />
                <Route path="/records" element={<RecordsPage />} />
                <Route path="/standards" element={<StandardsPage />} />
              </Routes>
            </MainLayout>
          </Router>
        </QueryClientProvider>
      </ModalsProvider>
    </MantineProvider>
  );
}
