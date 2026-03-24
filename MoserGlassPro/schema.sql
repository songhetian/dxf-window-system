-- 1. 顶级分类
CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    type TEXT DEFAULT 'CUSTOM'
);

-- 2. 基础资产单项 (单价与计价逻辑在此定义)
CREATE TABLE IF NOT EXISTS base_library (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER,
    name TEXT NOT NULL,
    price_type TEXT DEFAULT 'AREA', -- 'AREA' (平米), 'LINEAR' (延米), 'FIXED' (件/瓶/个)
    unit_name TEXT DEFAULT '平米',   -- 如 '件', '瓶', '延米', '个'
    agency_price REAL DEFAULT 0,
    guide_price REAL DEFAULT 0,
    UNIQUE(category_id, name),
    FOREIGN KEY (category_id) REFERENCES categories(id)
);

-- 3. 定价资产模板 (不再存储固定价格)
CREATE TABLE IF NOT EXISTS priced_assets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    display_name TEXT NOT NULL,
    color TEXT DEFAULT '#adc2d1',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 4. 资产与基础项的映射关系
CREATE TABLE IF NOT EXISTS asset_component_map (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    asset_id INTEGER,
    base_item_id INTEGER,
    FOREIGN KEY (asset_id) REFERENCES priced_assets(id) ON DELETE CASCADE,
    FOREIGN KEY (base_item_id) REFERENCES base_library(id)
);

-- 5. 费率与模板
CREATE TABLE IF NOT EXISTS fee_definitions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    default_rate REAL DEFAULT 0,
    is_active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    bom_json TEXT NOT NULL,
    width INTEGER,
    height INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
