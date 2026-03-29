// @ts-nocheck
export interface ExportData {
  projectName: string;
  buildingName: string;
  items: any[];
  materials: any[];
  products: any[];
}

type BreakdownBucket = 'profile' | 'glass' | 'hardware' | 'accessory';
type AppliedRateSetting = { rateId: string; name: string; percentage: number; enabled: boolean };

const loadExcelJS = async () => (await import('exceljs')).default;

const saveWorkbook = async (workbook: any, filename: string) => {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
};

const collectAllocationLabels = (record: { items: any[]; allocationLabels?: string[] }) => {
  if (record.allocationLabels && record.allocationLabels.length > 0) {
    return record.allocationLabels;
  }
  return Array.from(new Set(record.items.flatMap((item) => (item.allocations || []).map((allocation: any) => allocation.label)).filter(Boolean)));
};

const getCategoryLabel = (item: any) => {
  if (item.shape === 'RECTANGLE') return '矩形';
  if (item.shape === 'TRIANGLE') return '三角';
  if (item.shape === 'TRAPEZOID') return '梯形';
  if (item.shape === 'CIRCLE') return '圆形';
  if (item.shape === 'CUSTOM') return '异形';
  return item.productName || item.shape || '常规';
};

const getUniqueSheetName = (workbook: any, preferredName: string) => {
  const sanitized = preferredName.replace(/[\\\/\?\*\[\]]/g, '').substring(0, 31) || '工作表';
  if (!workbook.getWorksheet(sanitized)) return sanitized;
  let index = 2;
  while (index < 1000) {
    const suffix = ` (${index})`;
    const candidate = `${sanitized.substring(0, 31 - suffix.length)}${suffix}`;
    if (!workbook.getWorksheet(candidate)) return candidate;
    index += 1;
  }
  return `${sanitized.substring(0, 28)}...`;
};

const makeSheetLink = (sheetName: string, text?: string) => ({
  text: text || sheetName,
  hyperlink: `#'${sheetName}'!A1`,
});

const toNumber = (value: unknown) => Number(value || 0);
const parseRateSettings = (raw: unknown): AppliedRateSetting[] => {
  if (!raw) return [];
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Array.isArray(parsed)
      ? parsed.map((item: any) => ({
          rateId: String(item.rateId || ''),
          name: String(item.name || ''),
          percentage: Number(item.percentage || 0),
          enabled: Boolean(item.enabled),
        })).filter((item) => item.rateId)
      : [];
  } catch {
    return [];
  }
};

const mergeRateSettings = (templates: any[], current: AppliedRateSetting[]) => {
  const currentMap = new Map(current.map((item) => [item.rateId, item]));
  return templates.map((rate: any) => ({
    rateId: rate.id || '',
    name: rate.name,
    percentage: currentMap.get(rate.id || '')?.percentage ?? Number(rate.percentage || 0),
    enabled: currentMap.get(rate.id || '')?.enabled ?? Boolean(rate.isActive),
  }));
};

const breakdownBucketMeta: Record<BreakdownBucket, { label: string }> = {
  profile: { label: '主材型材' },
  glass: { label: '玻璃面材' },
  hardware: { label: '五金配件' },
  accessory: { label: '辅材工艺' },
};

const detectBreakdownBucket = (materialName: string, categoryName?: string): BreakdownBucket => {
  const text = `${categoryName || ''} ${materialName}`.toLowerCase();
  if (/(玻璃|中空|夹胶|钢化|百叶|面板|板材)/.test(text)) return 'glass';
  if (/(五金|锁|执手|把手|合页|铰链|滑轮|地弹簧|闭门器)/.test(text)) return 'hardware';
  if (/(型材|边框|框料|扇料|铝材|钢材|立柱|横梁)/.test(text)) return 'profile';
  return 'accessory';
};

const toExcelColumn = (index: number) => {
  let current = index;
  let result = '';
  while (current > 0) {
    const remainder = (current - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    current = Math.floor((current - 1) / 26);
  }
  return result;
};

const collectTypeSummaries = (records: Array<{ items: any[] }>) => {
  const grouped = new Map<string, { quantity: number; area: number; cost: number }>();

  records.forEach((record) => {
    record.items.forEach((item) => {
      const label = String(item.windowType || item.productName || '未分类');
      const quantity = toNumber(item.quantity || item.totalQuantity);
      const areaPerUnit = toNumber(item.area || ((item.width || 0) * (item.height || 0)) / 1000000);
      const totalArea = Number((areaPerUnit * quantity).toFixed(3));
      const totalCost = toNumber(item.totalPrice);
      const current = grouped.get(label) || { quantity: 0, area: 0, cost: 0 };
      current.quantity += quantity;
      current.area += totalArea;
      current.cost += totalCost;
      grouped.set(label, current);
    });
  });

  return Array.from(grouped.entries())
    .map(([label, value]) => ({ label, ...value }))
    .sort((a, b) => a.label.localeCompare(b.label, 'zh-CN'));
};

const collectProjectBreakdown = (records: Array<{ items: any[] }>) => {
  const totals = {
    profile: 0,
    glass: 0,
    hardware: 0,
    accessory: 0,
  } satisfies Record<BreakdownBucket, number>;

  records.forEach((record) => {
    record.items.forEach((item: any) => {
      const area = Number(item.area || item.calculatedArea || 0) || (Number(item.width || 0) * Number(item.height || 0)) / 1000000;
      const quantity = Number(item.quantity || 0);
      const details = [
        ...(Array.isArray(item.compDetails) ? item.compDetails : []),
        ...(Array.isArray(item.accDetails) ? item.accDetails : []),
      ];
      details.forEach((detail: any) => {
        const bucket = detectBreakdownBucket(String(detail.name || ''), String(detail.categoryName || ''));
        totals[bucket] += Number(detail.cost || 0) * area * quantity;
      });
    });
  });

  const totalCost = Object.values(totals).reduce((sum, value) => sum + value, 0);
  return (Object.keys(totals) as BreakdownBucket[]).map((key) => ({
    label: breakdownBucketMeta[key].label,
    cost: totals[key],
    share: totalCost > 0 ? (totals[key] / totalCost) * 100 : 0,
  })).sort((a, b) => b.cost - a.cost);
};

const collectConfigSources = (records: Array<{ sheetName: string; items: any[] }>) => {
  const sourceMap = new Map<string, { configName: string; bucket: BreakdownBucket; sheetName: string; windowType: string; designNumber: string; quantity: number; cost: number; retail: number }>();

  records.forEach((record) => {
    record.items.forEach((item: any) => {
      const area = Number(item.area || item.calculatedArea || 0) || (Number(item.width || 0) * Number(item.height || 0)) / 1000000;
      const quantity = Number(item.quantity || 0);
      const details = [
        ...(Array.isArray(item.compDetails) ? item.compDetails : []),
        ...(Array.isArray(item.accDetails) ? item.accDetails : []),
      ];
      details.forEach((detail: any) => {
        const configName = String(detail.name || '').trim();
        if (!configName) return;
        const bucket = detectBreakdownBucket(configName, String(detail.categoryName || ''));
        const key = `${configName}::${record.sheetName}::${item.windowType || '未分类'}::${item.designNumber || '未命名'}`;
        const current = sourceMap.get(key) || {
          configName,
          bucket,
          sheetName: record.sheetName,
          windowType: item.windowType || '未分类',
          designNumber: item.designNumber || '未命名',
          quantity: 0,
          cost: 0,
          retail: 0,
        };
        current.quantity += quantity;
        current.cost += Number(detail.cost || 0) * area * quantity;
        current.retail += Number(detail.retail || 0) * area * quantity;
        sourceMap.set(key, current);
      });
    });
  });

  return Array.from(sourceMap.values()).sort((a, b) => b.cost - a.cost);
};

const getProductTotalsByMode = (
  product: any,
  materialMap: Map<string, any>,
  view: 'cost' | 'retail',
) => product.items.reduce(
  (sum: { area: number; perimeter: number; fixed: number; total: number }, item: any) => {
    if (!item.includeInComboTotal) return sum;
    const material = materialMap.get(item.materialId);
    const unitPrice = view === 'cost'
      ? Number(material?.costPrice ?? item.costPrice ?? 0)
      : Number(material?.retailPrice ?? item.retailPrice ?? 0);
    const mode = (item.calcMode || 'area') as BreakdownBucket | 'perimeter' | 'fixed';
    if (mode === 'perimeter') sum.perimeter += unitPrice * Number(item.quantity || 0);
    else if (mode === 'fixed') sum.fixed += unitPrice * Number(item.quantity || 0);
    else sum.area += unitPrice * Number(item.quantity || 0);
    sum.total += unitPrice * Number(item.quantity || 0);
    return sum;
  },
  { area: 0, perimeter: 0, fixed: 0, total: 0 },
);

const buildReviewSheet = (
  workbook: any,
  data: {
    projectName: string;
    records: Array<{ sheetName: string; items: any[]; totalArea?: number; totalCost?: number; totalRetail?: number; rateSettings?: string }>;
    projectRateSettings?: string;
    rateTemplates?: any[];
  },
) => {
  const sheet = workbook.addWorksheet('造价复核');
  const projectRates = mergeRateSettings(data.rateTemplates || [], parseRateSettings(data.projectRateSettings));
  const configSources = collectConfigSources(data.records);
  const bucketGroups = (Object.keys(breakdownBucketMeta) as BreakdownBucket[]).map((bucket) => {
    const rows = configSources.filter((item) => item.bucket === bucket).sort((a, b) => b.cost - a.cost);
    return {
      bucket,
      label: breakdownBucketMeta[bucket].label,
      rows,
      totalCost: rows.reduce((sum, item) => sum + item.cost, 0),
      totalRetail: rows.reduce((sum, item) => sum + item.retail, 0),
    };
  }).filter((group) => group.rows.length > 0);
  const perSheetRows = data.records.map((record) => {
    const raw = parseRateSettings(record.rateSettings);
    const effectiveRates = raw.length > 0 ? mergeRateSettings(data.rateTemplates || [], raw) : projectRates;
    const rateSummary = summarizeEnabledRates(effectiveRates);
    return {
      sheetName: record.sheetName,
      totalArea: Number(record.totalArea || 0),
      totalCost: Number(record.totalCost || 0),
      totalRetail: Number(record.totalRetail || 0),
      costPerSqm: Number(record.totalArea || 0) > 0 ? Number(record.totalCost || 0) / Number(record.totalArea || 1) : 0,
      retailPerSqm: Number(record.totalArea || 0) > 0 ? Number(record.totalRetail || 0) / Number(record.totalArea || 1) : 0,
      rateSource: raw.length > 0 ? '单独费率' : '整体费率',
      rateText: rateSummary.text,
      ratePercentage: rateSummary.totalPercentage,
    };
  }).sort((a, b) => b.totalCost - a.totalCost);

  sheet.columns = [
    { width: 18 },
    { width: 14 },
    { width: 14 },
    { width: 14 },
    { width: 14 },
    { width: 14 },
    { width: 14 },
    { width: 24 },
  ];
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  const titleRow = sheet.addRow([`${data.projectName} 造价复核`, '', '', '', '', '', '', '']);
  sheet.mergeCells(`A${titleRow.number}:H${titleRow.number}`);
  titleRow.font = { size: 16, bold: true, name: 'Microsoft YaHei' };
  titleRow.alignment = { horizontal: 'center', vertical: 'middle' };
  titleRow.height = 28;
  titleRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5ED' } };

  const addSection = (label: string, headers: string[], rows: Array<Array<string | number>>) => {
    sheet.addRow([]);
    const sectionRow = sheet.addRow([label, '', '', '', '', '', '', '']);
    sheet.mergeCells(`A${sectionRow.number}:H${sectionRow.number}`);
    sectionRow.font = { bold: true, name: 'Microsoft YaHei' };
    sectionRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE9F2E2' } };
    const headerRow = sheet.addRow(headers);
    headerRow.font = { bold: true, name: 'Microsoft YaHei' };
    headerRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE4EBDD' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });
    rows.forEach((rowValues, index) => {
      const row = sheet.addRow(rowValues);
      if (index % 2 === 0) {
        row.eachCell((cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFBFCFA' } };
        });
      }
    });
  };

  addSection(
    '工作表单方与费率',
    ['工作表', '面积(㎡)', '总成本', '成本单方', '总销售', '销售单方', '费率来源', '费率内容'],
    perSheetRows.map((item) => [
      item.sheetName,
      Number(item.totalArea.toFixed(2)),
      Number(item.totalCost.toFixed(2)),
      Number(item.costPerSqm.toFixed(2)),
      Number(item.totalRetail.toFixed(2)),
      Number(item.retailPerSqm.toFixed(2)),
      `${item.rateSource}${item.ratePercentage > 0 ? ` ${item.ratePercentage.toFixed(2)}%` : ''}`,
      item.rateText,
    ]),
  );

  addSection(
    '分项成本概览',
    ['分项', '配置数量', '分项成本', '分项销售', '说明', '', '', ''],
    bucketGroups.map((group) => [
      group.label,
      group.rows.length,
      Number(group.totalCost.toFixed(2)),
      Number(group.totalRetail.toFixed(2)),
      '以下按该分项内高成本配置排序',
      '',
      '',
      '',
    ]),
  );

  bucketGroups.forEach((group) => {
    addSection(
      `${group.label}配置来源`,
      ['配置项', '工作表', '窗型', '设计编号', '数量', '成本', '销售', '分项内占比'],
      group.rows.slice(0, 20).map((item) => [
        item.configName,
        item.sheetName,
        item.windowType,
        item.designNumber,
        item.quantity,
        Number(item.cost.toFixed(2)),
        Number(item.retail.toFixed(2)),
        `${group.totalCost > 0 ? ((item.cost / group.totalCost) * 100).toFixed(1) : '0.0'}%`,
      ]),
    );
  });

  sheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    });
  });
  sheet.pageSetup = {
    paperSize: 9,
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
  };
  sheet.pageSetup.printArea = `A1:H${sheet.rowCount}`;
};

