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

  identRules: {
    windowPrefix: string;
    windowPattern: string;
    doorPrefix: string;
    doorPattern: string;
    wallAreaThreshold: number;
  };
  setIdentRules: (rules: Partial<WindowState['identRules']>) => void;
  
  // 新增：多标准选择
  selectedStandardId: string | null;
  setSelectedStandardId: (id: string | null) => void;
}

export const useWindowStore = create<WindowState>((set) => ({
  unit: 'mm',
  setUnit: (unit) => set({ unit }),
  activeWindowId: null,
  setActiveWindowId: (activeWindowId) => set({ activeWindowId }),

  scaleFactor: 1.0,
  setScaleFactor: (scaleFactor) => set({ scaleFactor }),
  
  profileWidth: 60,
  setProfileWidth: (profileWidth) => set({ profileWidth }),
  
  unitWeight: 1.5,
  setUnitWeight: (unitWeight) => set({ unitWeight }),

  identRules: {
    windowPrefix: 'C',
    windowPattern: 'C\\d{4}',
    doorPrefix: 'M',
    doorPattern: 'M\\d{4}',
    wallAreaThreshold: 10,
  },
  setIdentRules: (rules) => set((state) => ({ identRules: { ...state.identRules, ...rules } })),

  selectedStandardId: 'default-std',
  setSelectedStandardId: (id) => set({ selectedStandardId: id }),
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
