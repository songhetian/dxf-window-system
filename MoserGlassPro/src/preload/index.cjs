const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('db', {
  // 1. 分类管理
  getCategories: () => ipcRenderer.invoke('db:getCategories'),
  addCategory: (data) => ipcRenderer.invoke('db:addCategory', data),
  deleteCategory: (id) => ipcRenderer.invoke('db:deleteCategory', id),

  // 2. 统一基础库管理 (规格、工艺、单项)
  getBaseLibrary: () => ipcRenderer.invoke('db:getBaseLibrary'),
  addBaseItem: (data) => ipcRenderer.invoke('db:addBaseItem', data),
  deleteBaseItem: (id) => ipcRenderer.invoke('db:deleteBaseItem', id),
  updateBaseItem: (data) => ipcRenderer.invoke('db:updateBaseItem', data),

  // 3. 核心定价资产 (多组分构建)
  getMatrixData: () => ipcRenderer.invoke('db:getMatrixData'),
  addPricedAsset: (data) => ipcRenderer.invoke('db:addPricedAsset', data),
  deletePricedAsset: (id) => ipcRenderer.invoke('db:deletePricedAsset', id),
  updatePrice: (data) => ipcRenderer.invoke('db:updatePrice', data),
  getAssetComponents: (assetId) => ipcRenderer.invoke('db:getAssetComponents', assetId),

  // 4. 费率与参数
  getFeeDefinitions: () => ipcRenderer.invoke('db:getFeeDefinitions'),
  addFee: (data) => ipcRenderer.invoke('db:addFee', data), 
  deleteFee: (id) => ipcRenderer.invoke('db:deleteFee', id), // 补全费率删除

  // 5. 模板方案
  getTemplates: () => ipcRenderer.invoke('db:getTemplates'),
  saveTemplate: (data) => ipcRenderer.invoke('db:saveTemplate', data),
  deleteTemplate: (id) => ipcRenderer.invoke('db:deleteTemplate', id),
  
  // 6. 数据库管理 (导入导出)
  exportDatabase: () => ipcRenderer.invoke('db:exportDatabase'),
  importDatabase: () => ipcRenderer.invoke('db:importDatabase'), 
  resetDatabase: () => ipcRenderer.invoke('db:resetDatabase'), // 补全重置接口
  // CAD 实验接口
  readCADFile: () => ipcRenderer.invoke('cad:readFile'),
});
