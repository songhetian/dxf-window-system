import { app, ipcMain, dialog } from "electron";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
// 移除exec和promisify的导入，因为不再使用child_process
// import { exec } from "child_process";
// import { promisify } from "util";
// const execPromise = promisify(exec); // 不再需要
// db.js 应该是 CommonJS 模块，不需要 fileURLToPath 和 import.meta.url 来定义 __dirname
// __dirname 在 CommonJS 模块中默认可用
// const __dirname = path.dirname(fileURLToPath(import.meta.url));
function getDbPath() {
    const userDataPath = app.getPath("userData");
    const targetPath = path.join(userDataPath, "glass_pro.db");
    // 打包环境下的自动迁移逻辑
    if (app.isPackaged || process.env.NODE_ENV !== "development") {
        if (!fs.existsSync(targetPath)) {
            // 检查 resources 目录下的模板
            const sourcePath = path.join(process.resourcesPath, "glass_pro.db");
            if (fs.existsSync(sourcePath)) {
                try {
                    fs.copyFileSync(sourcePath, targetPath);
                    console.log("数据库已成功初始化至用户目录:", targetPath);
                }
                catch (e) {
                    console.error("数据库迁移失败:", e);
                }
            }
        }
        return targetPath;
    }
    // 开发环境下逻辑
    const devPaths = [
        path.join(process.cwd(), "glass_pro.db"),
        path.join(app.getAppPath(), "glass_pro.db"),
    ];
    for (const p of devPaths) {
        if (fs.existsSync(p))
            return p;
    }
    return targetPath;
}
const dbPath = getDbPath();
let db;
function forceSyncSchema() {
    console.log("[数据库] 执行结构自愈与字段校准...");
    try {
        const schemaPath = path.join(process.cwd(), "schema.sql");
        if (fs.existsSync(schemaPath)) {
            db.exec(fs.readFileSync(schemaPath, "utf8"));
        }
        // 1. base_library 计价字段校准
        const blInfo = db.prepare("PRAGMA table_info(base_library)").all();
        const blCols = blInfo.map((c) => c.name);
        if (!blCols.includes("price_type")) {
            db.exec("ALTER TABLE base_library ADD COLUMN price_type TEXT DEFAULT 'AREA'");
        }
        if (!blCols.includes("agency_price")) {
            db.exec("ALTER TABLE base_library ADD COLUMN agency_price REAL DEFAULT 0");
        }
        if (!blCols.includes("guide_price")) {
            db.exec("ALTER TABLE base_library ADD COLUMN guide_price REAL DEFAULT 0");
        }
        if (!blCols.includes("unit_name")) {
            db.exec("ALTER TABLE base_library ADD COLUMN unit_name TEXT DEFAULT '平米'");
        }
        // 2. priced_assets 结构精简 (仅保留显示名和颜色)
        const paInfo = db.prepare("PRAGMA table_info(priced_assets)").all();
        if (paInfo.some((c) => c.name === "guide_price")) {
            console.log("[自愈] 资产表包含冗余静态价格字段，正在切换至动态计算模式...");
        }
        // 3. fee_definitions 字段校准
        const fdInfo = db.prepare("PRAGMA table_info(fee_definitions)").all();
        if (!fdInfo.some((c) => c.name === "is_active")) {
            db.exec("ALTER TABLE fee_definitions ADD COLUMN is_active INTEGER DEFAULT 1");
        }
        // 种子数据注入：确保基础分类存在
        const categoryCount = db
            .prepare("SELECT COUNT(*) as count FROM categories")
            .get().count;
        if (categoryCount === 0) {
            console.log("[种子] 注入基础分类数据...");
            const insertCat = db.prepare("INSERT INTO categories (name, type) VALUES (?, ?)");
            const cats = [
                { name: "玻璃原片", type: "MATERIAL" },
                { name: "间隔系统", type: "ACCESSORY" },
                { name: "密封辅料", type: "ACCESSORY" },
                { name: "五金配件", type: "HARDWARE" },
                { name: "玻璃胶/辅材", type: "GLUE" },
            ];
            cats.forEach((c) => insertCat.run(c.name, c.type));
            // 注入初始物料示例
            const insertItem = db.prepare("INSERT INTO base_library (name, category_id, price_type, unit_name, agency_price, guide_price) VALUES (?, ?, ?, ?, ?, ?)");
            insertItem.run("5mm 透明白玻", 1, "AREA", "平米", 45, 80);
            insertItem.run("12A 铝间隔条", 2, "LINEAR", "延米", 8, 15);
            insertItem.run("三元乙丙密封胶条", 3, "LINEAR", "延米", 5, 12);
            insertItem.run("外开窗五金(全套)", 4, "FIXED", "件", 120, 260);
            insertItem.run("结构胶", 5, "FIXED", "瓶", 18, 45);
        }
        // 种子数据注入：确保基础费率存在
        const feeCount = db
            .prepare("SELECT COUNT(*) as count FROM fee_definitions")
            .get().count;
        if (feeCount === 0) {
            console.log("[种子] 注入基础费率定义...");
            const insertFee = db.prepare("INSERT INTO fee_definitions (name, default_rate, is_active) VALUES (?, ?, ?)");
            insertFee.run("管理费", 0.05, 1);
            insertFee.run("运输费", 0.03, 1);
            insertFee.run("税金", 0.08, 1);
        }
    }
    catch (e) {
        console.error("Schema Sync Error:", e.message);
    }
}
function initDb() {
    try {
        if (db)
            db.close();
        db = new Database(dbPath);
        db.pragma("journal_mode = WAL");
        forceSyncSchema();
    }
    catch (err) {
        console.error("数据库启动严重错误:", err);
    }
}
initDb();
export function setupIpcHandlers() {
    // 确保在 handlers 设置前至少尝试初始化一次，但不阻塞导出
    if (!db) {
        try {
            initDb();
        }
        catch (e) {
            console.error("Delayed DB Init Error:", e);
        }
    }
    // 1. 分类管理
    ipcMain.handle("db:getCategories", () => {
        try {
            return db.prepare("SELECT * FROM categories").all();
        }
        catch (e) {
            return [];
        }
    });
    ipcMain.handle("db:addCategory", (_, d) => db
        .prepare("INSERT INTO categories (name, type) VALUES (?, ?)")
        .run(d.name, "CUSTOM"));
    ipcMain.handle("db:deleteCategory", (_, id) => db.prepare("DELETE FROM categories WHERE id = ?").run(id));
    // 2. 基础库单项 (支持单价与计价类型)
    ipcMain.handle("db:getBaseLibrary", () => db
        .prepare("SELECT bl.*, c.name as categoryName FROM base_library bl JOIN categories c ON bl.category_id = c.id")
        .all());
    ipcMain.handle("db:addBaseItem", (_, d) => {
        return db
            .prepare("INSERT INTO base_library (name, category_id, price_type, unit_name, agency_price, guide_price) VALUES (?, ?, ?, ?, ?, ?)")
            .run(d.name, d.category_id, d.price_type || "AREA", d.unit_name || "平米", d.agency_price || 0, d.guide_price || 0);
    });
    ipcMain.handle("db:deleteBaseItem", (_, id) => db.prepare("DELETE FROM base_library WHERE id = ?").run(id));
    ipcMain.handle("db:updateBaseItem", (_, d) => {
        if (d.table === "fee_definitions")
            return db
                .prepare("UPDATE fee_definitions SET name = ?, default_rate = ? WHERE id = ?")
                .run(d.name, d.rate, d.id);
        if (d.table === "categories")
            return db
                .prepare("UPDATE categories SET name = ? WHERE id = ?")
                .run(d.name, d.id);
        return db
            .prepare("UPDATE base_library SET name = ?, category_id = ?, price_type = ?, unit_name = ?, agency_price = ?, guide_price = ? WHERE id = ?")
            .run(d.name, d.category_id, d.price_type, d.unit_name, d.agency_price, d.guide_price, d.id);
    });
    // 3. 定价资产 (资产本身不再存储价格，价格由组件动态汇总)
    ipcMain.handle("db:getMatrixData", () => {
        try {
            // 这里的价格将作为“基础单位价格”参考，不考虑尺寸。
            // 实际计算将在前端或计算逻辑中根据 w/h 实时算出。
            return db
                .prepare(`
        SELECT
          pa.id as comboId,
          pa.display_name as displayName,
          pa.color as color,
          (SELECT GROUP_CONCAT(bl.name, ' + ') FROM asset_component_map acm JOIN base_library bl ON acm.base_item_id = bl.id WHERE acm.asset_id = pa.id) as componentsDesc,
          (SELECT SUM(bl.guide_price) FROM asset_component_map acm JOIN base_library bl ON acm.base_item_id = bl.id WHERE acm.asset_id = pa.id) as totalGuidePrice,
          (SELECT SUM(bl.agency_price) FROM asset_component_map acm JOIN base_library bl ON acm.base_item_id = bl.id WHERE acm.asset_id = pa.id) as totalAgencyPrice
        FROM priced_assets pa ORDER BY pa.created_at DESC
      `)
                .all();
        }
        catch (e) {
            return [];
        }
    });
    ipcMain.handle("db:addPricedAsset", (_, { name, color, componentIds }) => {
        const transaction = db.transaction(() => {
            const info = db
                .prepare("INSERT INTO priced_assets (display_name, color) VALUES (?, ?)")
                .run(name, color);
            const assetId = info.lastInsertRowid;
            const insertMap = db.prepare("INSERT INTO asset_component_map (asset_id, base_item_id) VALUES (?, ?)");
            for (const baseId of componentIds) {
                insertMap.run(assetId, baseId);
            }
            return assetId;
        });
        return { lastInsertRowid: transaction() };
    });
    ipcMain.handle("db:getAssetComponents", (_, assetId) => db
        .prepare(`
    SELECT bl.*, c.name as categoryName
    FROM asset_component_map acm
    JOIN base_library bl ON acm.base_item_id = bl.id
    JOIN categories c ON bl.category_id = c.id
    WHERE acm.asset_id = ?
  `)
        .all(assetId));
    ipcMain.handle("db:deletePricedAsset", (_, id) => db.prepare("DELETE FROM priced_assets WHERE id = ?").run(id));
    ipcMain.handle("db:updatePrice", (_, { comboId, field, value }) => {
        const colMap = { color: "color", displayName: "display_name" };
        if (!colMap[field])
            return { changes: 0 };
        return db
            .prepare(`UPDATE priced_assets SET ${colMap[field]} = ? WHERE id = ?`)
            .run(value, comboId);
    });
    // 4. 费率管理
    ipcMain.handle("db:getFeeDefinitions", () => db.prepare("SELECT * FROM fee_definitions").all());
    ipcMain.handle("db:addFee", (_, { name, rate }) => {
        return db
            .prepare("INSERT INTO fee_definitions (name, default_rate, is_active) VALUES (?, ?, 1)")
            .run(name, rate);
    });
    ipcMain.handle("db:deleteFee", (_, id) => {
        return db.prepare("DELETE FROM fee_definitions WHERE id = ?").run(id);
    });
    // 5. 模板与物理管理
    ipcMain.handle("db:getTemplates", () => db.prepare("SELECT * FROM templates ORDER BY created_at DESC").all());
    ipcMain.handle("db:saveTemplate", (_, { name, bom, width, height }) => {
        const id = crypto.randomUUID();
        return db
            .prepare("INSERT INTO templates (id, name, bom_json, width, height) VALUES (?, ?, ?, ?, ?)")
            .run(id, name, JSON.stringify(bom), width, height);
    });
    ipcMain.handle("db:deleteTemplate", (_, id) => db.prepare("DELETE FROM templates WHERE id = ?").run(id));
    ipcMain.handle("db:exportDatabase", async () => {
        const { filePath } = await dialog.showSaveDialog({
            title: "导出备份",
            defaultPath: `moser_glass_backup_${new Date().toISOString().split("T")[0]}.db`,
            filters: [{ name: "SQLite", extensions: ["db"] }],
        });
        if (filePath) {
            fs.copyFileSync(dbPath, filePath);
            return { success: true, path: filePath };
        }
        return { success: false };
    });
    ipcMain.handle("db:importDatabase", async () => {
        const { filePaths } = await dialog.showOpenDialog({
            title: "还原备份",
            filters: [{ name: "SQLite", extensions: ["db"] }],
            properties: ["openFile"],
        });
        if (filePaths && filePaths[0]) {
            try {
                db.close();
                fs.copyFileSync(filePaths[0], dbPath);
                initDb();
                return { success: true };
            }
            catch (e) {
                console.error("Import Error:", e);
                initDb(); // 确保即便失败也尝试恢复连接
                return { success: false };
            }
        }
        return { success: false };
    });
    ipcMain.handle("db:resetDatabase", async () => {
        try {
            db.pragma("foreign_keys = OFF");
            db.transaction(() => {
                const tables = [
                    "asset_component_map",
                    "priced_assets",
                    "asset_combinations",
                    "base_library",
                    "categories",
                    "template_fee_configs",
                    "template_layers",
                    "combination_templates",
                    "product_prices",
                    "spec_sub_library",
                    "library_options",
                    "specs",
                    "project_items",
                    "projects",
                    "fee_definitions",
                    "templates",
                ];
                for (const table of tables) {
                    try {
                        db.prepare(`DELETE FROM ${table}`).run();
                    }
                    catch (e) {
                        // 忽略表不存在的情况
                    }
                }
                try {
                    db.prepare("DELETE FROM sqlite_sequence").run();
                }
                catch (e) { }
            })();
            db.pragma("foreign_keys = ON");
            db.exec("VACUUM"); // 物理压缩
            return { success: true };
        }
        catch (e) {
            console.error("Reset Error:", e);
            return { success: false };
        }
    });
}
export { db };
