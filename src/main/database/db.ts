import Database from 'better-sqlite3';
import { Kysely, SqliteDialect } from 'kysely';
import { WindowItem, DrawingItem } from '../../shared/schemas';
import fs from 'fs';
import path from 'path';

interface DatabaseSchema {
  windows: WindowItem;
  drawings: DrawingItem;
}

export const initDb = (dbPath: string) => {
  const db = new Database(dbPath);
  
  // 检查是否已经初始化过
  const tableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='drawings'").get();

  if (!tableExists) {
    console.log('Database not initialized. Running schema.sql...');
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
        db.exec(sql);
        console.log(`Database schema initialized from ${schemaPath}`);
      } else {
        // 兜底创建
        db.exec(`
          CREATE TABLE IF NOT EXISTS drawings (
              id TEXT PRIMARY KEY,
              title TEXT NOT NULL,
              fileName TEXT NOT NULL,
              windowCount INTEGER DEFAULT 0,
              totalArea REAL DEFAULT 0,
              createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
          );
          CREATE TABLE IF NOT EXISTS windows (
              id TEXT PRIMARY KEY,
              drawingId TEXT,
              name TEXT NOT NULL,
              category TEXT NOT NULL,
              shapeType TEXT NOT NULL,
              width REAL NOT NULL,
              height REAL NOT NULL,
              area REAL NOT NULL,
              glassArea REAL DEFAULT 0,
              perimeter REAL NOT NULL,
              frameWeight REAL DEFAULT 0,
              points TEXT NOT NULL,
              createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (drawingId) REFERENCES drawings(id) ON DELETE CASCADE
          );
        `);
      }
    } catch (err) {
      console.error('Failed to initialize database schema:', err);
    }
  } else {
    console.log('Database already initialized. Skipping schema execution.');
  }

  return new Kysely<DatabaseSchema>({
    dialect: new SqliteDialect({
      database: db,
    }),
  });
};
