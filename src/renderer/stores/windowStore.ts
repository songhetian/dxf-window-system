import { create } from 'zustand';
import { Unit } from '../../shared/schemas';

interface AnalysisWindow {
  id: number;
  windowType: string;
  designNumber: string;
  shape: string;
  params: Record<string, number>;
  productId: string;
  accessories: any[];
  allocations: any[];
}

interface WindowState {
  unit: Unit;
  setUnit: (unit: Unit) => void;
  activeWindowId: string | null;
  setActiveWindowId: (id: string | null) => void;
  
  // --- 算料中心草稿 (持久化存储) ---
  analysisDraft: {
    projectId: string | null;
    sheetName: string;
    windows: AnalysisWindow[];
  };
  setAnalysisDraft: (draft: Partial<WindowState['analysisDraft']>) => void;
  clearAnalysisDraft: () => void;

  // --- 工业级算料参数 (原有) ---
  scaleFactor: number;
  setScaleFactor: (val: number) => void;
  profileWidth: number;
  setProfileWidth: (val: number) => void;
  unitWeight: number;
  setUnitWeight: (val: number) => void;
  identRules: {
    windowPrefix: string;
    windowPattern: string;
    doorPrefix: string;
    doorPattern: string;
    wallAreaThreshold: number;
    minWindowArea: number;
    minSideLength: number;
    labelMaxDistance: number;
    layerIncludeKeywords: string;
    layerExcludeKeywords: string;
  };
  setIdentRules: (rules: Partial<WindowState['identRules']>) => void;
  selectedStandardId: string | null;
  setSelectedStandardId: (id: string | null) => void;
}

export const useWindowStore = create<WindowState>((set) => ({
  unit: 'mm',
  setUnit: (unit) => set({ unit }),
  activeWindowId: null,
  setActiveWindowId: (activeWindowId) => set({ activeWindowId }),

  // 算料中心初始化状态
  analysisDraft: {
    projectId: null,
    sheetName: '',
    windows: [{ id: Date.now(), windowType: '', designNumber: '', shape: 'RECTANGLE', params: { width: 1500, height: 1500, manualArea: 0 }, productId: '', accessories: [], allocations: [{ id: Date.now()+1, label: '1层', quantity: 1 }] }]
  },
  setAnalysisDraft: (partialDraft) => set((state) => ({
    analysisDraft: { ...state.analysisDraft, ...partialDraft }
  })),
  clearAnalysisDraft: () => set({
    analysisDraft: {
      projectId: null,
      sheetName: '',
      windows: [{ id: Date.now(), windowType: '', designNumber: '', shape: 'RECTANGLE', params: { width: 1500, height: 1500, manualArea: 0 }, productId: '', accessories: [], allocations: [{ id: Date.now()+1, label: '1层', quantity: 1 }] }]
    }
  }),

  scaleFactor: 1.0,
  setScaleFactor: (scaleFactor) => set({ scaleFactor }),
  profileWidth: 60,
  setProfileWidth: (profileWidth) => set({ profileWidth }),
  unitWeight: 1.5,
  setUnitWeight: (unitWeight) => set({ unitWeight }),
  identRules: {
    windowPrefix: 'C',
    windowPattern: '^C\\d{4}$',
    doorPrefix: 'M',
    doorPattern: 'M\\d{4}',
    wallAreaThreshold: 4,
    minWindowArea: 0.08,
    minSideLength: 180,
    labelMaxDistance: 600,
    layerIncludeKeywords: '窗,window,win',
    layerExcludeKeywords: '标注,text,dim,轴网,图框,title',
  },
  setIdentRules: (rules) => set((state) => ({ identRules: { ...state.identRules, ...rules } })),
  selectedStandardId: 'default-std',
  setSelectedStandardId: (id) => set({ selectedStandardId: id }),
}));
