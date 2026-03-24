import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import xlsx from 'xlsx';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(__dirname, '../../glass_pro.db');
const excelPath = path.resolve(__dirname, '../../../墨瑟玻璃计算价格.xlsx');

const db = new Database(dbPath);

async function importData() {
  const workbook = xlsx.readFile(excelPath);
  const sheet = workbook.Sheets['价格'];
  const data = xlsx.utils.sheet_to_json(sheet);

  // 获取分类 ID
  const categories = db.prepare('SELECT id, type FROM categories').all();
  const catMap = categories.reduce((acc, c) => ({ ...acc, [c.type]: c.id }), {});

  const insertMaterial = db.prepare(`
    INSERT OR REPLACE INTO materials (category_id, name, agency_price, guide_price, loss_rate, unit)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const importTransaction = db.transaction(() => {
    // 清空现有物料（可选，为了确保数据纯净）
    // db.prepare('DELETE FROM materials').run();

    data.forEach(row => {
      const spec = row['__EMPTY']; // 规格如 5G, 6G, 12A
      if (!spec || spec === '规格') return;

      // 1. 处理玻璃基材
      if (spec.includes('G')) {
        const catId = catMap['GLASS_BASE'];
        const types = [
          { name: '白玻', agency: '__EMPTY_1', guide: '__EMPTY_8' },
          { name: '超白', agency: '__EMPTY_2', guide: '__EMPTY_10' },
          { name: '离线low-e', agency: '__EMPTY_3', guide: '__EMPTY_12' },
          { name: '双银low-e', agency: '__EMPTY_4', guide: '__EMPTY_13' }
        ];

        types.forEach(t => {
          const agencyPrice = parseFloat(row[t.agency]);
          const guidePrice = parseFloat(row[t.guide]);
          if (!isNaN(agencyPrice) && !isNaN(guidePrice)) {
            insertMaterial.run(catId, `${spec} ${t.name}`, agencyPrice, guidePrice, 1.03, '㎡');
          }
        });
      }

      // 2. 处理间隔条
      if (spec.includes('A')) {
        const catId = catMap['SPACER'];
        // 普通
        const agencyPrice = parseFloat(row['__EMPTY_1']);
        const guidePrice = parseFloat(row['__EMPTY_8']);
        if (!isNaN(agencyPrice)) {
          insertMaterial.run(catId, spec, agencyPrice, guidePrice || agencyPrice * 2.4, 1.13, 'm');
        }
        // 暖边
        const agencyWarm = parseFloat(row['__EMPTY_4']);
        const guideWarm = parseFloat(row['__EMPTY_13']);
        if (!isNaN(agencyWarm)) {
          insertMaterial.run(catId, `${spec} 暖边`, agencyWarm, guideWarm || agencyWarm * 2.4, 1.13, 'm');
        }
      }
    });
  });

  importTransaction();
  console.log('Excel 数据导入完成！');
}

importData().catch(console.error);
