const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'glass_pro.db');
const db = new Database(dbPath);

// 初始化表结构
db.exec(`
  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL -- 'glass', 'spacer', 'pvb', 'gas', 'process', 'rate'
  );

  CREATE TABLE IF NOT EXISTS materials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER,
    name TEXT NOT NULL,
    spec TEXT,
    agency_price REAL DEFAULT 0,
    guide_price REAL DEFAULT 0,
    loss_rate REAL DEFAULT 1.0,
    FOREIGN KEY (category_id) REFERENCES categories(id)
  );

  CREATE TABLE IF NOT EXISTS configs (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`);

// 插入初始费率和损耗
const initialConfigs = [
  ['glass_loss', '1.03'],
  ['spacer_loss', '1.13'],
  ['steel_loss', '1.06'],
  ['management_fee', '0.04'],
  ['profit_rate', '0.04'],
  ['tax_rate', '0.0348']
];

const insertConfig = db.prepare('INSERT OR IGNORE INTO configs (key, value) VALUES (?, ?)');
initialConfigs.forEach(cfg => insertConfig.run(cfg));

console.log('Database initialized successfully at:', dbPath);
db.close();
