import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  DrawingItem,
  MaterialCategory,
  MaterialPricingMode,
  MaterialItem,
  PricingProduct,
  PricingQuote,
  PricingRate,
  WindowItem,
} from '../../shared/schemas';

let API_BASE = 'http://localhost:6002/api';

// 动态监听端口号
if (typeof window !== 'undefined' && (window as any).electronAPI) {
  (window as any).electronAPI.onApiPort((port: number) => {
    API_BASE = `http://localhost:${port}/api`;
    console.log(`API Base updated to: ${API_BASE}`);
  });
}

const fetchJson = async (input: string, init?: RequestInit) => {
  try {
    const response = await fetch(input, init);
    const json = await response.json();
    if (!response.ok || json?.success === false) {
      throw new Error(json?.error || json?.message || '请求失败');
    }
    return json;
  } catch (err) {
    console.error(`Fetch error at ${input}:`, err);
    throw err;
  }
};

export const useDrawings = () => useQuery({
  queryKey: ['drawings'],
  queryFn: async (): Promise<DrawingItem[]> => {
    const json = await fetchJson(`${API_BASE}/drawings`);
    return json.data || [];
  },
});

export const useCreateDrawing = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { title: string; fileName: string; windows: Omit<WindowItem, 'id' | 'drawingId' | 'createdAt'>[] }) =>
      fetchJson(`${API_BASE}/drawings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drawings'] });
    },
  });
};

export const useDrawingWindows = (drawingId: string | null) => useQuery({
  queryKey: ['drawings', drawingId, 'windows'],
  queryFn: async (): Promise<WindowItem[]> => {
    if (!drawingId) return [];
    const json = await fetchJson(`${API_BASE}/drawings/${drawingId}/windows`);
    return json.data || [];
  },
  enabled: !!drawingId,
});

export const useDeleteDrawing = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => fetchJson(`${API_BASE}/drawings/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drawings'] });
    },
  });
};

export const useStandards = () => useQuery({
  queryKey: ['standards'],
  queryFn: async () => {
    const json = await fetchJson(`${API_BASE}/standards`);
    return json.data || [];
  },
});

export const useCreateStandard = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => fetchJson(`${API_BASE}/standards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['standards'] });
    },
  });
};

export const useDeleteStandard = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => fetchJson(`${API_BASE}/standards/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['standards'] });
    },
  });
};

export const useUpdateStandard = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => fetchJson(`${API_BASE}/standards/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['standards'] });
    },
  });
};

export const useMaterialCategories = () => useQuery({
  queryKey: ['material-categories'],
  queryFn: async (): Promise<MaterialCategory[]> => {
    const json = await fetchJson(`${API_BASE}/material-categories`);
    return json.data || [];
  },
});

export const useMaterialPricingModes = () => useQuery({
  queryKey: ['material-pricing-modes'],
  queryFn: async (): Promise<MaterialPricingMode[]> => {
    const json = await fetchJson(`${API_BASE}/material-pricing-modes`);
    return json.data || [];
  },
});

export const useCreateMaterialPricingMode = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Omit<MaterialPricingMode, 'id' | 'createdAt'>) => fetchJson(`${API_BASE}/material-pricing-modes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['material-pricing-modes'] });
    },
  });
};

export const useUpdateMaterialPricingMode = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<MaterialPricingMode> }) => fetchJson(`${API_BASE}/material-pricing-modes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['material-pricing-modes'] });
      queryClient.invalidateQueries({ queryKey: ['materials'] });
    },
  });
};

export const useDeleteMaterialPricingMode = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => fetchJson(`${API_BASE}/material-pricing-modes/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['material-pricing-modes'] });
      queryClient.invalidateQueries({ queryKey: ['materials'] });
    },
  });
};

export const useCreateMaterialCategory = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Omit<MaterialCategory, 'id' | 'createdAt'>) => fetchJson(`${API_BASE}/material-categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['material-categories'] });
    },
  });
};

export const useDeleteMaterialCategory = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => fetchJson(`${API_BASE}/material-categories/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['material-categories'] });
      queryClient.invalidateQueries({ queryKey: ['materials'] });
    },
  });
};

export const useUpdateMaterialCategory = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<MaterialCategory> }) => fetchJson(`${API_BASE}/material-categories/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['material-categories'] });
    },
  });
};

export const useMaterials = () => useQuery({
  queryKey: ['materials'],
  queryFn: async (): Promise<MaterialItem[]> => {
    const json = await fetchJson(`${API_BASE}/materials`);
    return json.data || [];
  },
});

export const useCreateMaterial = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Omit<MaterialItem, 'id' | 'createdAt'>) => fetchJson(`${API_BASE}/materials`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materials'] });
    },
  });
};

export const useDeleteMaterial = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => fetchJson(`${API_BASE}/materials/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materials'] });
      queryClient.invalidateQueries({ queryKey: ['pricing-products'] });
    },
  });
};

export const useUpdateMaterial = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<MaterialItem> }) => fetchJson(`${API_BASE}/materials/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
    onSuccess: (_result, variables) => {
      queryClient.setQueryData(['materials'], (current: MaterialItem[] | undefined) => (
        current?.map((item) => (
          item.id === variables.id
            ? {
                ...item,
                ...variables.data,
                updatedAt: new Date().toISOString(),
              }
            : item
        )) || []
      ));
      queryClient.invalidateQueries({ queryKey: ['pricing-products'] });
    },
  });
};

export const usePricingRates = () => useQuery({
  queryKey: ['pricing-rates'],
  queryFn: async (): Promise<PricingRate[]> => {
    const json = await fetchJson(`${API_BASE}/pricing-rates`);
    return json.data || [];
  },
});

export const useCreatePricingRate = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Omit<PricingRate, 'id' | 'createdAt'>) => fetchJson(`${API_BASE}/pricing-rates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pricing-rates'] });
    },
  });
};

export const useDeletePricingRate = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => fetchJson(`${API_BASE}/pricing-rates/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pricing-rates'] });
    },
  });
};

export const usePricingProducts = () => useQuery({
  queryKey: ['pricing-products'],
  queryFn: async (): Promise<PricingProduct[]> => {
    const json = await fetchJson(`${API_BASE}/pricing-products`);
    return json.data || [];
  },
});

export const useCreatePricingProduct = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { name: string; pricingMode: 'area' | 'perimeter' | 'fixed'; items: { materialId: string; quantity: number }[] }) =>
      fetchJson(`${API_BASE}/pricing-products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pricing-products'] });
    },
  });
};

export const useDeletePricingProduct = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => fetchJson(`${API_BASE}/pricing-products/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pricing-products'] });
    },
  });
};

export const useUpdatePricingProduct = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { id: string; name: string; pricingMode: 'area' | 'perimeter' | 'fixed'; items: { materialId: string; quantity: number }[] }) =>
      fetchJson(`${API_BASE}/pricing-products/${data.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          pricingMode: data.pricingMode,
          items: data.items,
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pricing-products'] });
    },
  });
};

export const usePricingQuotes = () => useQuery({
  queryKey: ['pricing-quotes'],
  queryFn: async (): Promise<PricingQuote[]> => {
    const json = await fetchJson(`${API_BASE}/pricing-quotes`);
    return json.data || [];
  },
});

export const useCreatePricingQuote = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Omit<PricingQuote, 'id' | 'createdAt'>) => fetchJson(`${API_BASE}/pricing-quotes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pricing-quotes'] });
    },
  });
};

export const useDeletePricingQuote = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => fetchJson(`${API_BASE}/pricing-quotes/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pricing-quotes'] });
    },
  });
};
