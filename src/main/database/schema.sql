-- DXF 窗户算料系统 - 数据库结构定义
-- 每次修改表结构请同步更新此文件

CREATE TABLE IF NOT EXISTS windows (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    shapeType TEXT NOT NULL,
    width REAL NOT NULL,
    height REAL NOT NULL,
    area REAL NOT NULL,
    glassArea REAL DEFAULT 0,
    perimeter REAL NOT NULL,
    frameWeight REAL DEFAULT 0,
    points TEXT NOT NULL, -- 存储顶点坐标的 JSON 字符串
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 索引优化：方便按分类查询
CREATE INDEX IF NOT EXISTS idx_windows_category ON windows(category);
