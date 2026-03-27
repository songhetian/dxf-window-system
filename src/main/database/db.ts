import Database from 'better-sqlite3';
import { Kysely, SqliteDialect } from 'kysely';
import {
  MaterialCategory,
  MaterialPricingMode,
  MaterialItem,
  PricingProduct,
} from '../../shared/schemas';
import fs from 'fs';
import path from 'path';

interface DatabaseSchema {
  material_categories: MaterialCategory;
  material_pricing_modes: MaterialPricingMode;
  materials: MaterialItem;
  pricing_products: Omit<PricingProduct, 'items'>;
  pricing_product_items: any;
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
      try {
        const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
        return columns.some((item) => item.name === column);
      } catch {
        return false;
      }
    };

    if (hasColumn('materials', 'id') && !hasColumn('materials', 'updatedAt')) {
      db.exec(`ALTER TABLE materials ADD COLUMN updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP`);
    }
    if (hasColumn('material_categories', 'id') && !hasColumn('material_categories', 'allowMultipleInProduct')) {
      db.exec(`ALTER TABLE material_categories ADD COLUMN allowMultipleInProduct INTEGER DEFAULT 0`);
    }
    if (hasColumn('material_pricing_modes', 'id') && !hasColumn('material_pricing_modes', 'includeInComboTotal')) {
      db.exec(`ALTER TABLE material_pricing_modes ADD COLUMN includeInComboTotal INTEGER DEFAULT 0`);
      db.exec(`UPDATE material_pricing_modes SET includeInComboTotal = 1 WHERE id = 'area'`);
      db.exec(`UPDATE material_pricing_modes SET includeInComboTotal = 0 WHERE id IN ('perimeter', 'fixed')`);
    }
    if (hasColumn('pricing_products', 'id') && !hasColumn('pricing_products', 'updatedAt')) {
      db.exec(`ALTER TABLE pricing_products ADD COLUMN updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP`);
    }
    if (hasColumn('pricing_product_items', 'id')) {
      if (!hasColumn('pricing_product_items', 'calcMode')) {
        db.exec(`ALTER TABLE pricing_product_items ADD COLUMN calcMode TEXT DEFAULT 'area'`);
      }
      if (!hasColumn('pricing_product_items', 'includeInComboTotal')) {
        db.exec(`ALTER TABLE pricing_product_items ADD COLUMN includeInComboTotal INTEGER DEFAULT 0`);
        db.exec(`
          UPDATE pricing_product_items
          SET includeInComboTotal = COALESCE(
            (
              SELECT includeInComboTotal
              FROM material_pricing_modes
              WHERE material_pricing_modes.id = materials.unitType
            ),
            0
          )
          FROM materials
          WHERE materials.id = pricing_product_items.materialId
        `);
      }
      if (!hasColumn('pricing_product_items', 'sortOrder')) {
        db.exec(`ALTER TABLE pricing_product_items ADD COLUMN sortOrder INTEGER DEFAULT 0`);
      }
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
