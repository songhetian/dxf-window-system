import Database from 'better-sqlite3';
import { Kysely, SqliteDialect } from 'kysely';
import { WindowItem } from '../../shared/schemas';

interface DatabaseSchema {
  windows: WindowItem;
}

// 数据库初始化
export const initDb = (path: string) => {
  const db = new Database(path);
  
  // 创建窗户表 (如果不存在)
  db.exec(`
    CREATE TABLE IF NOT EXISTS windows (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      shapeType TEXT NOT NULL,
      width REAL NOT NULL,
      height REAL NOT NULL,
      area REAL NOT NULL,
      perimeter REAL NOT NULL,
      points TEXT NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  return new Kysely<DatabaseSchema>({
    dialect: new SqliteDialect({
      database: db,
    }),
  });
};
