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
    points TEXT NOT NULL, -- 存储顶点坐标的 JSON 字符串
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (drawingId) REFERENCES drawings(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_windows_drawingId ON windows(drawingId);
CREATE INDEX IF NOT EXISTS idx_windows_category ON windows(category);
