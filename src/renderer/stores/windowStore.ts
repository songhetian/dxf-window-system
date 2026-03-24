import { create } from 'zustand';
import { Unit, WindowItem } from '../../shared/schemas';

type RecognitionMarker = { text: string; x: number; y: number; layer: string };
type RecognitionSummary = {
  totalLabels: number;
  matchedLabels: number;
  unmatchedLabels: string[];
  unmatchedLabelMarkers: RecognitionMarker[];
  includedLayers: string[];
  excludedLayers: string[];
  excludedLayerDetails: Array<{ layer: string; entityCount: number; labelCount: number }>;
  activeEntityLayers: string[];
  activeLabelLayers: string[];
};
type ProcessedResult = {
  pathChunks: { color: string; paths: Path2D[] }[];
  textMarkers?: RecognitionMarker[];
  bounds: any;
  totalEntities: number;
  recognitionSummary?: RecognitionSummary;
};

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
    minWindowArea: number;
    minSideLength: number;
    labelMaxDistance: number;
    layerIncludeKeywords: string;
    layerExcludeKeywords: string;
  };
  setIdentRules: (rules: Partial<WindowState['identRules']>) => void;
  
  // 新增：多标准选择
  selectedStandardId: string | null;
  setSelectedStandardId: (id: string | null) => void;

  processedResult: ProcessedResult | null;
  setProcessedResult: (value: ProcessedResult | null) => void;
  sourceContent: string | null;
  setSourceContent: (value: string | null) => void;
  pendingWindows: WindowItem[];
  setPendingWindows: (value: WindowItem[]) => void;
  analysisFileName: string;
  setAnalysisFileName: (value: string) => void;
  analysisProgress: number;
  setAnalysisProgress: (value: number) => void;
  analysisProcessing: boolean;
  setAnalysisProcessing: (value: boolean) => void;
  clearAnalysisSession: () => void;

  pricingDraft: {
    sourceName: string;
    width: number;
    height: number;
    quantity: number;
    productId?: string | null;
  } | null;
  setPricingDraft: (draft: WindowState['pricingDraft']) => void;
  clearPricingDraft: () => void;

  pricingQueue: Array<{
    id: string;
    sourceName: string;
    width: number;
    height: number;
    quantity: number;
  }>;
  addPricingQueueItem: (item: WindowState['pricingQueue'][number]) => void;
  removePricingQueueItem: (id: string) => void;
  clearPricingQueue: () => void;
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

  processedResult: null,
  setProcessedResult: (processedResult) => set({ processedResult }),
  sourceContent: null,
  setSourceContent: (sourceContent) => set({ sourceContent }),
  pendingWindows: [],
  setPendingWindows: (pendingWindows) => set({ pendingWindows }),
  analysisFileName: '',
  setAnalysisFileName: (analysisFileName) => set({ analysisFileName }),
  analysisProgress: 0,
  setAnalysisProgress: (analysisProgress) => set({ analysisProgress }),
  analysisProcessing: false,
  setAnalysisProcessing: (analysisProcessing) => set({ analysisProcessing }),
  clearAnalysisSession: () => set({
    processedResult: null,
    sourceContent: null,
    pendingWindows: [],
    analysisFileName: '',
    analysisProgress: 0,
    analysisProcessing: false,
    activeWindowId: null,
  }),

  pricingDraft: null,
  setPricingDraft: (pricingDraft) => set({ pricingDraft }),
  clearPricingDraft: () => set({ pricingDraft: null }),

  pricingQueue: [],
  addPricingQueueItem: (item) => set((state) => ({
    pricingQueue: state.pricingQueue.some((entry) => entry.id === item.id)
      ? state.pricingQueue
      : [...state.pricingQueue, item],
  })),
  removePricingQueueItem: (id) => set((state) => ({
    pricingQueue: state.pricingQueue.filter((item) => item.id !== id),
  })),
  clearPricingQueue: () => set({ pricingQueue: [] }),
}));

// 单位转换工具
export const formatUnit = (value: number, unit: Unit, decimals: number = 2) => {
  if (unit === 'm') {
    return (value / 1000).toFixed(decimals);
  }
  return value.toFixed(decimals);
};

export const formatArea = (value: number, unit: Unit, decimals: number = 2) => {
  if (unit === 'm') {
    return (value / 1_000_000).toFixed(decimals);
  }
  return value.toFixed(decimals);
};

export const getUnitSymbol = (unit: Unit) => (unit === 'mm' ? 'mm' : 'm');
export const getAreaSymbol = (unit: Unit) => (unit === 'mm' ? 'mm²' : 'm²');
