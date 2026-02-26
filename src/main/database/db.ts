import Database from 'better-sqlite3';
import { Kysely, SqliteDialect } from 'kysely';
import { WindowItem, DrawingItem } from '../../shared/schemas';
import fs from 'fs';
import path from 'path';

interface DatabaseSchema {
  windows: WindowItem;
  drawings: DrawingItem;
  standards: any;
}

export const initDb = (dbPath: string) => {
  const db = new Database(dbPath);
  
  // 始终尝试运行 CREATE TABLE IF NOT EXISTS 语句，以支持版本升级
  try {
    const possiblePaths = [
      path.join(__dirname, 'schema.sql'),
      path.join(__dirname, '../database/schema.sql'),
      path.join(process.cwd(), 'src/main/database/schema.sql'),
    ];

    let schemaPath = '';
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        schemaPath = p;
        break;
      }
    }

    if (schemaPath) {
      const sql = fs.readFileSync(schemaPath, 'utf8');
      // 分解 SQL 语句逐条执行，防止某些语句因已存在而中断
      sql.split(';').forEach(stmt => {
        if (stmt.trim()) db.exec(stmt);
      });
      console.log(`Database schema verified from ${schemaPath}`);
    }
  } catch (err) {
    console.error('Failed to update database schema:', err);
  }

  return new Kysely<DatabaseSchema>({
    dialect: new SqliteDialect({
      database: db,
    }),
  });
};
