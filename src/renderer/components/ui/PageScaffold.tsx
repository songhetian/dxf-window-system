import { Box, Group, Paper, Stack, Text, Title } from '@mantine/core';
import { ReactNode } from 'react';

export const PageScaffold = ({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description: string;
  actions?: ReactNode;
  children: ReactNode;
}) => (
  <Box className="page-scaffold no-drag">
    <Stack className="page-stack" gap="sm">
      <Paper p="md" className="page-header-card">
        <Group justify="space-between" align="center" gap="xs" wrap="nowrap">
          <Box style={{ minWidth: 0, flex: 1 }}>
            <Text className="page-header-eyebrow" mb={6}>Workspace</Text>
            <Title order={3} size="h4" className="page-header-title">{title}</Title>
            <Text size="sm" c="dimmed" mt={6} className="page-header-description">
              {description}
            </Text>
          </Box>
          <Box style={{ flexShrink: 0 }}>
            {actions}
          </Box>
        </Group>
      </Paper>
      <Box style={{ flex: 1, minHeight: 0 }}>{children}</Box>
    </Stack>
  </Box>
);
