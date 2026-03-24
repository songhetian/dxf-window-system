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
  <Box h="100%" p={16} className="no-drag">
    <Stack h="100%" gap="md">
      <Paper
        p="lg"
        radius={12}
        withBorder
        style={{ background: '#fff' }}
      >
        <Group justify="space-between" align="flex-start" gap="md">
          <Box>
            <Title order={3}>{title}</Title>
            <Text size="sm" c="dimmed" mt={6}>
              {description}
            </Text>
          </Box>
          {actions}
        </Group>
      </Paper>
      <Box style={{ flex: 1, minHeight: 0 }}>{children}</Box>
    </Stack>
  </Box>
);
