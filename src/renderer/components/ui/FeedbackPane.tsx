import { Center, Loader, Stack, Text } from '@mantine/core';

export const LoadingPane = ({ label = '正在加载...' }: { label?: string }) => (
  <Center h="100%">
    <Stack align="center" gap="xs">
      <Loader color="green" size="sm" />
      <Text size="sm" c="dimmed">{label}</Text>
    </Stack>
  </Center>
);

export const EmptyPane = ({ label }: { label: string }) => (
  <Center h="100%" className="empty-state">
    <Text size="sm" c="dimmed">{label}</Text>
  </Center>
);
