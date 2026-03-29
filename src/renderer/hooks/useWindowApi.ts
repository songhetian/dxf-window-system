import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  DrawingItem,
  MaterialCategory,
  MaterialPricingMode,
  MaterialItem,
  PricingProduct,
  PricingRate,
  QuotationItem,
  QuotationProject,
  Standard,
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
      queryClient.invalidateQueries({ queryKey: ['pricing-products'] });
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
    mutationFn: async (data: { name: string; pricingMode: 'area' | 'perimeter' | 'fixed'; items: { materialId: string; calcMode: 'area' | 'perimeter' | 'fixed'; quantity: number; includeInComboTotal?: number; sortOrder?: number }[] }) =>
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
    mutationFn: async (data: { id: string; name: string; pricingMode: 'area' | 'perimeter' | 'fixed'; items: { materialId: string; calcMode: 'area' | 'perimeter' | 'fixed'; quantity: number; includeInComboTotal?: number; sortOrder?: number }[] }) =>
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

export const useUpdatePricingRate = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<PricingRate> }) => fetchJson(`${API_BASE}/pricing-rates/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pricing-rates'] });
    },
  });
};

export const useStandards = () => useQuery({
  queryKey: ['standards'],
  queryFn: async (): Promise<Standard[]> => {
    const json = await fetchJson(`${API_BASE}/standards`);
    return json.data || [];
  },
});

// --- 报价中心 ---
export const useQuotationProjects = () => useQuery({
  queryKey: ['quotation-projects'],
  queryFn: async (): Promise<QuotationProject[]> => {
    const json = await fetchJson(`${API_BASE}/quotation-projects`);
    return json.data || [];
  },
});

export const useQuotationProject = (id: string | null) => useQuery({
  queryKey: ['quotation-project', id],
  queryFn: async (): Promise<QuotationProject | null> => {
    if (!id) return null;
    const json = await fetchJson(`${API_BASE}/quotation-projects/${id}`);
    return json.data || null;
  },
  enabled: !!id,
});

export const useCreateQuotationProject = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<QuotationProject>) => fetchJson(`${API_BASE}/quotation-projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotation-projects'] });
    },
  });
};

export const useDeleteQuotationProject = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => fetchJson(`${API_BASE}/quotation-projects/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotation-projects'] });
    },
  });
};

export const useUpdateQuotationProject = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<QuotationProject> }) => fetchJson(`${API_BASE}/quotation-projects/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['quotation-projects'] });
      queryClient.invalidateQueries({ queryKey: ['quotation-project', variables.id] });
    },
  });
};

export const useCreateQuotationItem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<QuotationItem>) => fetchJson(`${API_BASE}/quotation-items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['quotation-project', variables.projectId] });
      queryClient.invalidateQueries({ queryKey: ['quotation-projects'] });
    },
  });
};

export const useDeleteQuotationItem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => fetchJson(`${API_BASE}/quotation-items/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotation-project'] });
      queryClient.invalidateQueries({ queryKey: ['quotation-projects'] });
    },
  });
};

// --- 计算中心历史记录 (Records) ---
export const useDrawingRecords = () => useQuery({
  queryKey: ['drawing-records'],
  queryFn: async (): Promise<DrawingItem[]> => {
    const json = await fetchJson(`${API_BASE}/drawing-records`);
    return json.data || [];
  },
});

export const useDrawingRecord = (id: string | null) => useQuery({
  queryKey: ['drawing-record', id],
  queryFn: async () => {
    if (!id) return null;
    const json = await fetchJson(`${API_BASE}/drawing-records/${id}`);
    return json.data;
  },
  enabled: !!id,
});

export const useDrawingRecordsDetails = (ids: string[]) => useQueries({
  queries: ids.map((id) => ({
    queryKey: ['drawing-record', id],
    queryFn: async () => {
      const json = await fetchJson(`${API_BASE}/drawing-records/${id}`);
      return json.data;
    },
    enabled: Boolean(id),
  })),
});

export const useCreateDrawingRecord = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => fetchJson(`${API_BASE}/drawing-records`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['drawing-records'] });
      queryClient.invalidateQueries({ queryKey: ['quotation-projects'] });
      if (variables?.projectId) {
        queryClient.invalidateQueries({ queryKey: ['quotation-project', variables.projectId] });
      }
    },
  });
};

export const useDeleteDrawingRecord = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; projectId?: string | null }) => fetchJson(`${API_BASE}/drawing-records/${id}`, { method: 'DELETE' }),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['drawing-records'] });
      queryClient.invalidateQueries({ queryKey: ['quotation-projects'] });
      queryClient.invalidateQueries({ queryKey: ['quotation-project'] });
      if (variables?.projectId) {
        queryClient.invalidateQueries({ queryKey: ['quotation-project', variables.projectId] });
      }
    },
  });
};

export const useUpdateDrawingRecord = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data, projectId }: { id: string; data: Record<string, any>; projectId?: string | null }) => fetchJson(`${API_BASE}/drawing-records/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['drawing-records'] });
      queryClient.invalidateQueries({ queryKey: ['drawing-record', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['quotation-projects'] });
      if (variables?.projectId) {
        queryClient.invalidateQueries({ queryKey: ['quotation-project', variables.projectId] });
      }
    },
  });
};
