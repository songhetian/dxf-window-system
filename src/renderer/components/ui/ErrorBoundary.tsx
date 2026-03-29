import React from 'react';
import { Button, Center, Paper, Stack, Text, Title } from '@mantine/core';

type Props = {
  children: React.ReactNode;
  resetKey?: string;
};

type State = {
  hasError: boolean;
};

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error('Renderer boundary caught error:', error);
  }

  componentDidUpdate(prevProps: Props) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <Center h="100%" p="xl">
        <Paper withBorder p="xl" maw={420} radius="xl" className="app-surface app-surface-strong">
          <Stack gap="md" align="center">
            <Text className="page-header-eyebrow">Page Error</Text>
            <Title order={4} ta="center">当前页面加载失败</Title>
            <Text size="sm" c="dimmed" ta="center">
              错误已被限制在当前页面范围内。可以重试，或切换到其他页面继续操作。
            </Text>
            <Button onClick={() => this.setState({ hasError: false })}>
              重试当前页面
            </Button>
          </Stack>
        </Paper>
      </Center>
    );
  }
}
