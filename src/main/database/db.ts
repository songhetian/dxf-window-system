import Database from 'better-sqlite3';
import { Kysely, SqliteDialect } from 'kysely';
import { WindowItem } from '../../shared/schemas';
import fs from 'fs';
import path from 'path';

interface DatabaseSchema {
  windows: WindowItem;
}

export const initDb = (dbPath: string) => {
  const db = new Database(dbPath);
  
  // 从 schema.sql 读取结构定义
  try {
    const schemaPath = path.join(__dirname, 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      const sql = fs.readFileSync(schemaPath, 'utf8');
      db.exec(sql);
      console.log('Database schema initialized from schema.sql');
    } else {
      // 生产环境打包后的处理逻辑 (如果 schema.sql 没被打包)
      console.warn('schema.sql not found, using fallback initialization');
    }
  } catch (err) {
    console.error('Failed to initialize database schema:', err);
  }

  return new Kysely<DatabaseSchema>({
    dialect: new SqliteDialect({
      database: db,
    }),
  });
};
