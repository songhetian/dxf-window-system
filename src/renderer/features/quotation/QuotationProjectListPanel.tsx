import { ActionIcon, Badge, Box, Card, Group, Paper, ScrollArea, Stack, Text, TextInput } from '@mantine/core';
import { IconSearch, IconTrash } from '@tabler/icons-react';

type ProjectListItem = {
  id?: string;
  name: string;
  buildingName?: string;
  isCompleted?: number;
  updatedAt?: string;
  createdAt?: string;
};

export const QuotationProjectListPanel = ({
  projects,
  selectedId,
  search,
  onSearchChange,
  onSelect,
  onDelete,
}: {
  projects: ProjectListItem[];
  selectedId: string | null;
  search: string;
  onSearchChange: (value: string) => void;
  onSelect: (id: string | null) => void;
  onDelete: (project: ProjectListItem) => void;
}) => (
  <Paper withBorder p={0} className="app-surface app-section" style={{ width: 320 }}>
    <div className="app-section-header">
      <Box>
        <Text className="app-section-title">工程项目</Text>
        <Text className="app-section-subtitle">计算中心工作表会归档到这里</Text>
      </Box>
      <Badge variant="light" color="green">{projects.length}</Badge>
    </div>

    <div className="list-search">
      <TextInput
        size="xs"
        placeholder="搜索项目..."
        leftSection={<IconSearch size={14} />}
        value={search}
        onChange={(event) => onSearchChange(event.currentTarget.value)}
      />
    </div>

    <ScrollArea className="app-section-body soft-scroll">
      <Stack gap="xs" p="sm">
        {projects.map((project) => (
          <Card
            key={project.id}
            padding="sm"
            radius="lg"
            withBorder
            onClick={() => onSelect(project.id || null)}
            style={{
              cursor: 'pointer',
              borderColor: selectedId === project.id ? 'var(--primary-line)' : 'var(--border-color)',
              background: selectedId === project.id
                ? 'linear-gradient(135deg, rgba(23, 119, 78, 0.12) 0%, rgba(255,255,255,0.92) 100%)'
                : 'linear-gradient(180deg, rgba(255,255,255,1) 0%, rgba(248,250,249,1) 100%)',
              boxShadow: selectedId === project.id ? '0 12px 24px rgba(23, 119, 78, 0.08)' : 'none',
            }}
          >
            <Group justify="space-between" align="flex-start" wrap="nowrap">
              <Box style={{ flex: 1, minWidth: 0 }}>
                <Group gap={6} wrap="wrap" mb={4}>
                  <Text fw={700} size="sm" truncate>{project.name}</Text>
                  <Badge size="xs" color={project.isCompleted ? 'gray' : 'green'} variant="light">
                    {project.isCompleted ? '已完成' : '未完成'}
                  </Badge>
                </Group>
                <Text size="xs" c="dimmed" truncate mb={8}>{project.buildingName || '工程项目'}</Text>
                <Badge variant="dot" color="gray">
                  {new Date(project.updatedAt || project.createdAt || Date.now()).toLocaleDateString()}
                </Badge>
              </Box>

              <ActionIcon
                variant="subtle"
                color="red"
                size="sm"
                onClick={(event) => {
                  event.stopPropagation();
                  onDelete(project);
                }}
              >
                <IconTrash size={14} />
              </ActionIcon>
            </Group>
          </Card>
        ))}

        {projects.length === 0 && (
          <div className="empty-state">
            <Text size="sm" c="dimmed">没有匹配的项目</Text>
          </div>
        )}
      </Stack>
    </ScrollArea>
  </Paper>
);
