export interface DatabaseBridge {
  // 分类管理
  getCategories: () => Promise<any[]>;
  addCategory: (data: { name: string }) => Promise<any>;
  deleteCategory: (id: number) => Promise<any>;

  // 统一基础库
  getBaseLibrary: () => Promise<any[]>;
  addBaseItem: (data: { name: string; category_id: number; price_type: string; agency_price: number; guide_price: number }) => Promise<any>;
  deleteBaseItem: (id: number) => Promise<any>;
  updateBaseItem: (data: { 
    table?: string; id: number; name: string; category_id?: number; rate?: number;
    price_type?: string; agency_price?: number; guide_price?: number;
  }) => Promise<any>;

  // 定价资产
  getMatrixData: () => Promise<any[]>;
  addPricedAsset: (data: { name: string; color: string; componentIds: number[] }) => Promise<any>;
  deletePricedAsset: (id: number) => Promise<any>;
  updatePrice: (data: { comboId: number; field: string; value: any }) => Promise<any>;
  getAssetComponents: (assetId: number) => Promise<any[]>;

  // 费率
  getFeeDefinitions: () => Promise<any[]>;
  addFee: (data: { name: string; rate: number }) => Promise<any>;
  deleteFee: (id: number) => Promise<any>;

  // 模板
  getTemplates: () => Promise<any[]>;
  saveTemplate: (data: { name: string; bom: any[]; width: number; height: number }) => Promise<any>;
  deleteTemplate: (id: string) => Promise<any>;

  // 物理管理
  exportDatabase: () => Promise<{ success: boolean; path?: string }>;
  importDatabase: () => Promise<{ success: boolean }>;
  resetDatabase: () => Promise<{ success: boolean }>;
  readCADFile: () => Promise<{ success: boolean; content?: string; fileName?: string; error?: string }>;
}

declare global {
  interface Window {
    db: DatabaseBridge;
  }
}
