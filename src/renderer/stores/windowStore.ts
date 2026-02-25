import { create } from 'zustand';
import { Unit } from '../../shared/schemas';

interface WindowState {
  unit: Unit;
  setUnit: (unit: Unit) => void;
  activeWindowId: string | null;
  setActiveWindowId: (id: string | null) => void;
  
  // --- 工业级算料参数 ---
  scaleFactor: number; // 绘图比例 (1个单位 =多少 mm)
  setScaleFactor: (val: number) => void;
  
  profileWidth: number; // 型材框宽 (mm)
  setProfileWidth: (val: number) => void;
  
  unitWeight: number; // 型材米重 (kg/m)
  setUnitWeight: (val: number) => void;
}

export const useWindowStore = create<WindowState>((set) => ({
  unit: 'mm',
  setUnit: (unit) => set({ unit }),
  activeWindowId: null,
  setActiveWindowId: (activeWindowId) => set({ activeWindowId }),

  // 默认值：1:1 绘图, 60mm 框宽, 1.5kg/m 米重
  scaleFactor: 1.0,
  setScaleFactor: (scaleFactor) => set({ scaleFactor }),
  
  profileWidth: 60,
  setProfileWidth: (profileWidth) => set({ profileWidth }),
  
  unitWeight: 1.5,
  setUnitWeight: (unitWeight) => set({ unitWeight }),
}));

// 单位转换工具
export const formatUnit = (value: number, unit: Unit, decimals: number = 2) => {
  if (unit === 'm') {
    return (value / 1000).toFixed(decimals);
  }
  return value.toFixed(decimals);
};

export const getUnitSymbol = (unit: Unit) => (unit === 'mm' ? 'mm' : 'm');
export const getAreaSymbol = (unit: Unit) => (unit === 'mm' ? 'mm²' : 'm²');
