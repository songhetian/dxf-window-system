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

-- 初始化默认数据
INSERT OR IGNORE INTO material_categories (id, name, sortOrder)
VALUES ('default-material-category', '默认材料分类', 0);

INSERT OR IGNORE INTO material_pricing_modes (id, name, unitLabel, includeInComboTotal, sortOrder)
VALUES ('area', '按面积', '㎡', 1, 0);

INSERT OR IGNORE INTO material_pricing_modes (id, name, unitLabel, includeInComboTotal, sortOrder)
VALUES ('perimeter', '按长度', 'm', 0, 1);

INSERT OR IGNORE INTO material_pricing_modes (id, name, unitLabel, includeInComboTotal, sortOrder)
VALUES ('fixed', '按件数', '件', 0, 2);
