import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { WindowItem, WindowResponseSchema, DrawingItem, DrawingResponseSchema } from '../../shared/schemas';

let API_BASE = 'http://localhost:6002/api';

if (typeof window !== 'undefined' && (window as any).API_PORT) {
  API_BASE = `http://localhost:${(window as any).API_PORT}/api`;
}

// --- Drawings ---
export const useDrawings = () => {
  return useQuery({
    queryKey: ['drawings'],
    queryFn: async (): Promise<DrawingItem[]> => {
      const res = await fetch(`${API_BASE}/drawings`);
      const json = await res.json();
      return json.data || [];
    },
  });
};

export const useCreateDrawing = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { title: string, fileName: string, windows: Omit<WindowItem, 'id' | 'drawingId' | 'createdAt'>[] }) => {
      const res = await fetch(`${API_BASE}/drawings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drawings'] });
    },
  });
};

export const useDrawingWindows = (drawingId: string | null) => {
  return useQuery({
    queryKey: ['drawings', drawingId, 'windows'],
    queryFn: async (): Promise<WindowItem[]> => {
      if (!drawingId) return [];
      const res = await fetch(`${API_BASE}/drawings/${drawingId}/windows`);
      const json = await res.json();
      return json.data || [];
    },
    enabled: !!drawingId,
  });
};

export const useDeleteDrawing = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await fetch(`${API_BASE}/drawings/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drawings'] });
    },
  });
};

// --- Windows ---
export const useUpdateWindow = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<WindowItem> }) => {
      await fetch(`${API_BASE}/windows/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drawings'] });
    },
  });
};

export const useClearData = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await fetch(`${API_BASE}/windows/all`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drawings'] });
    },
  });
};
