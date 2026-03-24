-- 清理
DELETE FROM template_fee_configs;
DELETE FROM template_layers;
DELETE FROM combination_templates;
DELETE FROM fee_definitions;
DELETE FROM product_prices;
DELETE FROM spec_sub_library;
DELETE FROM library_options;
DELETE FROM specs;

-- --- 1. 规格库 (L1) ---
INSERT INTO specs (id, name, category) VALUES (1, '5G', 'MATERIAL');
INSERT INTO specs (id, name, category) VALUES (2, '6G', 'MATERIAL');
INSERT INTO specs (id, name, category) VALUES (3, '8G', 'MATERIAL');
INSERT INTO specs (id, name, category) VALUES (4, '10G', 'MATERIAL');
INSERT INTO specs (id, name, category) VALUES (10, '9A', 'ACCESSORY');
INSERT INTO specs (id, name, category) VALUES (11, '12A', 'ACCESSORY');
INSERT INTO specs (id, name, category) VALUES (12, '14A', 'ACCESSORY');
INSERT INTO specs (id, name, category) VALUES (20, '0.38 PVB', 'ACCESSORY');
INSERT INTO specs (id, name, category) VALUES (30, '氩气', 'ACCESSORY');

-- --- 2. 属性库 (L2) ---
INSERT INTO library_options (id, name, category) VALUES (1, '白玻', 'MATERIAL');
INSERT INTO library_options (id, name, category) VALUES (2, '超白增加', 'MATERIAL');
INSERT INTO library_options (id, name, category) VALUES (3, '超白', 'MATERIAL');
INSERT INTO library_options (id, name, category) VALUES (4, '均质', 'MATERIAL');
INSERT INTO library_options (id, name, category) VALUES (5, '离线Low-E', 'MATERIAL');
INSERT INTO library_options (id, name, category) VALUES (6, '双银Low-E', 'MATERIAL');
INSERT INTO library_options (id, name, category) VALUES (10, '普通铝条', 'ACCESSORY');
INSERT INTO library_options (id, name, category) VALUES (11, '暖边', 'ACCESSORY');
INSERT INTO library_options (id, name, category) VALUES (20, 'PVB常规', 'ACCESSORY');
INSERT INTO library_options (id, name, category) VALUES (30, '标准填充', 'ACCESSORY');

-- --- 3. 规格子库 (白名单) ---
-- 5G 子库
INSERT INTO spec_sub_library (id, spec_id, option_id) VALUES (1, 1, 1); -- 5G-白玻
INSERT INTO spec_sub_library (id, spec_id, option_id) VALUES (2, 1, 2); -- 5G-超白增加
INSERT INTO spec_sub_library (id, spec_id, option_id) VALUES (3, 1, 3); -- 5G-超白
INSERT INTO spec_sub_library (id, spec_id, option_id) VALUES (4, 1, 4); -- 5G-均质
INSERT INTO spec_sub_library (id, spec_id, option_id) VALUES (5, 1, 5); -- 5G-离线Low-E
INSERT INTO spec_sub_library (id, spec_id, option_id) VALUES (6, 1, 6); -- 5G-双银Low-E

-- 12A 子库
INSERT INTO spec_sub_library (id, spec_id, option_id) VALUES (10, 11, 10); -- 12A-普通
INSERT INTO spec_sub_library (id, spec_id, option_id) VALUES (11, 11, 11); -- 12A-暖边

-- 夹胶片子库
INSERT INTO spec_sub_library (id, spec_id, option_id) VALUES (20, 20, 20);

-- --- 4. 价格录入 (严格遵循 Excel 数据) ---
-- 5G 系列
INSERT INTO product_prices (sub_lib_id, agency_price, guide_price, loss_rate) VALUES (1, 55, 132, 1.03);
INSERT INTO product_prices (sub_lib_id, agency_price, guide_price, loss_rate) VALUES (2, 0, 96, 1.03);
INSERT INTO product_prices (sub_lib_id, agency_price, guide_price, loss_rate) VALUES (3, 95, 228, 1.03);
INSERT INTO product_prices (sub_lib_id, agency_price, guide_price, loss_rate) VALUES (4, 0, 60, 1.03);
INSERT INTO product_prices (sub_lib_id, agency_price, guide_price, loss_rate) VALUES (5, 45, 108, 1.03);
INSERT INTO product_prices (sub_lib_id, agency_price, guide_price, loss_rate) VALUES (6, 90, 216, 1.03);

-- 12A 系列
INSERT INTO product_prices (sub_lib_id, agency_price, guide_price, loss_rate) VALUES (10, 45, 108, 1.13);
INSERT INTO product_prices (sub_lib_id, agency_price, guide_price, loss_rate) VALUES (11, 80, 192, 1.13);

-- 夹胶片
INSERT INTO product_prices (sub_lib_id, agency_price, guide_price, loss_rate) VALUES (20, 30, 75, 1.0);

-- --- 5. 费率定义 (百分比) ---
INSERT INTO fee_definitions (id, name, default_rate, is_optional) VALUES (1, '安装费', 0.10, 0);
INSERT INTO fee_definitions (id, name, default_rate, is_optional) VALUES (2, '服务费', 0.05, 0);
INSERT INTO fee_definitions (id, name, default_rate, is_optional) VALUES (3, '折损费', 0.03, 1);

-- --- 6. 初始模板示例 ---
INSERT INTO combination_templates (id, name) VALUES (1, '三玻两腔-5G白玻标准型');
INSERT INTO template_layers (template_id, price_id, quantity) VALUES (1, 1, 1);
INSERT INTO template_layers (template_id, price_id, quantity) VALUES (1, 10, 1);
INSERT INTO template_layers (template_id, price_id, quantity) VALUES (1, 1, 2);