const buildUsedProductPriceSheets = (
  workbook: any,
  data: {
    records: Array<{ items: any[] }>;
    products: any[];
    materials: any[];
  },
) => {
  const usedProductIds = Array.from(new Set(
    data.records.flatMap((record) => record.items.map((item: any) => item.productId).filter(Boolean)),
  ));
  const usedProducts = data.products.filter((product) => usedProductIds.includes(product.id));
  if (usedProducts.length === 0) return;

  const materialMap = new Map(data.materials.map((material) => [material.id, material]));
  const usageMap = new Map<string, { usedCount: number; usedArea: number; usedCost: number; usedRetail: number; sheetNames: Set<string> }>();
  data.records.forEach((record) => {
    record.items.forEach((item: any) => {
      const productId = item.productId;
      if (!productId) return;
      const areaPerUnit = Number(item.area || item.calculatedArea || 0) || (Number(item.width || 0) * Number(item.height || 0)) / 1000000;
      const quantity = Number(item.quantity || 0);
      const current = usageMap.get(productId) || { usedCount: 0, usedArea: 0, usedCost: 0, usedRetail: 0, sheetNames: new Set<string>() };
      current.usedCount += quantity;
      current.usedArea += areaPerUnit * quantity;
      current.usedCost += Number(item.totalPrice || 0);
      current.usedRetail += Number(item.totalRetailPrice || 0);
      if ((record as any).sheetName) current.sheetNames.add(String((record as any).sheetName));
      usageMap.set(productId, current);
    });
  });
  const summarySheet = workbook.addWorksheet('已用组合汇总');
  const worksheet = workbook.addWorksheet('已用组合价格表');
  worksheet.views = [{ state: 'frozen', ySplit: 2 }];
  summarySheet.views = [{ state: 'frozen', ySplit: 2 }];

  summarySheet.columns = [
    { width: 32 },
    { width: 12 },
    { width: 12 },
    { width: 12 },
    { width: 14 },
    { width: 14 },
    { width: 14 },
    { width: 14 },
    { width: 16 },
    { width: 14 },
    { width: 14 },
    { width: 14 },
    { width: 16 },
    { width: 44 },
  ];
  worksheet.columns = [
    { width: 40 },
    { width: 12 },
    { width: 12 },
    { width: 14 },
    { width: 15 },
    { width: 15 },
    { width: 60 },
  ];

  const summaryTitleRow = summarySheet.addRow(['已用组合汇总', '', '', '', '', '', '', '', '', '', '', '', '', '']);
  summarySheet.mergeCells(`A${summaryTitleRow.number}:N${summaryTitleRow.number}`);
  summaryTitleRow.font = { size: 18, bold: true };
  summaryTitleRow.height = 30;
  summaryTitleRow.alignment = { vertical: 'middle', horizontal: 'center' };
  summaryTitleRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7F8FA' } };

  const summaryInfoRow = summarySheet.addRow([`导出时间：${new Date().toLocaleDateString('zh-CN')}`, '', '', '', '', '', '', '', '', '', '', '', '', `组合数量：${usedProducts.length}`]);
  summarySheet.mergeCells(`A${summaryInfoRow.number}:D${summaryInfoRow.number}`);
  summarySheet.mergeCells(`E${summaryInfoRow.number}:N${summaryInfoRow.number}`);
  const summaryHeaderRow = summarySheet.addRow(['组合名称', '使用工表数', '使用次数', '使用面积', '使用成本', '平米成本', '长度成本', '固定成本', '成本总价', '平米销售', '长度销售', '固定销售', '销售总价', '备注']);
  summaryHeaderRow.font = { bold: true };
  summaryHeaderRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F7F4' } };
  summaryHeaderRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F7F4' } };
  });

  const titleRow = worksheet.addRow(['已用组合价格表', '', '', '', '', '', '']);
  worksheet.mergeCells(`A${titleRow.number}:G${titleRow.number}`);
  titleRow.font = { size: 18, bold: true };
  titleRow.height = 30;
  titleRow.alignment = { vertical: 'middle', horizontal: 'center' };
  titleRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7F8FA' } };
  const subTitleRow = worksheet.addRow([`导出时间：${new Date().toLocaleDateString('zh-CN')}`, '', '', '', '', '', `组合数量：${usedProducts.length}`]);
  worksheet.mergeCells(`A${subTitleRow.number}:C${subTitleRow.number}`);
  worksheet.mergeCells(`D${subTitleRow.number}:G${subTitleRow.number}`);
  const headerRow = worksheet.addRow(['材料', '使用次数', '使用面积', '使用金额', '成本价', '销售价', '备注']);
  headerRow.font = { bold: true };
  headerRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F7F4' } };
  });

  let groupIndex = 0;
  usedProducts.forEach((product) => {
    groupIndex += 1;
    const costTotals = getProductTotalsByMode(product, materialMap, 'cost');
    const retailTotals = getProductTotalsByMode(product, materialMap, 'retail');
    const remarks = product.items.map((item: any) => item.remarks).filter(Boolean).join('; ');
    const usage = usageMap.get(product.id) || { usedCount: 0, usedArea: 0, usedCost: 0, usedRetail: 0, sheetNames: new Set<string>() };
    const summaryRow = summarySheet.addRow([
      `${groupIndex}. ${product.name}`,
      usage.sheetNames.size,
      usage.usedCount,
      Number(usage.usedArea.toFixed(2)),
      Number(usage.usedCost.toFixed(2)),
      Number(costTotals.area.toFixed(2)),
      Number(costTotals.perimeter.toFixed(2)),
      Number(costTotals.fixed.toFixed(2)),
      Number(costTotals.total.toFixed(2)),
      Number(retailTotals.area.toFixed(2)),
      Number(retailTotals.perimeter.toFixed(2)),
      Number(retailTotals.fixed.toFixed(2)),
      Number(retailTotals.total.toFixed(2)),
      remarks,
    ]);
    if (groupIndex % 2 === 1) {
      summaryRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCFCFD' } };
      });
    }

    const productRow = worksheet.addRow([
      `${groupIndex}. ${product.name}`,
      usage.usedCount,
      Number(usage.usedArea.toFixed(2)),
      Number(usage.usedCost.toFixed(2)),
      '',
      '',
      remarks,
    ]);
    worksheet.mergeCells(`A${productRow.number}:A${productRow.number}`);
    worksheet.mergeCells(`E${productRow.number}:F${productRow.number}`);
    productRow.font = { bold: true, size: 12 };
    productRow.height = 26;
    productRow.alignment = { vertical: 'middle', horizontal: 'center' };
    productRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };

    product.items.forEach((item: any, itemIndex: number) => {
      const material = materialMap.get(item.materialId);
      const row = worksheet.addRow([
        item.materialName || material?.name || '未命名材料',
        usage.usedCount,
        Number(usage.usedArea.toFixed(2)),
        Number(usage.usedCost.toFixed(2)),
        Number(material?.costPrice ?? item.costPrice ?? 0),
        Number(material?.retailPrice ?? item.retailPrice ?? 0),
        item.remarks || '',
      ]);
      if (itemIndex % 2 === 0) {
        row.eachCell((cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCFCFD' } };
        });
      }
    });
    worksheet.addRow(['', '', '', '', '', '', '']);
  });

  [summarySheet, worksheet].forEach((sheet) => {
    sheet.eachRow((row) => {
      row.eachCell((cell) => {
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        };
      });
    });
  });
  summarySheet.pageSetup = { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: '1:3' };
  summarySheet.pageSetup.printArea = `A1:N${summarySheet.rowCount}`;
  worksheet.pageSetup = { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: '1:2' };
  worksheet.pageSetup.printArea = `A1:G${worksheet.rowCount}`;
};

