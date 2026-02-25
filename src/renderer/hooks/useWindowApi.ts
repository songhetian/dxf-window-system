import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { WindowItem, WindowResponseSchema } from '../../shared/schemas';

// 设置基础端口，生产环境应通过 preload 传递
let API_BASE = 'http://localhost:3002/api';

// 在浏览器环境下，尝试从全局变量中动态获取端口 (如果已注入)
if (typeof window !== 'undefined' && (window as any).API_PORT) {
  API_BASE = `http://localhost:${(window as any).API_PORT}/api`;
}

export const useWindows = () => {
  return useQuery({
    queryKey: ['windows'],
    queryFn: async (): Promise<WindowItem[]> => {
      const res = await fetch(`${API_BASE}/windows`);
      const json = await res.json();
      const validated = WindowResponseSchema.parse(json);
      return (validated.data as WindowItem[]) || [];
    },
  });
};

export const useCreateWindow = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (newWindow: Omit<WindowItem, 'id' | 'createdAt'>) => {
      const res = await fetch(`${API_BASE}/windows`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newWindow),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['windows'] });
    },
  });
};

export const useUpdateWindow = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<WindowItem> }) => {
      const res = await fetch(`${API_BASE}/windows/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['windows'] });
    },
  });
};

export const useDeleteWindow = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`${API_BASE}/windows/${id}`, {
        method: 'DELETE',
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['windows'] });
    },
  });
};
