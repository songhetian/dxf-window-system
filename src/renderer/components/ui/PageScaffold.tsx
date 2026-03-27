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
  <Box h="100%" p={8} className="no-drag">
    <Stack h="100%" gap={6}>
      <Paper
        p={6}
        radius={8}
        withBorder
        style={{ background: '#fff' }}
      >
        <Group justify="space-between" align="center" gap="xs" wrap="nowrap">
          <Box style={{ minWidth: 0, flex: 1 }}>
            <Group gap={6} wrap="nowrap" align="baseline">
              <Title order={6}>{title}</Title>
              <Text size="10px" c="dimmed" truncate>
                {description}
              </Text>
            </Group>
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
