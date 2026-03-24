import Database from 'better-sqlite3';
import { Kysely, SqliteDialect } from 'kysely';
import {
  WindowItem,
  DrawingItem,
  MaterialCategory,
  MaterialPricingMode,
  MaterialItem,
  PricingProduct,
  PricingRate,
  PricingQuote,
} from '../../shared/schemas';
import fs from 'fs';
import path from 'path';

interface DatabaseSchema {
  windows: WindowItem;
  drawings: DrawingItem;
  standards: any;
  material_categories: MaterialCategory;
  material_pricing_modes: MaterialPricingMode;
  materials: MaterialItem;
  pricing_products: Omit<PricingProduct, 'items'>;
  pricing_product_items: any;
  pricing_rates: PricingRate;
  pricing_quotes: Omit<PricingQuote, 'details'> & { details: string };
}

export const initDb = (dbPath: string) => {
  const db = new Database(dbPath);
  db.pragma('foreign_keys = ON');
  
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

  try {
    const hasColumn = (table: string, column: string) => {
      const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
      return columns.some((item) => item.name === column);
    };

    if (!hasColumn('materials', 'updatedAt')) {
      db.exec(`ALTER TABLE materials ADD COLUMN updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP`);
    }
    if (!hasColumn('pricing_products', 'updatedAt')) {
      db.exec(`ALTER TABLE pricing_products ADD COLUMN updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP`);
    }
    if (!hasColumn('standards', 'minWindowArea')) {
      db.exec(`ALTER TABLE standards ADD COLUMN minWindowArea REAL DEFAULT 0.08`);
    }
    if (!hasColumn('standards', 'minSideLength')) {
      db.exec(`ALTER TABLE standards ADD COLUMN minSideLength REAL DEFAULT 180`);
    }
    if (!hasColumn('standards', 'labelMaxDistance')) {
      db.exec(`ALTER TABLE standards ADD COLUMN labelMaxDistance REAL DEFAULT 600`);
    }
    if (!hasColumn('standards', 'layerIncludeKeywords')) {
      db.exec(`ALTER TABLE standards ADD COLUMN layerIncludeKeywords TEXT DEFAULT '窗,window,win'`);
    }
    if (!hasColumn('standards', 'layerExcludeKeywords')) {
      db.exec(`ALTER TABLE standards ADD COLUMN layerExcludeKeywords TEXT DEFAULT '标注,text,dim,轴网,图框,title'`);
    }
  } catch (err) {
    console.error('Failed to ensure migrated columns:', err);
  }

  return new Kysely<DatabaseSchema>({
    dialect: new SqliteDialect({
      database: db,
    }),
  });
};