const summarizeEnabledRates = (rates: AppliedRateSetting[]) => {
  const enabled = rates.filter((item) => item.enabled);
  return {
    enabled,
    totalPercentage: enabled.reduce((sum, item) => sum + Number(item.percentage || 0), 0),
    text: enabled.length > 0 ? enabled.map((item) => `${item.name} ${item.percentage}%`).join('、') : '未启用',
  };
};

const buildQuoteOverviewSheet = (
  workbook: any,
  data: {
    projectName: string;
    buildingName?: string;
    records: Array<{ sheetName: string; items: any[]; totalArea?: number; totalCost?: number; totalRetail?: number; rateSettings?: string }>;
    projectRateSettings?: string;
    rateTemplates?: any[];
    quoteFactor?: number;
    discountRate?: number;
  },
) => {
  const sheet = workbook.addWorksheet('报价总览');
  const quoteFactor = Number(data.quoteFactor || 1);
  const discountRate = Number(data.discountRate || 0);
  const projectRates = mergeRateSettings(data.rateTemplates || [], parseRateSettings(data.projectRateSettings));
  const projectRateSummary = summarizeEnabledRates(projectRates);
  const totalArea = data.records.reduce((sum, record) => sum + Number(record.totalArea || 0), 0);
  const totalCost = data.records.reduce((sum, record) => sum + Number(record.totalCost || 0), 0);
  const baseRetail = data.records.reduce((sum, record) => sum + Number(record.totalRetail || 0), 0);
  const perSheetRows = data.records.map((record) => {
    const raw = parseRateSettings(record.rateSettings);
    const effectiveRates = raw.length > 0 ? mergeRateSettings(data.rateTemplates || [], raw) : projectRates;
    const effectiveSummary = summarizeEnabledRates(effectiveRates);
    const adjustedRetail = Number(record.totalRetail || 0) * quoteFactor;
    const rateAmount = adjustedRetail * (effectiveSummary.totalPercentage / 100);
    const finalQuote = (adjustedRetail + rateAmount) * (1 - discountRate / 100);
    return {
      sheetName: record.sheetName,
      totalArea: Number(record.totalArea || 0),
      totalCost: Number(record.totalCost || 0),
      totalRetail: Number(record.totalRetail || 0),
      rateSource: raw.length > 0 ? '工作表单独费率' : '沿用整体费率',
      rateText: effectiveSummary.text,
      ratePercentage: effectiveSummary.totalPercentage,
      rateAmount,
      finalQuote,
    };
  });
  const totalAdjustedRetail = perSheetRows.reduce((sum, item) => sum + item.totalRetail * quoteFactor, 0);
  const totalRateAmount = perSheetRows.reduce((sum, item) => sum + item.rateAmount, 0);
  const finalQuote = perSheetRows.reduce((sum, item) => sum + item.finalQuote, 0);
  const grossProfit = finalQuote - totalCost;
  const grossMargin = finalQuote > 0 ? (grossProfit / finalQuote) * 100 : 0;
  const costBreakdown = collectProjectBreakdown(data.records);
  const topSheets = [...perSheetRows].sort((a, b) => b.totalCost - a.totalCost).slice(0, 3);

  sheet.columns = [
    { width: 18 },
    { width: 22 },
    { width: 16 },
    { width: 16 },
    { width: 16 },
    { width: 20 },
    { width: 24 },
  ];
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.addRow([`${data.projectName} 报价总览`]);
  sheet.mergeCells(1, 1, 1, 7);
  sheet.getRow(1).font = { bold: true, size: 15, name: 'Microsoft YaHei' };
  sheet.getRow(1).height = 28;
  sheet.getCell(1, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5ED' } };
  sheet.getCell(1, 1).alignment = { horizontal: 'center', vertical: 'middle' };

  const addSectionTitle = (label: string) => {
    const row = sheet.addRow([label]);
    sheet.mergeCells(row.number, 1, row.number, 7);
    row.font = { bold: true, name: 'Microsoft YaHei' };
    row.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE9F2E2' } };
      cell.alignment = { horizontal: 'left', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFB8C4D6' } },
        left: { style: 'thin', color: { argb: 'FFB8C4D6' } },
        bottom: { style: 'thin', color: { argb: 'FFB8C4D6' } },
        right: { style: 'thin', color: { argb: 'FFB8C4D6' } },
      };
    });
    return row.number;
  };

  const addKeyValueRows = (rows: Array<[string, string | number, string, string | number]>) => {
    rows.forEach(([label1, value1, label2, value2]) => {
      const row = sheet.addRow([label1, value1, '', label2, value2, '', '']);
      [1, 2, 4, 5].forEach((col) => {
        const cell = row.getCell(col);
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        };
        cell.alignment = { vertical: 'middle' };
      });
      row.getCell(1).font = { bold: true, name: 'Microsoft YaHei' };
      row.getCell(4).font = { bold: true, name: 'Microsoft YaHei' };
      row.getCell(2).font = { name: 'Microsoft YaHei' };
      row.getCell(5).font = { name: 'Microsoft YaHei' };
    });
  };

  addSectionTitle('基础信息');
  addKeyValueRows([
    ['项目名称', data.projectName, '楼栋', data.buildingName || '未填写'],
    ['工作表数量', data.records.length, '导出日期', new Date().toLocaleDateString('zh-CN')],
  ]);

  addSectionTitle('报价测算');
  addKeyValueRows([
    ['总面积', `${totalArea.toFixed(2)} ㎡`, '总成本', `¥${totalCost.toFixed(0)}`],
    ['系统销售', `¥${baseRetail.toFixed(0)}`, '报价系数', quoteFactor.toFixed(2)],
    ['附加费率金额', `¥${totalRateAmount.toFixed(0)}`, '下浮点数', `${discountRate.toFixed(1)}%`],
    ['最终报价', `¥${finalQuote.toFixed(0)}`, '毛利率', `${grossMargin.toFixed(1)}%`],
    ['预估毛利', `¥${grossProfit.toFixed(0)}`, '整体费率', `${projectRateSummary.text}${projectRateSummary.totalPercentage > 0 ? `（合计 ${projectRateSummary.totalPercentage.toFixed(2)}%）` : ''}`],
  ]);

  addSectionTitle('工作表费率明细');
  const rateHeader = sheet.addRow(['工作表', '费率来源', '费率内容', '费率合计', '费率金额', '最终报价', '面积']);
  rateHeader.font = { bold: true, name: 'Microsoft YaHei' };
  rateHeader.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE4EBDD' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFB8C4D6' } },
      left: { style: 'thin', color: { argb: 'FFB8C4D6' } },
      bottom: { style: 'thin', color: { argb: 'FFB8C4D6' } },
      right: { style: 'thin', color: { argb: 'FFB8C4D6' } },
    };
  });
  perSheetRows.forEach((item, index) => {
    const row = sheet.addRow([
      item.sheetName,
      item.rateSource,
      item.rateText,
      `${item.ratePercentage.toFixed(2)}%`,
      Number(item.rateAmount.toFixed(2)),
      Number(item.finalQuote.toFixed(2)),
      Number(item.totalArea.toFixed(2)),
    ]);
    if (index % 2 === 0) {
      row.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFBFCFA' } };
      });
    }
  });

  addSectionTitle('成本构成');
  const breakdownHeader = sheet.addRow(['分项', '成本金额', '成本占比', '说明', '', '', '']);
  breakdownHeader.font = { bold: true, name: 'Microsoft YaHei' };
  breakdownHeader.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE4EBDD' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFB8C4D6' } },
      left: { style: 'thin', color: { argb: 'FFB8C4D6' } },
      bottom: { style: 'thin', color: { argb: 'FFB8C4D6' } },
      right: { style: 'thin', color: { argb: 'FFB8C4D6' } },
    };
  });
  costBreakdown.forEach((item) => {
    sheet.addRow([item.label, Number(item.cost.toFixed(2)), `${item.share.toFixed(1)}%`, '来自已保存工作表构成明细', '', '', '']);
  });

  addSectionTitle('成本预警 Top 3');
  const topHeader = sheet.addRow(['排名', '工作表', '成本', '销售', '最终报价', '面积', '成本占项目']);
  topHeader.font = { bold: true, name: 'Microsoft YaHei' };
  topHeader.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE4EBDD' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFB8C4D6' } },
      left: { style: 'thin', color: { argb: 'FFB8C4D6' } },
      bottom: { style: 'thin', color: { argb: 'FFB8C4D6' } },
      right: { style: 'thin', color: { argb: 'FFB8C4D6' } },
    };
  });
  topSheets.forEach((item, index) => {
    sheet.addRow([
      `TOP ${index + 1}`,
      item.sheetName,
      Number(item.totalCost.toFixed(2)),
      Number(item.totalRetail.toFixed(2)),
      Number(item.finalQuote.toFixed(2)),
      Number(item.totalArea.toFixed(2)),
      totalCost > 0 ? `${((item.totalCost / totalCost) * 100).toFixed(1)}%` : '0.0%',
    ]);
  });

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    row.height = 22;
    row.eachCell((cell, colNumber) => {
      if (!cell.border) {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        };
      }
      if (rowNumber > 1) cell.alignment = { vertical: 'middle', horizontal: colNumber === 1 ? 'left' : 'center', wrapText: true };
    });
  });
  sheet.pageSetup = {
    paperSize: 9,
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
  };
  sheet.pageSetup.printArea = 'A1:G999';
};

