import { create } from 'zustand';

interface CalculationItem {
  id: string;
  name: string;
  details: any[];
  totalPrice: number;
  agencyTotalPrice: number;
  area: number;
  perimeter: number;
  params: any;
  extraRates: any[];
}

interface CalculationStore {
  queue: CalculationItem[];
  addToQueue: (item: CalculationItem) => void;
  removeFromQueue: (id: string) => void;
  clearQueue: () => void;
  updateItem: (id: string, updates: Partial<CalculationItem>) => void;
}

export const useCalculationStore = create<CalculationStore>((set) => ({
  queue: [],
  addToQueue: (item) => set((state) => ({ queue: [...state.queue, item] })),
  removeFromQueue: (id) => set((state) => ({ queue: state.queue.filter((i) => i.id !== id) })),
  clearQueue: () => set({ queue: [] }),
  updateItem: (id, updates) => set((state) => ({
    queue: state.queue.map((item) => (item.id === id ? { ...item, ...updates } : item)),
  })),
}));
