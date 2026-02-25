import { create } from 'zustand';
import { Unit } from '../../shared/schemas';

interface WindowState {
  unit: Unit;
  setUnit: (unit: Unit) => void;
  // 当前正在查看的窗户 ID (用于 Zoom-to-fit)
  activeWindowId: string | null;
  setActiveWindowId: (id: string | null) => void;
}

export const useWindowStore = create<WindowState>((set) => ({
  unit: 'mm',
  setUnit: (unit) => set({ unit }),
  activeWindowId: null,
  setActiveWindowId: (activeWindowId) => set({ activeWindowId }),
}));

// 单位转换工具 (mm -> m 或者相反)
export const formatUnit = (value: number, unit: Unit, decimals: number = 2) => {
  if (unit === 'm') {
    return (value / 1000).toFixed(decimals);
  }
  return value.toFixed(decimals);
};

export const getUnitSymbol = (unit: Unit) => (unit === 'mm' ? 'mm' : 'm');
export const getAreaSymbol = (unit: Unit) => (unit === 'mm' ? 'mm²' : 'm²');