const styleWorksheet = (sheet: ExcelJS.Worksheet, allocationLabels: string[]) => {
  const totalColumns = 8 + allocationLabels.length;
  sheet.views = [{ state: 'frozen', ySplit: 3 }];
  sheet.properties.defaultRowHeight = 18;
  sheet.pageSetup = {
    paperSize: 9,
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: {
      left: 0.3,
      right: 0.3,
      top: 0.5,
      bottom: 0.5,
      header: 0.2,
      footer: 0.2,
    },
    printTitlesRow: '1:3',
  };
  sheet.headerFooter = {
    oddHeader: '&L工程量表&R&D &T',
    oddFooter: '&L内部测算&R第 &P / &N 页',
  };

  sheet.getRow(1).height = 26;
  sheet.getRow(2).height = 22;
  sheet.getRow(3).height = 22;

  const border = {
    top: { style: 'thin' as const, color: { argb: 'FFB8C4D6' } },
    left: { style: 'thin' as const, color: { argb: 'FFB8C4D6' } },
    bottom: { style: 'thin' as const, color: { argb: 'FFB8C4D6' } },
    right: { style: 'thin' as const, color: { argb: 'FFB8C4D6' } },
  };

  sheet.getCell(1, 1).alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getCell(1, 1).font = { bold: true, size: 14, name: 'Microsoft YaHei' };
  sheet.getCell(1, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5ED' } };
  sheet.getCell(1, 1).border = border;

  for (let col = 1; col <= totalColumns; col++) {
    const cell2 = sheet.getCell(2, col);
    const cell3 = sheet.getCell(3, col);
    cell2.alignment = { horizontal: 'center', vertical: 'middle' };
    cell3.alignment = { horizontal: 'center', vertical: 'middle' };
    cell2.font = { bold: true, name: 'Microsoft YaHei' };
    cell3.font = { bold: true, name: 'Microsoft YaHei' };
    cell2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE4EBDD' } };
    cell3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7F9F4' } };
    cell2.border = border;
    cell3.border = border;
  }

  sheet.columns = [
    { width: 10 },
    { width: 10 },
    { width: 16 },
    { width: 9 },
    { width: 9 },
    ...allocationLabels.map(() => ({ width: 8 })),
    { width: 9 },
    { width: 10 },
    { width: 10.5 },
    { width: 11.5 },
    { width: 12.5 },
  ];

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber <= 3) return;
    row.font = { name: 'Microsoft YaHei', size: 10 };
    row.eachCell((cell) => {
      cell.border = border;
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });
    if (rowNumber % 2 === 0) {
      row.eachCell((cell) => {
        if (!cell.fill || (typeof cell.fill === 'object' && !('fgColor' in cell.fill))) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFBFCFA' } };
        }
      });
    }
  });
  sheet.pageSetup.printArea = `A1:${sheet.getColumn(totalColumns).letter}999`;
};

