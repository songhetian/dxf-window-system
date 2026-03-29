import React, { Suspense, lazy } from 'react';
import { MantineProvider, createTheme, Box } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { ModalsProvider } from '@mantine/modals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HashRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';

import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { LoadingPane } from './components/ui/FeedbackPane';
import { Sidebar } from './components/ui/Sidebar';

const MaterialsPage = lazy(() => import('./pages/MaterialsPage'));
const ProductsPage = lazy(() => import('./pages/ProductsPage'));
const ProductLibraryPage = lazy(() => import('./pages/ProductLibraryPage'));
const QuotationPage = lazy(() => import('./pages/QuotationPage'));
const AnalysisPage = lazy(() => import('./pages/AnalysisPage'));
const RateSettingsPage = lazy(() => import('./pages/RateSettingsPage'));

const theme = createTheme({
  primaryColor: 'green',
  defaultRadius: 'lg',
  fontFamily: '"Avenir Next", "SF Pro Display", "PingFang SC", "Microsoft YaHei", sans-serif',
  headings: {
    fontFamily: '"Avenir Next", "SF Pro Display", "PingFang SC", "Microsoft YaHei", sans-serif',
  },
  colors: {
    earth: ['#f8fafc', '#f1f5f9', '#e2e8f0', '#cbd5e1', '#94a3b8', '#64748b', '#475569', '#334155', '#1e293b', '#0f172a'],
  },
  components: {
    Paper: {
      defaultProps: {
        radius: 'xl',
      },
    },
    Button: {
      defaultProps: {
        radius: 'xl',
      },
    },
    ActionIcon: {
      defaultProps: {
        radius: 'xl',
      },
    },
  },
});

const queryClient = new QueryClient();

const MainLayout = ({ children }: { children: React.ReactNode }) => (
  <Box className="app-shell">
    <Box className="window-drag-bar">
      <Box className="window-drag-title">门窗造价测算系统</Box>
      <Box className="window-drag-subtitle">分析、组合、报价一体化工作台</Box>
    </Box>
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

const RoutedContent = () => {
  const location = useLocation();

  return (
    <ErrorBoundary resetKey={location.pathname}>
      <Suspense fallback={<LoadingPane label="页面加载中..." />}>
        <Routes>
          <Route path="/" element={<AnalysisPage />} />
          <Route path="/analysis" element={<AnalysisPage />} />
          <Route path="/materials" element={<MaterialsPage />} />
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/product-library" element={<ProductLibraryPage />} />
          <Route path="/rates" element={<RateSettingsPage />} />
          <Route path="/quotation" element={<QuotationPage />} />
          <Route path="/records" element={<Navigate to="/quotation" replace />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
};

export default function App() {
  return (
    <MantineProvider theme={theme}>
      <Notifications />
      <ModalsProvider>
        <QueryClientProvider client={queryClient}>
          <Router>
            <MainLayout>
              <RoutedContent />
            </MainLayout>
          </Router>
        </QueryClientProvider>
      </ModalsProvider>
    </MantineProvider>
  );
}
