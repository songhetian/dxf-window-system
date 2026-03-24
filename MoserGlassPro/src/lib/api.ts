const API_BASE = 'http://127.0.0.1:3000/api';

export const api = {
  // Categories
  getCategories: () => fetch(`${API_BASE}/categories`).then(r => r.json()),
  createCategory: (data: any) => fetch(`${API_BASE}/categories`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(r => r.json()),
  updateCategory: (id: number, data: any) => fetch(`${API_BASE}/categories/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(r => r.json()),
  deleteCategory: (id: number) => fetch(`${API_BASE}/categories/${id}`, { method: 'DELETE' }).then(r => r.json()),

  // Components
  getComponents: () => fetch(`${API_BASE}/components`).then(r => r.json()),
  createComponent: (data: any) => fetch(`${API_BASE}/components`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(r => r.json()),
  updateComponent: (id: number, data: any) => fetch(`${API_BASE}/components/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(r => r.json()),
  deleteComponent: (id: number) => fetch(`${API_BASE}/components/${id}`, { method: 'DELETE' }).then(r => r.json()),

  // Combinations
  getCombinations: () => fetch(`${API_BASE}/combinations`).then(r => r.json()),
  createCombination: (data: any) => fetch(`${API_BASE}/combinations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(r => r.json()),
  findOrCreateCombination: (data: any) => fetch(`${API_BASE}/combinations/find-or-create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(r => r.json()),

  // Calculation Records (新增持久化支持)
  getCalculationRecords: () => fetch(`${API_BASE}/calculation-records`).then(r => r.json()),
  createCalculationRecord: (data: any) => fetch(`${API_BASE}/calculation-records`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(r => r.json()),
  deleteCalculationRecord: (id: number) => fetch(`${API_BASE}/calculation-records/${id}`, { method: 'DELETE' }).then(r => r.json()),

  // Extra Rates
  getExtraRates: () => fetch(`${API_BASE}/extra-rates`).then(r => r.json()),
  createExtraRate: (data: any) => fetch(`${API_BASE}/extra-rates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(r => r.json()),

  // Shapes
  getShapes: () => fetch(`${API_BASE}/shapes`).then(r => r.json()),
};