const buildRecordSheet = (
  workbook: any,
  projectName: string,
  record: { sheetName: string; items: any[]; allocationLabels?: string[] },
) => {
  const allocationLabels = collectAllocationLabels(record);
  const safeSheetName = getUniqueSheetName(workbook, record.sheetName);
  const sheet = workbook.addWorksheet(safeSheetName);
  const totalColumns = 8 + allocationLabels.length;

  sheet.mergeCells(1, 1, 1, Math.max(1, totalColumns - 1));
  sheet.getCell(1, 1).value = `${record.sheetName}工程量表`;
  sheet.getCell(1, totalColumns).value = makeSheetLink('汇总', '返回汇总');
  sheet.getCell(1, totalColumns).font = { bold: false, underline: true, color: { argb: 'FF355E3B' }, name: 'Microsoft YaHei' };
  sheet.getCell(1, totalColumns).alignment = { horizontal: 'right', vertical: 'middle' };
  sheet.getCell(1, totalColumns).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5ED' } };

  sheet.mergeCells(2, 1, 3, 1);
  sheet.getCell(2, 1).value = '类型';
  sheet.mergeCells(2, 2, 3, 2);
  sheet.getCell(2, 2).value = '分类';
  sheet.mergeCells(2, 3, 3, 3);
  sheet.getCell(2, 3).value = '设计编号';
  sheet.mergeCells(2, 4, 2, 5);
  sheet.getCell(2, 4).value = '洞口尺寸 (mm)';

  const allocationStart = 6;
  const allocationEnd = allocationStart + allocationLabels.length - 1;
  if (allocationLabels.length > 0) {
    sheet.mergeCells(2, allocationStart, 2, allocationEnd);
    sheet.getCell(2, allocationStart).value = '楼层及数量';
    allocationLabels.forEach((label, index) => {
      sheet.getCell(3, allocationStart + index).value = label;
    });
  }

  const quantityCol = allocationEnd + 1;
  const areaCol = quantityCol + 1;
  const costUnitCol = areaCol + 1;
  const costTotalCol = costUnitCol + 1;

  sheet.mergeCells(2, quantityCol, 3, quantityCol);
  sheet.getCell(2, quantityCol).value = '数量（樘）';
  sheet.mergeCells(2, areaCol, 3, areaCol);
  sheet.getCell(2, areaCol).value = '面积（㎡）';
  sheet.mergeCells(2, costUnitCol, 3, costUnitCol);
  sheet.getCell(2, costUnitCol).value = '成本单价';
  sheet.mergeCells(2, costTotalCol, 3, costTotalCol);
  sheet.getCell(2, costTotalCol).value = '成本合价';

  sheet.getCell(3, 4).value = '宽度';
  sheet.getCell(3, 5).value = '高度';

  styleWorksheet(sheet, allocationLabels);

  const sortedItems = [...record.items].sort((a, b) => {
    const typeCompare = String(a.windowType || '').localeCompare(String(b.windowType || ''), 'zh-CN');
    if (typeCompare !== 0) return typeCompare;
    return String(a.designNumber || '').localeCompare(String(b.designNumber || ''), 'zh-CN');
  });

  let currentRow = 4;
  let totalQuantity = 0;
  let totalArea = 0;
  let totalCost = 0;
  let mergeStartRow = currentRow;
  let activeType = sortedItems[0]?.windowType || '';
  let typeQuantity = 0;
  let typeArea = 0;
  let typeCost = 0;

  const writeTypeSubtotalRow = (rowIndex: number, typeLabel: string) => {
    const subtotalRow = sheet.getRow(rowIndex);
    subtotalRow.getCell(1).value = `${typeLabel || '未分类'}小计`;
    subtotalRow.getCell(quantityCol).value = typeQuantity;
    subtotalRow.getCell(areaCol).value = Number(typeArea.toFixed(3));
    subtotalRow.getCell(costUnitCol).value = Number((typeCost / (typeArea || 1)).toFixed(2));
    subtotalRow.getCell(costTotalCol).value = Number(typeCost.toFixed(2));
    subtotalRow.font = { bold: true, name: 'Microsoft YaHei' };
    subtotalRow.eachCell((cell) => {
      cell.border = {
        top: { style: 'thick', color: { argb: 'FF6D886D' } },
        left: { style: 'thin', color: { argb: 'FF8FA58F' } },
        bottom: { style: 'medium', color: { argb: 'FF7E997E' } },
        right: { style: 'thin', color: { argb: 'FF8FA58F' } },
      };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEAF1E1' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });
    subtotalRow.height = 23;
    subtotalRow.getCell(areaCol).numFmt = '0.000';
    subtotalRow.getCell(costUnitCol).numFmt = '0.00';
    subtotalRow.getCell(costTotalCol).numFmt = '0.00';
  };

  sortedItems.forEach((item, index) => {
    const itemType = item.windowType || '未分类';
    const previousType = sortedItems[index - 1]?.windowType || '未分类';
    if (index > 0 && itemType !== previousType) {
      if (mergeStartRow < currentRow - 1) {
        sheet.mergeCells(mergeStartRow, 1, currentRow - 1, 1);
      }
      const mergedCell = sheet.getCell(mergeStartRow, 1);
      mergedCell.alignment = { horizontal: 'center', vertical: 'middle' };
      mergedCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7FAF4' } };
      mergedCell.font = { bold: true, name: 'Microsoft YaHei' };

      if (mergeStartRow === currentRow - 1) {
        const singleTypeCell = sheet.getCell(mergeStartRow, 1);
        singleTypeCell.alignment = { horizontal: 'center', vertical: 'middle' };
        singleTypeCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7FAF4' } };
        singleTypeCell.font = { bold: true, name: 'Microsoft YaHei' };
      }

      writeTypeSubtotalRow(currentRow, previousType);
      currentRow += 1;
      mergeStartRow = currentRow;
      activeType = itemType;
      typeQuantity = 0;
      typeArea = 0;
      typeCost = 0;
    }

    const row = sheet.getRow(currentRow);
    const allocations = allocationLabels.map((label) => {
      const matched = (item.allocations || []).find((allocation: any) => allocation.label === label);
      return Number(matched?.quantity || 0);
    });
    const quantity = Number(item.quantity || allocations.reduce((sum, value) => sum + value, 0));
    const baseArea = Number(item.area || ((item.width || 0) * (item.height || 0)) / 1000000);
    const area = Number((baseArea * quantity).toFixed(3));
    const costUnit = Number(item.unitPrice || 0);
    const costTotal = Number(item.totalPrice || costUnit * area);

    row.getCell(1).value = item.windowType || '';
    row.getCell(2).value = getCategoryLabel(item);
    row.getCell(3).value = item.designNumber || '';
    row.getCell(4).value = Number(item.width || 0);
    row.getCell(5).value = Number(item.height || 0);
    allocations.forEach((value, allocationIndex) => {
      row.getCell(allocationStart + allocationIndex).value = value || null;
    });
    row.getCell(quantityCol).value = quantity;
    row.getCell(areaCol).value = Number(area.toFixed(3));
    row.getCell(costUnitCol).value = Number(costUnit.toFixed(2));
    row.getCell(costTotalCol).value = Number(costTotal.toFixed(2));
    row.getCell(areaCol).numFmt = '0.000';
    row.getCell(costUnitCol).numFmt = '0.00';
    row.getCell(costTotalCol).numFmt = '0.00';

    totalQuantity += quantity;
    totalArea += area;
    totalCost += costTotal;
    typeQuantity += quantity;
    typeArea += area;
    typeCost += costTotal;

    if (index === 0 || itemType !== previousType) {
      for (let col = 1; col <= costTotalCol; col++) {
        row.getCell(col).border = {
          ...row.getCell(col).border,
          top: { style: 'thin', color: { argb: 'FF90A490' } },
        };
      }
      row.height = 22;
    }

    currentRow += 1;
  });

  if (sortedItems.length > 0) {
    if (mergeStartRow < currentRow - 1) {
      sheet.mergeCells(mergeStartRow, 1, currentRow - 1, 1);
    }
    const mergedCell = sheet.getCell(mergeStartRow, 1);
    mergedCell.alignment = { horizontal: 'center', vertical: 'middle' };
    mergedCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7FAF4' } };
    mergedCell.font = { bold: true, name: 'Microsoft YaHei' };
    if (mergeStartRow === currentRow - 1) {
      const singleTypeCell = sheet.getCell(mergeStartRow, 1);
      singleTypeCell.alignment = { horizontal: 'center', vertical: 'middle' };
      singleTypeCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7FAF4' } };
      singleTypeCell.font = { bold: true, name: 'Microsoft YaHei' };
    }
    writeTypeSubtotalRow(currentRow, activeType);
    currentRow += 1;
  }

  const totalRow = sheet.getRow(currentRow + 1);
  totalRow.getCell(1).value = '合计';
  totalRow.getCell(quantityCol).value = totalQuantity;
  totalRow.getCell(areaCol).value = Number(totalArea.toFixed(3));
  totalRow.getCell(costUnitCol).value = Number((totalCost / (totalArea || 1)).toFixed(2));
  totalRow.getCell(costTotalCol).value = Number(totalCost.toFixed(2));
  totalRow.font = { bold: true };
  totalRow.eachCell((cell) => {
    cell.border = {
      top: { style: 'thick', color: { argb: 'FF5F795F' } },
      left: { style: 'thin', color: { argb: 'FF8CA08C' } },
      bottom: { style: 'thick', color: { argb: 'FF5F795F' } },
      right: { style: 'thin', color: { argb: 'FF8CA08C' } },
    };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD5E8CC' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });
  totalRow.height = 24;
  totalRow.getCell(areaCol).numFmt = '0.000';
  totalRow.getCell(costUnitCol).numFmt = '0.00';
  totalRow.getCell(costTotalCol).numFmt = '0.00';

  return {
    sheetName: safeSheetName,
    displayName: record.sheetName,
    typeCount: sortedItems.length,
    totalQuantity,
    totalArea,
    totalCost,
  };
};

const buildDesignNumberSheets = (
  workbook: any,
  projectName: string,
  records: Array<{ sheetName: string; items: any[]; allocationLabels?: string[] }>,
) => {
  const grouped = new Map<string, Array<any>>();
  const sheetRefs: Array<{ designNumber: string; sheetName: string; itemCount: number; totalQuantity: number; totalArea: number; totalCost: number }> = [];

  records.forEach((record) => {
    const labels = collectAllocationLabels(record);
    record.items.forEach((item) => {
      const key = String(item.designNumber || '').trim();
      if (!key) return;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push({
        ...item,
        sourceSheetName: record.sheetName,
        allocationLabels: labels,
      });
    });
  });

  grouped.forEach((items, designNumber) => {
    const sheetName = getUniqueSheetName(workbook, designNumber);
    const sheet = workbook.addWorksheet(sheetName);
    const labels = Array.from(new Set(items.flatMap((item) => item.allocationLabels || [])));
    const totalColumns = 8 + labels.length;

    sheet.mergeCells(1, 1, 1, Math.max(1, totalColumns - 1));
    sheet.getCell(1, 1).value = `${projectName} · ${designNumber}设计编号明细表`;
    sheet.getCell(1, totalColumns).value = makeSheetLink('汇总', '返回汇总');
    sheet.getCell(1, totalColumns).font = { bold: false, underline: true, color: { argb: 'FF355E3B' }, name: 'Microsoft YaHei' };
    sheet.getCell(1, totalColumns).alignment = { horizontal: 'right', vertical: 'middle' };
    sheet.getCell(1, totalColumns).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F0E2' } };

    sheet.mergeCells(2, 1, 3, 1);
    sheet.getCell(2, 1).value = '来源';
    sheet.mergeCells(2, 2, 3, 2);
    sheet.getCell(2, 2).value = '类型';
    sheet.mergeCells(2, 3, 3, 3);
    sheet.getCell(2, 3).value = '分类';
    sheet.mergeCells(2, 4, 2, 5);
    sheet.getCell(2, 4).value = '洞口尺寸 (mm)';

    const allocationStart = 6;
    const allocationEnd = allocationStart + labels.length - 1;
    if (labels.length > 0) {
      sheet.mergeCells(2, allocationStart, 2, allocationEnd);
      sheet.getCell(2, allocationStart).value = '楼层及数量';
      labels.forEach((label, index) => {
        sheet.getCell(3, allocationStart + index).value = label;
      });
    }

    const quantityCol = allocationEnd + 1;
    const areaCol = quantityCol + 1;
    const costCol = areaCol + 1;

    sheet.mergeCells(2, quantityCol, 3, quantityCol);
    sheet.getCell(2, quantityCol).value = '数量（樘）';
    sheet.mergeCells(2, areaCol, 3, areaCol);
    sheet.getCell(2, areaCol).value = '面积（㎡）';
    sheet.mergeCells(2, costCol, 3, costCol);
    sheet.getCell(2, costCol).value = '成本合价';
    sheet.getCell(3, 4).value = '宽度';
    sheet.getCell(3, 5).value = '高度';

    styleWorksheet(sheet, labels);
    sheet.getCell(1, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F0E2' } };
    sheet.getRow(2).eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD7E7D3' } };
      cell.font = { bold: true, name: 'Microsoft YaHei' };
    });
    sheet.getRow(3).eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF4F8F1' } };
      cell.font = { bold: true, name: 'Microsoft YaHei' };
    });

    const sortedItems = [...items].sort((a, b) => {
      const sourceCompare = String(a.sourceSheetName || '').localeCompare(String(b.sourceSheetName || ''), 'zh-CN');
      if (sourceCompare !== 0) return sourceCompare;
      const typeCompare = String(a.windowType || '').localeCompare(String(b.windowType || ''), 'zh-CN');
      if (typeCompare !== 0) return typeCompare;
      return Number(a.width || 0) - Number(b.width || 0);
    });

    let rowIndex = 4;
    let totalQuantity = 0;
    let totalArea = 0;
    let totalCost = 0;
    let sourceQuantity = 0;
    let sourceArea = 0;
    let sourceCost = 0;
    let sourceStartRow = rowIndex;
    let activeSource = sortedItems[0]?.sourceSheetName || '';

    const writeSourceSubtotal = (subtotalRowIndex: number, sourceLabel: string) => {
      const subtotalRow = sheet.getRow(subtotalRowIndex);
      subtotalRow.getCell(1).value = `${sourceLabel || '未命名工作表'}小计`;
      subtotalRow.getCell(quantityCol).value = sourceQuantity;
      subtotalRow.getCell(areaCol).value = Number(sourceArea.toFixed(3));
      subtotalRow.getCell(costCol).value = Number(sourceCost.toFixed(2));
      subtotalRow.font = { bold: true, name: 'Microsoft YaHei' };
      subtotalRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF5E8' } };
        cell.border = {
          top: { style: 'thick', color: { argb: 'FF7C947C' } },
          left: { style: 'thin', color: { argb: 'FF9EB19E' } },
          bottom: { style: 'medium', color: { argb: 'FF8CA08C' } },
          right: { style: 'thin', color: { argb: 'FF9EB19E' } },
        };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      });
      subtotalRow.height = 22;
      subtotalRow.getCell(areaCol).numFmt = '0.000';
      subtotalRow.getCell(costCol).numFmt = '0.00';
    };

    sortedItems.forEach((item, index) => {
      const sourceName = item.sourceSheetName || '';
      const previousSource = sortedItems[index - 1]?.sourceSheetName || '';
      if (index > 0 && sourceName !== previousSource) {
        if (sourceStartRow < rowIndex - 1) {
          sheet.mergeCells(sourceStartRow, 1, rowIndex - 1, 1);
        }
        const sourceCell = sheet.getCell(sourceStartRow, 1);
        sourceCell.alignment = { horizontal: 'center', vertical: 'middle' };
        sourceCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF6FAF1' } };
        sourceCell.font = { bold: true, name: 'Microsoft YaHei' };
        writeSourceSubtotal(rowIndex, previousSource);
        rowIndex += 1;
        sourceStartRow = rowIndex;
        activeSource = sourceName;
        sourceQuantity = 0;
        sourceArea = 0;
        sourceCost = 0;
      }

      const row = sheet.getRow(rowIndex);
      const quantity = Number(item.quantity || 0);
      const baseArea = Number(item.area || ((item.width || 0) * (item.height || 0)) / 1000000);
      const totalItemArea = Number((baseArea * quantity).toFixed(3));
      const allocations = labels.map((label) => {
        const allocation = (item.allocations || []).find((entry: any) => entry.label === label);
        return Number(allocation?.quantity || 0);
      });

      row.getCell(1).value = item.sourceSheetName;
      row.getCell(2).value = item.windowType || '';
      row.getCell(3).value = getCategoryLabel(item);
      row.getCell(4).value = Number(item.width || 0);
      row.getCell(5).value = Number(item.height || 0);
      allocations.forEach((value, index) => {
        row.getCell(allocationStart + index).value = value || null;
      });
      row.getCell(quantityCol).value = quantity;
      row.getCell(areaCol).value = totalItemArea;
      row.getCell(costCol).value = Number(item.totalPrice || 0);
      row.getCell(areaCol).numFmt = '0.000';
      row.getCell(costCol).numFmt = '0.00';
      if (index === 0 || sourceName !== previousSource) {
        row.height = 22;
      }

      totalQuantity += quantity;
      totalArea += totalItemArea;
      totalCost += Number(item.totalPrice || 0);
      sourceQuantity += quantity;
      sourceArea += totalItemArea;
      sourceCost += Number(item.totalPrice || 0);
      rowIndex += 1;
    });

    if (sortedItems.length > 0) {
      if (sourceStartRow < rowIndex - 1) {
        sheet.mergeCells(sourceStartRow, 1, rowIndex - 1, 1);
      }
      const sourceCell = sheet.getCell(sourceStartRow, 1);
      sourceCell.alignment = { horizontal: 'center', vertical: 'middle' };
      sourceCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF6FAF1' } };
      sourceCell.font = { bold: true, name: 'Microsoft YaHei' };
      writeSourceSubtotal(rowIndex, activeSource);
      rowIndex += 1;
    }

    const totalRow = sheet.getRow(rowIndex + 1);
    totalRow.getCell(1).value = '合计';
    totalRow.getCell(quantityCol).value = totalQuantity;
    totalRow.getCell(areaCol).value = Number(totalArea.toFixed(3));
    totalRow.getCell(costCol).value = Number(totalCost.toFixed(2));
    totalRow.font = { bold: true, name: 'Microsoft YaHei' };
    totalRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD5E8CC' } };
      cell.border = {
        top: { style: 'thick', color: { argb: 'FF5F795F' } },
        left: { style: 'thin', color: { argb: 'FF8CA08C' } },
        bottom: { style: 'thick', color: { argb: 'FF5F795F' } },
        right: { style: 'thin', color: { argb: 'FF8CA08C' } },
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });
    totalRow.height = 24;
    totalRow.getCell(areaCol).numFmt = '0.000';
    totalRow.getCell(costCol).numFmt = '0.00';

    sheetRefs.push({
      designNumber,
      sheetName,
      itemCount: sortedItems.length,
      totalQuantity,
      totalArea,
      totalCost,
    });
  });

  return sheetRefs;
};

