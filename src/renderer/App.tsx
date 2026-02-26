import React from 'react';
import { MantineProvider, createTheme, Box } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { ModalsProvider } from '@mantine/modals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

import { Sidebar } from './components/ui/Sidebar';
import AnalysisPage from './pages/AnalysisPage';
import RecordsPage from './pages/RecordsPage';
import StandardsPage from './pages/StandardsPage';

const theme = createTheme({
  primaryColor: 'blue',
  defaultRadius: 'sm',
  fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
});

const queryClient = new QueryClient();

const MainLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <Box style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden', background: '#fff' }}>
      <Sidebar />
      <Box style={{ flex: 1, minWidth: 0, position: 'relative', overflow: 'hidden' }}>
        {children}
      </Box>
    </Box>
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
              <Routes>
                <Route path="/" element={<AnalysisPage />} />
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
