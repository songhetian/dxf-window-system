import { ActionIcon, Badge, Box, Button, Group, Paper, ScrollArea, Stack, Text, TextInput, Title } from '@mantine/core';
import { IconCopy, IconEdit, IconSearch, IconTrash } from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { PageScaffold } from '../components/ui/PageScaffold';
import { useDeletePricingProduct, usePricingProducts } from '../hooks/useWindowApi';

const ProductLibraryPage = () => {
  const { data: products = [] } = usePricingProducts();
  const deleteProduct = useDeletePricingProduct();
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState('');

  const filteredProducts = useMemo(
    () => products.filter((item) => `${item.name} ${item.items.map((entry) => entry.materialName || '').join(' ')}`.toLowerCase().includes(keyword.toLowerCase())),
    [keyword, products],
  );

  const openBuilder = (productId: string | null, copyMode = false) => {
    if (!productId) return;
    window.localStorage.setItem('product-builder-load', JSON.stringify({ productId, copyMode }));
    navigate('/products');
  };

  return (
    <PageScaffold
      title="组合库"
      description="已保存的组合统一放在这里管理。组合设置页只做搭配、筛选和编辑。"
    >
      <Paper withBorder radius={12} p="md" h="100%">
        <Stack gap="md" h="100%">
          <TextInput
            leftSection={<IconSearch size={16} />}
            placeholder="搜索组合名称或材料"
            value={keyword}
            onChange={(event) => setKeyword(event.currentTarget.value)}
          />

          <ScrollArea className="soft-scroll" style={{ flex: 1 }}>
            <Stack gap="sm">
              {filteredProducts.map((product) => (
                <Paper key={product.id} withBorder radius={12} p="md" bg="var(--bg-subtle)">
                  <Stack gap="sm">
                    <Group justify="space-between" align="flex-start">
                      <Box maw={420}>
                        <Title order={5}>{product.name}</Title>
                        <Text size="sm" c="dimmed" mt={6}>
                          {product.items.map((item) => `${item.materialName} x ${item.quantity}`).join('，') || '暂无材料'}
                        </Text>
                      </Box>
                      <Badge variant="light">{product.items.length} 项</Badge>
                    </Group>
                    <Group gap="xs">
                      <Button variant="light" leftSection={<IconEdit size={14} />} onClick={() => openBuilder(product.id || null)}>
                        编辑
                      </Button>
                      <Button variant="subtle" leftSection={<IconCopy size={14} />} onClick={() => openBuilder(product.id || null, true)}>
                        复制
                      </Button>
                      <ActionIcon variant="subtle" color="red" onClick={() => deleteProduct.mutate(product.id || '')}>
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Group>
                  </Stack>
                </Paper>
              ))}
            </Stack>
          </ScrollArea>
        </Stack>
      </Paper>
    </PageScaffold>
  );
};

export default ProductLibraryPage;