export const exportProjectRecordsToExcel = async (data: {
  projectName: string;
  buildingName?: string;
  records: Array<{ id?: string; sheetName: string; items: any[]; allocationLabels?: string[]; totalArea?: number; totalCost?: number; totalRetail?: number; rateSettings?: string }>;
  materials: any[];
  products: any[];
  projectRateSettings?: string;
  rateTemplates?: any[];
  quoteFactor?: number;
  discountRate?: number;
  options?: {
    includeReviewSheet?: boolean;
    includeUsedProductSheets?: boolean;
    includeEngineeringSheets?: boolean;
  };
}) => {
  const ExcelJS = await loadExcelJS();
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Codex';
  workbook.company = 'dxf-window-system';
  workbook.subject = `${data.projectName} 工程量导出`;
  workbook.title = `${data.projectName} 工程量表`;
  const options = {
    includeReviewSheet: data.options?.includeReviewSheet ?? true,
    includeUsedProductSheets: data.options?.includeUsedProductSheets ?? true,
    includeEngineeringSheets: data.options?.includeEngineeringSheets ?? true,
  };
  buildQuoteOverviewSheet(workbook, data);
  if (options.includeReviewSheet) {
    buildReviewSheet(workbook, data);
  }
  if (options.includeUsedProductSheets) {
    buildUsedProductPriceSheets(workbook, data);
  }
  if (!options.includeEngineeringSheets) {
    await saveWorkbook(workbook, `${data.projectName}_工程量表.xlsx`);
    return;
  }
  const summarySheet = workbook.addWorksheet('汇总');

  summarySheet.addRow([`${data.projectName} 汇总`]);
  summarySheet.mergeCells(1, 1, 1, 7);
  summarySheet.addRow(['楼栋/工作表汇总', '', '', '', '', '', '']);
  summarySheet.addRow(['序号', '楼号', '樘数', '面积', '成本单价', '成本合价', '备注']);
  summarySheet.views = [{ state: 'frozen', ySplit: 3 }];
  summarySheet.pageSetup = {
    paperSize: 9,
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: {
      left: 0.3,
      right: 0.3,
      top: 0.5,
      bottom: 0.5,
      header: 0.2,
      footer: 0.2,
    },
    printTitlesRow: '1:3',
  };
  summarySheet.headerFooter = {
    oddHeader: '&L汇总表&R&D &T',
    oddFooter: '&L报价中心导出&R第 &P / &N 页',
  };
  summarySheet.getRow(1).height = 28;
  summarySheet.getRow(2).height = 22;
  summarySheet.getRow(3).height = 22;
  summarySheet.getRow(1).font = { bold: true, size: 14 };
  summarySheet.getRow(2).font = { bold: true, name: 'Microsoft YaHei' };
  summarySheet.getRow(3).font = { bold: true };
  summarySheet.getRow(1).alignment = { horizontal: 'center', vertical: 'middle' };
  summarySheet.getCell(1, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5ED' } };
  summarySheet.getRow(2).eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDF3E7' } };
    cell.alignment = { horizontal: 'left', vertical: 'middle' };
    cell.font = { bold: true, name: 'Microsoft YaHei', size: 10 };
  });
  summarySheet.getRow(3).eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE4EBDD' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });
  summarySheet.getCell(1, 7).value = new Date().toLocaleDateString('zh-CN');
  summarySheet.getCell(1, 7).alignment = { horizontal: 'right', vertical: 'middle' };

  let grandQuantity = 0;
  let grandArea = 0;
  let grandCost = 0;

  data.records.forEach((record, index) => {
    const result = buildRecordSheet(workbook, data.projectName, record);
    const row = summarySheet.addRow([
      index + 1,
      makeSheetLink(result.sheetName, result.displayName),
      result.totalQuantity,
      Number(result.totalArea.toFixed(3)),
      Number((result.totalCost / (result.totalArea || 1)).toFixed(2)),
      Number(result.totalCost.toFixed(2)),
      '',
    ]);
    if (index % 2 === 0) {
      row.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFBFCFA' } };
      });
    }
    const linkCell = row.getCell(2);
    linkCell.font = { underline: true, color: { argb: 'FF355E3B' }, name: 'Microsoft YaHei' };
    grandQuantity += result.totalQuantity;
    grandArea += result.totalArea;
    grandCost += result.totalCost;
  });

  const projectTotalRow = summarySheet.addRow(['合计', '', grandQuantity, Number(grandArea.toFixed(3)), Number((grandCost / (grandArea || 1)).toFixed(2)), Number(grandCost.toFixed(2)), '']);
  summarySheet.columns = [
    { width: 8 },
    { width: 28 },
    { width: 12 },
    { width: 12 },
    { width: 12 },
    { width: 12 },
    { width: 14 },
  ];
  summarySheet.eachRow((row, rowNumber) => {
    row.eachCell((cell) => {
      const colNumber = Number(cell.col);
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFB8C4D6' } },
        left: { style: 'thin', color: { argb: 'FFB8C4D6' } },
        bottom: { style: 'thin', color: { argb: 'FFB8C4D6' } },
        right: { style: 'thin', color: { argb: 'FFB8C4D6' } },
      };
      if (rowNumber > 1) cell.alignment = { horizontal: 'center', vertical: 'middle' };
      if (rowNumber >= 4 && (colNumber === 4 || colNumber === 5 || colNumber === 6)) {
        cell.numFmt = colNumber === 4 ? '0.000' : '0.00';
      }
    });
    const isProjectTotalRow = row.number === projectTotalRow.number;
    if (isProjectTotalRow) {
      row.font = { bold: true, name: 'Microsoft YaHei' };
      row.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD5E8CC' } };
        cell.border = {
          top: { style: 'thick', color: { argb: 'FF5F795F' } },
          left: { style: 'thin', color: { argb: 'FF8CA08C' } },
          bottom: { style: 'thick', color: { argb: 'FF5F795F' } },
          right: { style: 'thin', color: { argb: 'FF8CA08C' } },
        };
      });
      row.height = 24;
    }
  });

  const designSheets = buildDesignNumberSheets(workbook, data.projectName, data.records);
  const typeSummaries = collectTypeSummaries(data.records);

  if (typeSummaries.length > 0) {
    summarySheet.addRow([]);
    const typeTitleRow = summarySheet.addRow(['类型分类汇总', '', '', '', '', '', '']);
    typeTitleRow.font = { bold: true, name: 'Microsoft YaHei' };
    typeTitleRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDF3E7' } };
      cell.alignment = { horizontal: 'left', vertical: 'middle' };
    });
    const typeHeaderRow = summarySheet.addRow(['序号', '窗型', '樘数', '面积', '成本单价', '成本合价', '备注']);
    typeHeaderRow.font = { bold: true, name: 'Microsoft YaHei' };
    typeHeaderRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE4EBDD' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'medium', color: { argb: 'FF94A994' } },
        left: { style: 'thin', color: { argb: 'FFB8C4D6' } },
        bottom: { style: 'medium', color: { argb: 'FF94A994' } },
        right: { style: 'thin', color: { argb: 'FFB8C4D6' } },
      };
    });
    typeHeaderRow.height = 22;

    typeSummaries.forEach((item, index) => {
      const row = summarySheet.addRow([
        index + 1,
        item.label,
        item.quantity,
        Number(item.area.toFixed(3)),
        Number((item.cost / (item.area || 1)).toFixed(2)),
        Number(item.cost.toFixed(2)),
        '',
      ]);
      if (row.number % 2 === 0) {
        row.eachCell((cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FBF6' } };
        });
      }
    });

    const typeTotalQuantity = typeSummaries.reduce((sum, item) => sum + item.quantity, 0);
    const typeTotalArea = typeSummaries.reduce((sum, item) => sum + item.area, 0);
    const typeTotalCost = typeSummaries.reduce((sum, item) => sum + item.cost, 0);
    const typeTotalRow = summarySheet.addRow([
      '',
      '合计',
      typeTotalQuantity,
      Number(typeTotalArea.toFixed(3)),
      Number((typeTotalCost / (typeTotalArea || 1)).toFixed(2)),
      Number(typeTotalCost.toFixed(2)),
      Number((typeTotalArea / (typeTotalQuantity || 1)).toFixed(3)),
    ]);
    typeTotalRow.font = { bold: true, name: 'Microsoft YaHei' };
    typeTotalRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD5E8CC' } };
      cell.border = {
        top: { style: 'thick', color: { argb: 'FF5F795F' } },
        left: { style: 'thin', color: { argb: 'FF8CA08C' } },
        bottom: { style: 'thick', color: { argb: 'FF5F795F' } },
        right: { style: 'thin', color: { argb: 'FF8CA08C' } },
      };
    });
    typeTotalRow.height = 24;
  }

  if (designSheets.length > 0) {
    const designIndexSheet = workbook.addWorksheet('设计编号目录');
    designIndexSheet.views = [{ state: 'frozen', ySplit: 2 }];
    designIndexSheet.addRow([`${data.projectName} 设计编号目录`]);
    designIndexSheet.mergeCells(1, 1, 1, 6);
    designIndexSheet.addRow(['序号', '设计编号', '跳转', '数量（樘）', '面积（㎡）', '成本合价']);
    designIndexSheet.getRow(1).font = { bold: true, size: 14, name: 'Microsoft YaHei' };
    designIndexSheet.getRow(2).font = { bold: true, name: 'Microsoft YaHei' };
    designIndexSheet.getCell(1, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5EEE5' } };
    designIndexSheet.getRow(2).eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDDE9DD' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });
    designIndexSheet.columns = [
      { width: 8 },
      { width: 18 },
      { width: 14 },
      { width: 12 },
      { width: 12 },
      { width: 14 },
    ];
    designSheets.forEach((item, index) => {
      const row = designIndexSheet.addRow([
        index + 1,
        item.designNumber,
        makeSheetLink(item.sheetName, '查看明细'),
        item.totalQuantity,
        Number(item.totalArea.toFixed(3)),
        Number(item.totalCost.toFixed(2)),
      ]);
      row.getCell(3).font = { underline: true, color: { argb: 'FF355E3B' }, name: 'Microsoft YaHei' };
    });
    designIndexSheet.eachRow((row, rowNumber) => {
      row.eachCell((cell, colNumber) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFB8C4D6' } },
          left: { style: 'thin', color: { argb: 'FFB8C4D6' } },
          bottom: { style: 'thin', color: { argb: 'FFB8C4D6' } },
          right: { style: 'thin', color: { argb: 'FFB8C4D6' } },
        };
        if (rowNumber > 1) cell.alignment = { horizontal: 'center', vertical: 'middle' };
        if (rowNumber >= 3 && (colNumber === 4 || colNumber === 5 || colNumber === 6)) {
          cell.numFmt = colNumber === 5 ? '0.000' : '0.00';
        }
      });
    });
  }
  summarySheet.pageSetup.printArea = 'A1:G999';

  await saveWorkbook(workbook, `${data.projectName}_工程量表.xlsx`);
};

