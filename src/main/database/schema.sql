-- DXF 窗户算料系统 - 数据库结构定义 (精简版)

-- 材料分类
CREATE TABLE IF NOT EXISTS material_categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    sortOrder INTEGER DEFAULT 0,
    allowMultipleInProduct INTEGER DEFAULT 0,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 材料计价方式
CREATE TABLE IF NOT EXISTS material_pricing_modes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    unitLabel TEXT NOT NULL DEFAULT '件',
    includeInComboTotal INTEGER DEFAULT 0,
    sortOrder INTEGER DEFAULT 0,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 材料库
CREATE TABLE IF NOT EXISTS materials (
    id TEXT PRIMARY KEY,
    categoryId TEXT NOT NULL,
    name TEXT NOT NULL,
    unitType TEXT NOT NULL DEFAULT 'area',
    unitLabel TEXT NOT NULL DEFAULT '㎡',
    costPrice REAL DEFAULT 0,
    retailPrice REAL DEFAULT 0,
    remarks TEXT DEFAULT '',
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (categoryId) REFERENCES material_categories(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_materials_categoryId ON materials(categoryId);

-- 产品组合
CREATE TABLE IF NOT EXISTS pricing_products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    pricingMode TEXT NOT NULL DEFAULT 'area', -- area | perimeter | fixed
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 产品组合明细
CREATE TABLE IF NOT EXISTS pricing_product_items (
    id TEXT PRIMARY KEY,
    productId TEXT NOT NULL,
    materialId TEXT NOT NULL,
    calcMode TEXT NOT NULL DEFAULT 'area',
    quantity REAL DEFAULT 1,
    includeInComboTotal INTEGER DEFAULT 0,
    sortOrder INTEGER DEFAULT 0,
    FOREIGN KEY (productId) REFERENCES pricing_products(id) ON DELETE CASCADE,
    FOREIGN KEY (materialId) REFERENCES materials(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_pricing_product_items_productId ON pricing_product_items(productId);

-- 报价中心项目
CREATE TABLE IF NOT EXISTS quotation_projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    buildingName TEXT DEFAULT '',
    remarks TEXT DEFAULT '',
    rateSettings TEXT DEFAULT '[]',
    isCompleted INTEGER DEFAULT 0,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 报价中心明细
CREATE TABLE IF NOT EXISTS quotation_items (
    id TEXT PRIMARY KEY,
    projectId TEXT NOT NULL,
    designNumber TEXT NOT NULL,
    width REAL DEFAULT 0,
    height REAL DEFAULT 0,
    quantity REAL DEFAULT 1,
    productId TEXT NOT NULL,
    unitPrice REAL DEFAULT 0,
    totalPrice REAL DEFAULT 0,
    remarks TEXT DEFAULT '',
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (projectId) REFERENCES quotation_projects(id) ON DELETE CASCADE,
    FOREIGN KEY (productId) REFERENCES pricing_products(id)
);

CREATE INDEX IF NOT EXISTS idx_quotation_items_projectId ON quotation_items(projectId);

-- 报价中心费率
CREATE TABLE IF NOT EXISTS pricing_rates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    percentage REAL DEFAULT 0,
    isActive INTEGER DEFAULT 1,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 计算中心历史记录（图纸/工作表记录）
CREATE TABLE IF NOT EXISTS drawing_records (
    id TEXT PRIMARY KEY,
    projectId TEXT,
    sheetName TEXT NOT NULL,
    fileName TEXT DEFAULT '',
    allocationLabels TEXT DEFAULT '[]', -- 存储分配标签数组 JSON, 如 ["1层", "2层"]
    rateSettings TEXT DEFAULT '[]',
    totalArea REAL DEFAULT 0,
    totalCost REAL DEFAULT 0,
    totalRetail REAL DEFAULT 0,
    itemCount INTEGER DEFAULT 0,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (projectId) REFERENCES quotation_projects(id) ON DELETE SET NULL
);

-- 计算中心历史明细（窗型记录）
CREATE TABLE IF NOT EXISTS window_records (
    id TEXT PRIMARY KEY,
    drawingId TEXT NOT NULL,
    windowType TEXT DEFAULT '',
    designNumber TEXT NOT NULL,
    width REAL DEFAULT 0,
    height REAL DEFAULT 0,
    calculatedArea REAL DEFAULT 0,
    quantity REAL DEFAULT 1,
    productId TEXT NOT NULL,
    unitPrice REAL DEFAULT 0,
    totalPrice REAL DEFAULT 0,
    unitRetailPrice REAL DEFAULT 0,
    totalRetailPrice REAL DEFAULT 0,
    componentDetails TEXT DEFAULT '[]',
    accessoryDetails TEXT DEFAULT '[]',
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (drawingId) REFERENCES drawing_records(id) ON DELETE CASCADE,
    FOREIGN KEY (productId) REFERENCES pricing_products(id)
);

-- 窗型数量分配明细
CREATE TABLE IF NOT EXISTS window_allocations (
    id TEXT PRIMARY KEY,
    windowRecordId TEXT NOT NULL,
    label TEXT NOT NULL,
    quantity REAL DEFAULT 0,
    FOREIGN KEY (windowRecordId) REFERENCES window_records(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_window_allocations_windowRecordId ON window_allocations(windowRecordId);

CREATE INDEX IF NOT EXISTS idx_window_records_drawingId ON window_records(drawingId);

-- 识别标准
CREATE TABLE IF NOT EXISTS standards (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    windowPattern TEXT NOT NULL DEFAULT '^C\\d{4}$',
    doorPattern TEXT NOT NULL DEFAULT 'M\\d{4}',
    wallAreaThreshold REAL DEFAULT 4,
    minWindowArea REAL DEFAULT 0.08,
    minSideLength REAL DEFAULT 180,
    labelMaxDistance REAL DEFAULT 600,
    layerIncludeKeywords TEXT DEFAULT '窗,window,win',
    layerExcludeKeywords TEXT DEFAULT '标注,text,dim,轴网,图框,title',
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 初始化默认数据
INSERT OR IGNORE INTO material_categories (id, name, sortOrder)
VALUES ('default-material-category', '默认材料分类', 0);

INSERT OR IGNORE INTO material_pricing_modes (id, name, unitLabel, includeInComboTotal, sortOrder)
VALUES ('area', '按面积', '㎡', 1, 0);

INSERT OR IGNORE INTO material_pricing_modes (id, name, unitLabel, includeInComboTotal, sortOrder)
VALUES ('perimeter', '按长度', 'm', 0, 1);

INSERT OR IGNORE INTO material_pricing_modes (id, name, unitLabel, includeInComboTotal, sortOrder)
VALUES ('fixed', '按件数', '件', 0, 2);

INSERT OR IGNORE INTO standards (
    id, name, windowPattern, doorPattern, wallAreaThreshold, minWindowArea, minSideLength, labelMaxDistance, layerIncludeKeywords, layerExcludeKeywords
)
VALUES (
    'default-std', '默认识别标准', '^C\\d{4}$', 'M\\d{4}', 4, 0.08, 180, 600, '窗,window,win', '标注,text,dim,轴网,图框,title'
);
