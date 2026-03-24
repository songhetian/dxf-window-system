-- DXF 窗户算料系统 - 数据库结构定义

-- 图纸记录表
CREATE TABLE IF NOT EXISTS drawings (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    fileName TEXT NOT NULL,
    windowCount INTEGER DEFAULT 0,
    totalArea REAL DEFAULT 0,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 窗户明细表
CREATE TABLE IF NOT EXISTS windows (
    id TEXT PRIMARY KEY,
    drawingId TEXT, -- 关联图纸 ID
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    shapeType TEXT NOT NULL,
    width REAL NOT NULL,
    height REAL NOT NULL,
    area REAL NOT NULL,
    glassArea REAL DEFAULT 0,
    perimeter REAL NOT NULL,
    frameWeight REAL DEFAULT 0,
    handle TEXT,
    arcRatio REAL DEFAULT 0,
    symmetryRate REAL DEFAULT 0,
    points TEXT NOT NULL, -- 存储顶点坐标的 JSON 字符串
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (drawingId) REFERENCES drawings(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_windows_drawingId ON windows(drawingId);
CREATE INDEX IF NOT EXISTS idx_windows_category ON windows(category);

-- 识别标准配置表
CREATE TABLE IF NOT EXISTS standards (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    windowPattern TEXT NOT NULL DEFAULT 'C\d{4}',
    doorPattern TEXT NOT NULL DEFAULT 'M\d{4}',
    wallAreaThreshold REAL DEFAULT 4,
    minWindowArea REAL DEFAULT 0.08,
    minSideLength REAL DEFAULT 180,
    labelMaxDistance REAL DEFAULT 600,
    layerIncludeKeywords TEXT DEFAULT '窗,window,win',
    layerExcludeKeywords TEXT DEFAULT '标注,text,dim,轴网,图框,title',
    isDefault INTEGER DEFAULT 0,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 插入一个默认标准
INSERT OR IGNORE INTO standards (id, name, windowPattern, doorPattern, wallAreaThreshold, minWindowArea, minSideLength, labelMaxDistance, layerIncludeKeywords, layerExcludeKeywords, isDefault) 
VALUES ('default-std', '通用建筑标准', '^C\d{4}$', 'M\d{4}', 4, 0.08, 180, 600, '窗,window,win', '标注,text,dim,轴网,图框,title', 1);

-- 材料分类
CREATE TABLE IF NOT EXISTS material_categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    sortOrder INTEGER DEFAULT 0,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 材料计价方式
CREATE TABLE IF NOT EXISTS material_pricing_modes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    unitLabel TEXT NOT NULL DEFAULT '件',
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
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    ,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 产品组合明细
CREATE TABLE IF NOT EXISTS pricing_product_items (
    id TEXT PRIMARY KEY,
    productId TEXT NOT NULL,
    materialId TEXT NOT NULL,
    quantity REAL DEFAULT 1,
    FOREIGN KEY (productId) REFERENCES pricing_products(id) ON DELETE CASCADE,
    FOREIGN KEY (materialId) REFERENCES materials(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_pricing_product_items_productId ON pricing_product_items(productId);

-- 附加费率
CREATE TABLE IF NOT EXISTS pricing_rates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    percentage REAL DEFAULT 0,
    isActive INTEGER DEFAULT 1,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 报价记录
CREATE TABLE IF NOT EXISTS pricing_quotes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    productId TEXT,
    productName TEXT,
    width REAL DEFAULT 0,
    height REAL DEFAULT 0,
    quantity REAL DEFAULT 1,
    area REAL DEFAULT 0,
    perimeter REAL DEFAULT 0,
    costTotal REAL DEFAULT 0,
    retailTotal REAL DEFAULT 0,
    details TEXT NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (productId) REFERENCES pricing_products(id) ON DELETE SET NULL
);

INSERT OR IGNORE INTO material_categories (id, name, sortOrder)
VALUES ('default-material-category', '默认材料分类', 0);

INSERT OR IGNORE INTO material_pricing_modes (id, name, unitLabel, sortOrder)
VALUES ('area', '按面积', '㎡', 0);

INSERT OR IGNORE INTO material_pricing_modes (id, name, unitLabel, sortOrder)
VALUES ('perimeter', '按长度', 'm', 1);

INSERT OR IGNORE INTO material_pricing_modes (id, name, unitLabel, sortOrder)
VALUES ('fixed', '按件数', '件', 2);

INSERT OR IGNORE INTO pricing_rates (id, name, percentage, isActive)
VALUES ('default-pricing-rate', '基础损耗费', 0, 1);