export const exportQuotationToExcel = async (data: ExportData) => {
  await exportProjectRecordsToExcel({
    projectName: data.projectName,
    buildingName: data.buildingName,
    records: [{ sheetName: data.buildingName || '报价单', items: data.items }],
    materials: data.materials,
    products: data.products,
  });
};

export const downloadCalculationTemplate = async (products: any[], materials: any[]) => {
  const ExcelJS = await loadExcelJS();
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Codex';
  workbook.company = 'dxf-window-system';
  workbook.subject = '计算中心导入模板';
  workbook.title = '计算中心导入模板';

  const instructionSheet = workbook.addWorksheet('填写说明');
  const templateSheet = workbook.addWorksheet('录入模板');
  const optionSheet = workbook.addWorksheet('组合参考');
  const accessorySheet = workbook.addWorksheet('配件参考');

  const materialMap = new Map(materials.map((material) => [material.id, material]));
  const categoryMap = new Map(materials.map((material) => [material.categoryId, material.categoryName || '']));
  const shapeOptions = ['矩形', '三角形', '梯形', '圆形', '异形'];
  const accessoryGroupCount = 6;
  const allocationGroupCount = 6;
  const accessoryCategories = Array.from(new Set(materials.map((material) => material.categoryName || categoryMap.get(material.categoryId) || '').filter(Boolean)));
  const productSummaries = products.map((product) => {
    const summary = {
      name: product.name,
      areaCost: 0,
      perimeterCost: 0,
      fixedCost: 0,
      areaRetail: 0,
      perimeterRetail: 0,
      fixedRetail: 0,
    };

    (product.items || []).forEach((item: any) => {
      const material = materialMap.get(item.materialId);
      if (!material) return;
      const cost = Number(item.quantity || 0) * Number(material.costPrice || 0);
      const retail = Number(item.quantity || 0) * Number(material.retailPrice || 0);
      if (item.calcMode === 'perimeter') {
        summary.perimeterCost += cost;
        summary.perimeterRetail += retail;
      } else if (item.calcMode === 'fixed') {
        summary.fixedCost += cost;
        summary.fixedRetail += retail;
      } else {
        summary.areaCost += cost;
        summary.areaRetail += retail;
      }
    });

    return summary;
  });

  optionSheet.columns = [
    { width: 24 },
    { width: 12 },
    { width: 12 },
    { width: 12 },
    { width: 12 },
    { width: 12 },
    { width: 12 },
    { width: 12 },
  ];
  optionSheet.addRow(['产品组合', '面积成本', '周长成本', '固定成本', '面积销售', '周长销售', '固定销售', '形状选项']);
  optionSheet.getRow(1).font = { bold: true, name: 'Microsoft YaHei' };
  optionSheet.getRow(1).eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE4EBDD' } };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFB8C4D6' } },
      left: { style: 'thin', color: { argb: 'FFB8C4D6' } },
      bottom: { style: 'thin', color: { argb: 'FFB8C4D6' } },
      right: { style: 'thin', color: { argb: 'FFB8C4D6' } },
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });
  productSummaries.forEach((summary, index) => {
    optionSheet.addRow([
      summary.name,
      Number(summary.areaCost.toFixed(4)),
      Number(summary.perimeterCost.toFixed(4)),
      Number(summary.fixedCost.toFixed(4)),
      Number(summary.areaRetail.toFixed(4)),
      Number(summary.perimeterRetail.toFixed(4)),
      Number(summary.fixedRetail.toFixed(4)),
      shapeOptions[index] || '',
    ]);
  });
  shapeOptions.forEach((shape, index) => {
    optionSheet.getCell(index + 2, 8).value = shape;
  });
  optionSheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE0E5DD' } },
        left: { style: 'thin', color: { argb: 'FFE0E5DD' } },
        bottom: { style: 'thin', color: { argb: 'FFE0E5DD' } },
        right: { style: 'thin', color: { argb: 'FFE0E5DD' } },
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });
  });

  accessorySheet.columns = [
    { width: 16 },
    { width: 26 },
    { width: 12 },
    { width: 12 },
    { width: 12 },
    { width: 16 },
  ];
  accessorySheet.addRow(['配件分类', '材料名称', '单位类型', '单位标签', '成本价', '销售价']);
  accessorySheet.getRow(1).font = { bold: true, name: 'Microsoft YaHei' };
  accessorySheet.getRow(1).eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE3ECFA' } };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFB8C4D6' } },
      left: { style: 'thin', color: { argb: 'FFB8C4D6' } },
      bottom: { style: 'thin', color: { argb: 'FFB8C4D6' } },
      right: { style: 'thin', color: { argb: 'FFB8C4D6' } },
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });
  materials.forEach((material) => {
    accessorySheet.addRow([
      material.categoryName || categoryMap.get(material.categoryId) || '',
      material.name,
      material.unitType,
      material.unitLabel,
      Number(material.costPrice || 0),
      Number(material.retailPrice || 0),
    ]);
  });
  accessorySheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE0E5DD' } },
        left: { style: 'thin', color: { argb: 'FFE0E5DD' } },
        bottom: { style: 'thin', color: { argb: 'FFE0E5DD' } },
        right: { style: 'thin', color: { argb: 'FFE0E5DD' } },
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });
  });

  instructionSheet.columns = [{ width: 16 }, { width: 82 }];
  instructionSheet.addRow(['说明项', '内容']);
  [
    ['导入流程', '先在计算中心选择报价项目并填写工作表名，再点击“模板导入”。导入后会直接回填当前草稿并自动计算。'],
    ['产品组合', '“产品组合”列提供下拉选项。选择后会自动显示组合参考成本价和销售价。'],
    ['配件录入', '模板支持配件分类 / 材料 / 数量。导入后会自动重建为计算中心里的配件，并参与成本价和销售价计算。'],
    ['数量方式', '优先读取“分配标签/数量”列；如果分配列为空，则使用“数量”列自动生成默认分配。'],
    ['分配标签', '模板默认提供 6 组分配标签列；如果不够，可以继续在右侧新增列，并直接用列标题作为分配标签导入。'],
    ['支持格式', '建议使用 xlsx / xls / csv / ods。macOS Numbers 可导入，但下拉和公式兼容性弱于 Excel。'],
    ['价格说明', '模板中的成本单价、销售单价会尝试自动计算；若 Numbers 未实时刷新，导入系统后仍会自动重新计算。'],
    ['组合参考', '“组合参考”页列出了所有产品组合及其面积/周长/固定单价汇总，Numbers 下可直接参考或复制组合名称。'],
    ['配件参考', '“配件参考”页列出了分类、材料、单位、成本价、销售价。模板内配件材料可直接按此表填写或下拉选择。'],
  ].forEach((row) => instructionSheet.addRow(row));
  instructionSheet.eachRow((row, rowNumber) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFB8C4D6' } },
        left: { style: 'thin', color: { argb: 'FFB8C4D6' } },
        bottom: { style: 'thin', color: { argb: 'FFB8C4D6' } },
        right: { style: 'thin', color: { argb: 'FFB8C4D6' } },
      };
      cell.alignment = { vertical: 'middle', horizontal: rowNumber === 1 ? 'center' : 'left' };
      if (rowNumber === 1) {
        cell.font = { bold: true, name: 'Microsoft YaHei' };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE4EBDD' } };
      }
    });
  });

  const headers = [
    '所属类型',
    '设计编号',
    '形状',
    '宽(mm)',
    '高(mm)',
    '左高(mm)',
    '右高(mm)',
    '直径(mm)',
    '自定义面积(㎡)',
    '产品组合',
    '组合面积成本',
    '组合周长成本',
    '组合固定成本',
    '组合面积销售',
    '组合周长销售',
    '组合固定销售',
    ...Array.from({ length: accessoryGroupCount }, (_value, index) => ([
      `配件${index + 1}分类`,
      `配件${index + 1}材料`,
      `配件${index + 1}数量`,
    ])).flat(),
    '数量',
    ...Array.from({ length: allocationGroupCount }, (_value, index) => ([
      `分配${index + 1}标签`,
      `分配${index + 1}数量`,
    ])).flat(),
    '成本单价(自动)',
    '销售单价(自动)',
  ];

  templateSheet.addRow(headers);
  templateSheet.getRow(1).font = { bold: true, name: 'Microsoft YaHei' };
  templateSheet.getRow(1).height = 24;
  templateSheet.getRow(1).eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE4EBDD' } };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFB8C4D6' } },
      left: { style: 'thin', color: { argb: 'FFB8C4D6' } },
      bottom: { style: 'thin', color: { argb: 'FFB8C4D6' } },
      right: { style: 'thin', color: { argb: 'FFB8C4D6' } },
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });
  templateSheet.columns = [
    { width: 14 },
    { width: 16 },
    { width: 10 },
    { width: 10 },
    { width: 10 },
    { width: 10 },
    { width: 10 },
    { width: 10 },
    { width: 14 },
    { width: 22 },
    { width: 12 },
    { width: 12 },
    { width: 12 },
    { width: 12 },
    { width: 12 },
    { width: 12 },
    ...Array.from({ length: accessoryGroupCount }, () => ([
      { width: 14 },
      { width: 20 },
      { width: 10 },
    ])).flat(),
    { width: 10 },
    ...Array.from({ length: allocationGroupCount }, () => ([
      { width: 12 },
      { width: 10 },
    ])).flat(),
    { width: 14 },
    { width: 14 },
  ];
  templateSheet.views = [{ state: 'frozen', ySplit: 1 }];
  templateSheet.pageSetup = {
    paperSize: 9,
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    printTitlesRow: '1:1',
  };
  templateSheet.pageSetup.printArea = `A1:${toExcelColumn(headers.length)}200`;

  const productRangeEnd = Math.max(2, productSummaries.length + 1);
  const shapeRangeEnd = Math.max(2, shapeOptions.length + 1);
  const accessoryRangeEnd = Math.max(2, materials.length + 1);
  const accessoryCategoryEnd = Math.max(2, accessoryCategories.length + 1);

  accessoryCategories.forEach((category, index) => {
    accessorySheet.getCell(index + 2, 8).value = category;
  });
  accessorySheet.getColumn(8).width = 16;
  accessorySheet.getCell('H1').value = '分类选项';
  accessorySheet.getCell('H1').font = { bold: true, name: 'Microsoft YaHei' };
  accessorySheet.getCell('H1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE3ECFA' } };

  const productColumn = 10;
  const accessoryStartColumn = 17;
  const quantityColumn = accessoryStartColumn + accessoryGroupCount * 3;
  const allocationStartColumn = quantityColumn + 1;
  const costColumn = allocationStartColumn + allocationGroupCount * 2;
  const retailColumn = costColumn + 1;

  for (let rowIndex = 2; rowIndex <= 200; rowIndex += 1) {
    const row = templateSheet.getRow(rowIndex);
    row.height = 22;
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE0E5DD' } },
        left: { style: 'thin', color: { argb: 'FFE0E5DD' } },
        bottom: { style: 'thin', color: { argb: 'FFE0E5DD' } },
        right: { style: 'thin', color: { argb: 'FFE0E5DD' } },
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });

    templateSheet.getCell(`C${rowIndex}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [`'组合参考'!$H$2:$H$${shapeRangeEnd}`],
      showErrorMessage: true,
    };
    templateSheet.getCell(`${toExcelColumn(productColumn)}${rowIndex}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [`'组合参考'!$A$2:$A$${productRangeEnd}`],
      showErrorMessage: true,
    };
    Array.from({ length: accessoryGroupCount }, (_value, index) => accessoryStartColumn + index * 3).forEach((columnIndex) => {
      templateSheet.getCell(`${toExcelColumn(columnIndex)}${rowIndex}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [`'配件参考'!$H$2:$H$${accessoryCategoryEnd}`],
        showErrorMessage: true,
      };
    });
    Array.from({ length: accessoryGroupCount }, (_value, index) => accessoryStartColumn + index * 3 + 1).forEach((columnIndex) => {
      templateSheet.getCell(`${toExcelColumn(columnIndex)}${rowIndex}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [`'配件参考'!$B$2:$B$${accessoryRangeEnd}`],
        showErrorMessage: true,
      };
    });

    templateSheet.getCell(`K${rowIndex}`).value = { formula: `IFERROR(VLOOKUP($${toExcelColumn(productColumn)}${rowIndex},'组合参考'!$A$2:$G$${productRangeEnd},2,FALSE),0)`, result: 0 };
    templateSheet.getCell(`L${rowIndex}`).value = { formula: `IFERROR(VLOOKUP($${toExcelColumn(productColumn)}${rowIndex},'组合参考'!$A$2:$G$${productRangeEnd},3,FALSE),0)`, result: 0 };
    templateSheet.getCell(`M${rowIndex}`).value = { formula: `IFERROR(VLOOKUP($${toExcelColumn(productColumn)}${rowIndex},'组合参考'!$A$2:$G$${productRangeEnd},4,FALSE),0)`, result: 0 };
    templateSheet.getCell(`N${rowIndex}`).value = { formula: `IFERROR(VLOOKUP($${toExcelColumn(productColumn)}${rowIndex},'组合参考'!$A$2:$G$${productRangeEnd},5,FALSE),0)`, result: 0 };
    templateSheet.getCell(`O${rowIndex}`).value = { formula: `IFERROR(VLOOKUP($${toExcelColumn(productColumn)}${rowIndex},'组合参考'!$A$2:$G$${productRangeEnd},6,FALSE),0)`, result: 0 };
    templateSheet.getCell(`P${rowIndex}`).value = { formula: `IFERROR(VLOOKUP($${toExcelColumn(productColumn)}${rowIndex},'组合参考'!$A$2:$G$${productRangeEnd},7,FALSE),0)`, result: 0 };

    const areaFormula = `IF($C${rowIndex}="圆形",PI()*($H${rowIndex}/2000)^2,IF($C${rowIndex}="梯形",$D${rowIndex}*($F${rowIndex}+$G${rowIndex})/2000000,IF(OR($C${rowIndex}="三角形",$C${rowIndex}="三角"),$D${rowIndex}*$E${rowIndex}/2000000,IF($C${rowIndex}="矩形",$D${rowIndex}*$E${rowIndex}/1000000,$I${rowIndex}))))`;
    const perimeterFormula = `IF($C${rowIndex}="圆形",PI()*$H${rowIndex}/1000,IF($C${rowIndex}="梯形",($D${rowIndex}+$F${rowIndex}+$G${rowIndex}+SQRT($D${rowIndex}^2+ABS($F${rowIndex}-$G${rowIndex})^2))/1000,IF(OR($C${rowIndex}="三角形",$C${rowIndex}="三角"),($D${rowIndex}+$E${rowIndex}+SQRT($D${rowIndex}^2+$E${rowIndex}^2))/1000,IF($C${rowIndex}="矩形",2*($D${rowIndex}+$E${rowIndex})/1000,0))))`;
    const safeAreaFormula = `MAX(${areaFormula},0.0001)`;
    const accessoryCostFormula = Array.from({ length: accessoryGroupCount }, (_value, index) => {
      const materialColumn = toExcelColumn(accessoryStartColumn + index * 3 + 1);
      const quantityValueColumn = toExcelColumn(accessoryStartColumn + index * 3 + 2);
      return `IFERROR(IF($${materialColumn}${rowIndex}="",0,IF(VLOOKUP($${materialColumn}${rowIndex},'配件参考'!$B$2:$F$${accessoryRangeEnd},2,FALSE)="area",$${quantityValueColumn}${rowIndex}*VLOOKUP($${materialColumn}${rowIndex},'配件参考'!$B$2:$F$${accessoryRangeEnd},4,FALSE),IF(VLOOKUP($${materialColumn}${rowIndex},'配件参考'!$B$2:$F$${accessoryRangeEnd},2,FALSE)="perimeter",$${quantityValueColumn}${rowIndex}*VLOOKUP($${materialColumn}${rowIndex},'配件参考'!$B$2:$F$${accessoryRangeEnd},4,FALSE)*(${perimeterFormula})/${safeAreaFormula},$${quantityValueColumn}${rowIndex}*VLOOKUP($${materialColumn}${rowIndex},'配件参考'!$B$2:$F$${accessoryRangeEnd},4,FALSE)/${safeAreaFormula}))),0)`;
    }).join('+');
    const accessoryRetailFormula = Array.from({ length: accessoryGroupCount }, (_value, index) => {
      const materialColumn = toExcelColumn(accessoryStartColumn + index * 3 + 1);
      const quantityValueColumn = toExcelColumn(accessoryStartColumn + index * 3 + 2);
      return `IFERROR(IF($${materialColumn}${rowIndex}="",0,IF(VLOOKUP($${materialColumn}${rowIndex},'配件参考'!$B$2:$F$${accessoryRangeEnd},2,FALSE)="area",$${quantityValueColumn}${rowIndex}*VLOOKUP($${materialColumn}${rowIndex},'配件参考'!$B$2:$F$${accessoryRangeEnd},5,FALSE),IF(VLOOKUP($${materialColumn}${rowIndex},'配件参考'!$B$2:$F$${accessoryRangeEnd},2,FALSE)="perimeter",$${quantityValueColumn}${rowIndex}*VLOOKUP($${materialColumn}${rowIndex},'配件参考'!$B$2:$F$${accessoryRangeEnd},5,FALSE)*(${perimeterFormula})/${safeAreaFormula},$${quantityValueColumn}${rowIndex}*VLOOKUP($${materialColumn}${rowIndex},'配件参考'!$B$2:$F$${accessoryRangeEnd},5,FALSE)/${safeAreaFormula}))),0)`;
    }).join('+');

    templateSheet.getCell(`${toExcelColumn(costColumn)}${rowIndex}`).value = {
      formula: `IFERROR($K${rowIndex}+$L${rowIndex}*(${perimeterFormula})/${safeAreaFormula}+$M${rowIndex}/${safeAreaFormula}+${accessoryCostFormula},0)`,
      result: 0,
    };
    templateSheet.getCell(`${toExcelColumn(retailColumn)}${rowIndex}`).value = {
      formula: `IFERROR($N${rowIndex}+$O${rowIndex}*(${perimeterFormula})/${safeAreaFormula}+$P${rowIndex}/${safeAreaFormula}+${accessoryRetailFormula},0)`,
      result: 0,
    };
    ['K','L','M','N','O','P', toExcelColumn(costColumn), toExcelColumn(retailColumn)].forEach((col) => {
      templateSheet.getCell(`${col}${rowIndex}`).numFmt = '0.00';
    });
  }

  const writeSampleRow = (rowIndex: number, values: Record<string, string | number>) => {
    Object.entries(values).forEach(([col, value]) => {
      templateSheet.getCell(`${col}${rowIndex}`).value = value;
    });
  };

  writeSampleRow(2, {
    A: '平开窗',
    B: 'C1817',
    C: '矩形',
    D: 1800,
    E: 1700,
    J: productSummaries[0]?.name || '',
    Q: accessoryCategories[0] || '',
    R: materials[0]?.name || '',
    S: 2,
    T: accessoryCategories[1] || '',
    U: materials[1]?.name || '',
    V: 1,
    AI: 2,
    AJ: '2F',
    AK: 2,
    AL: 'RF',
    AM: 0,
  });

  writeSampleRow(3, {
    A: '推拉窗',
    B: 'C2425',
    C: '矩形',
    D: 2400,
    E: 2500,
    J: productSummaries[1]?.name || productSummaries[0]?.name || '',
    Q: accessoryCategories[0] || '',
    R: materials[2]?.name || materials[0]?.name || '',
    S: 1,
    AI: 2,
    AJ: '1F',
    AK: 1,
    AL: '2F',
    AM: 1,
    AN: '3F',
    AO: 0,
  });

  await saveWorkbook(workbook, '计算中心导入模板.xlsx');
};
