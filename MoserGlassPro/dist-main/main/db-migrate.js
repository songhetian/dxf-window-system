import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
const dbPath = path.resolve('glass_pro.db');
const db = new Database(dbPath);
try {
    console.log('开始执行数据库升级...');
    // 1. 创建分类表
    db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      type TEXT NOT NULL
    )
  `);
    // 2. 更新 product_prices 表结构
    const tableInfo = db.prepare("PRAGMA table_info(product_prices)").all();
    const columns = tableInfo.map(c => c.name);
    if (!columns.includes('color')) {
        console.log('添加 color 字段...');
        db.exec('ALTER TABLE product_prices ADD COLUMN color TEXT');
    }
    if (!columns.includes('display_name')) {
        console.log('添加 display_name 字段...');
        db.exec('ALTER TABLE product_prices ADD COLUMN display_name TEXT');
    }
    // 3. 注入种子数据
    const insertCat = db.prepare('INSERT OR IGNORE INTO categories (name, type) VALUES (?, ?)');
    insertCat.run('玻璃原片', 'MATERIAL');
    insertCat.run('间隔系统', 'ACCESSORY');
    insertCat.run('填充气体', 'ACCESSORY');
    insertCat.run('加工工艺', 'MATERIAL');
    console.log('数据库升级成功！');
}
catch (err) {
    console.error('升级失败:', err);
}
finally {
    db.close();
}
