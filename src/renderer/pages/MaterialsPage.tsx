import React, { useDeferredValue, useEffect, useMemo, useState } from 'react';
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Center,
  Checkbox,
  FileButton,
  Group,
  Modal,
  NumberInput,
  Paper,
  Pagination,
  ScrollArea,
  Select,
  Stack,
  Switch,
  Table,
  Tabs,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import {
  IconArrowDown,
  IconArrowUp,
  IconCategory,
  IconCheck,
  IconChecklist,
  IconCirclePlus,
  IconCopy,
  IconDatabaseImport,
  IconDownload,
  IconEdit,
  IconHistory,
  IconChevronDown,
  IconChevronUp,
  IconList,
  IconPercentage,
  IconSearch,
  IconStar,
  IconTrash,
  IconX,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';

import { PageScaffold } from '../components/ui/PageScaffold';
import { MaterialFormModal } from '../features/materials/MaterialFormModal';
import { PricingModesTab } from '../features/materials/PricingModesTab';
import {
  useCreateMaterial,
  useCreateMaterialCategory,
  useDeleteMaterial,
  useDeleteMaterialCategory,
  useMaterialCategories,
  useMaterialPricingModes,
  useMaterials,
  useUpdateMaterial,
  useUpdateMaterialCategory,
} from '../hooks/useWindowApi';
import { MaterialItem } from '../../shared/schemas';

const defaultUnitTextMap: Record<string, string> = {
  area: '按面积',
  perimeter: '按长度',
  fixed: '按件数',
};

const defaultUnitDisplayMap: Record<string, string> = {
  area: '平方米/m²',
  perimeter: '米/m',
  fixed: '件/pcs',
};

const ITEMS_PER_PAGE = 10;
const TEMPLATE_DROPDOWN_ROW_LIMIT = 2000;
const PAGE_SIZE_OPTIONS = [
  { value: '20', label: '20条/页' },
  { value: '50', label: '50条/页' },
  { value: '100', label: '100条/页' },
];

const EMPTY_FORM = {
  categoryId: '',
  name: '',
  unitType: 'area',
  costPrice: 0,
  retailPrice: 0,
  remarks: '',
};

const IMPORT_ERROR_PREVIEW_LIMIT = 8;

type ImportResultState = {
  opened: boolean;
  title: string;
  tone: 'teal' | 'red' | 'orange';
  summary: string;
  details: string[];
  reportRows: Array<Record<string, string | number>>;
};

type ImportMode = 'strict' | 'skip-invalid';

type ImportPayloadItem = {
  name: string;
  categoryId: string;
  unitType: string;
  unitLabel: string;
  costPrice: number;
  retailPrice: number;
  remarks: string;
};

type ImportPreviewState = {
  opened: boolean;
  fileName: string;
  validItems: ImportPayloadItem[];
  validDetails: string[];
  errorDetails: string[];
  errorRows: Array<Record<string, string | number>>;
};

type ImportPreviewFilter = 'all' | 'valid' | 'error';

const categorizeImportError = (reason: string) => {
  if (reason.includes('现有材料库重复')) return '与材料库重复';
  if (reason.includes('本次导入文件中的其他行重复')) return '文件内重复';
  if (reason.includes('所属分类')) return '分类问题';
  if (reason.includes('计价方式')) return '计价方式问题';
  if (reason.includes('单价')) return '价格问题';
  if (reason.includes('材料名称')) return '名称缺失';
  return '其他问题';
};

const escapeSheetReference = (sheetName: string) => `'${sheetName.replace(/'/g, "''")}'`;
const buildMaterialDuplicateKey = (name: string, categoryId: string, unitType: string) => [name.trim().toLowerCase(), categoryId, unitType].join('::');

const downloadExcelBlob = (content: Uint8Array, fileName: string) => {
  const blobPart = content as unknown as BlobPart;
  const blob = new Blob([blobPart], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
};

const loadXLSX = async () => await import('xlsx');

export default function MaterialsPage() {
  const { data: categories = [] } = useMaterialCategories();
  const { data: pricingModes = [] } = useMaterialPricingModes();
  const { data: materials = [] } = useMaterials();
  const createCategory = useCreateMaterialCategory();
  const createMaterial = useCreateMaterial();
  const updateMaterial = useUpdateMaterial();
  const deleteMaterial = useDeleteMaterial();

  const [activeTab, setActiveTab] = useState<string | null>('list');
  const [selectedCategoryId, setSelectedCategoryId] = useState('all');
  const [keyword, setKeyword] = useState('');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<string[]>([]);
  const [favoriteMaterialIds, setFavoriteMaterialIds] = useState<string[]>([]);
  const [recentMaterialIds, setRecentMaterialIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [bulkAdjustment, setBulkAdjustment] = useState<number | ''>('');
  const [bulkAdjustOpened, setBulkAdjustOpened] = useState(false);
  const [createModalOpened, setCreateModalOpened] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<MaterialItem | null>(null);
  const [recentExpanded, setRecentExpanded] = useState(false);
  const [importMode, setImportMode] = useState<ImportMode>('strict');
  const [importPreviewFilter, setImportPreviewFilter] = useState<ImportPreviewFilter>('all');
  const [importPreview, setImportPreview] = useState<ImportPreviewState>({
    opened: false,
    fileName: '',
    validItems: [],
    validDetails: [],
    errorDetails: [],
    errorRows: [],
  });
  const [importResult, setImportResult] = useState<ImportResultState>({
    opened: false,
    title: '',
    tone: 'teal',
    summary: '',
    details: [],
    reportRows: [],
  });
  const deferredKeyword = useDeferredValue(keyword);

  useEffect(() => {
    const favoriteRaw = window.localStorage.getItem('material-favorites');
    const recentRaw = window.localStorage.getItem('material-recent');
    try {
      if (favoriteRaw) setFavoriteMaterialIds(JSON.parse(favoriteRaw));
      if (recentRaw) setRecentMaterialIds(JSON.parse(recentRaw));
    } catch {
      // ignore malformed local cache
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem('material-favorites', JSON.stringify(favoriteMaterialIds));
  }, [favoriteMaterialIds]);

  useEffect(() => {
    window.localStorage.setItem('material-recent', JSON.stringify(recentMaterialIds));
  }, [recentMaterialIds]);

  useEffect(() => {
    setPage(1);
  }, [keyword, selectedCategoryId, showFavoritesOnly, pageSize]);

  const pricingModeMap = useMemo(
    () => new Map<string, (typeof pricingModes)[number]>(pricingModes.map((mode) => [mode.id || '', mode] as const)),
    [pricingModes],
  );
  const categoryNameMap = useMemo(
    () => new Map(categories.map((category) => [category.id || '', category.name] as const)),
    [categories],
  );
  const materialMap = useMemo(
    () => new Map(materials.map((material) => [material.id || '', material] as const)),
    [materials],
  );
  const existingMaterialKeySet = useMemo(
    () => new Set(
      materials.map((material) => buildMaterialDuplicateKey(material.name, material.categoryId, material.unitType)),
    ),
    [materials],
  );
  const favoriteMaterialSet = useMemo(
    () => new Set(favoriteMaterialIds),
    [favoriteMaterialIds],
  );
  const selectedMaterialSet = useMemo(
    () => new Set(selectedMaterialIds),
    [selectedMaterialIds],
  );
  const importPreviewErrorGroups = useMemo(() => {
    const groups = new Map<string, number>();
    importPreview.errorRows.forEach((row) => {
      const reason = String(row.错误原因 || '');
      const category = categorizeImportError(reason);
      groups.set(category, (groups.get(category) || 0) + 1);
    });
    return Array.from(groups.entries()).map(([label, count]) => ({ label, count }));
  }, [importPreview.errorRows]);
  const visibleImportPreviewValidDetails = useMemo(
    () => (importPreviewFilter === 'error' ? [] : importPreview.validDetails),
    [importPreview.validDetails, importPreviewFilter],
  );
  const visibleImportPreviewErrorDetails = useMemo(
    () => (importPreviewFilter === 'valid' ? [] : importPreview.errorDetails),
    [importPreview.errorDetails, importPreviewFilter],
  );

  const formatUnitDisplay = (unitType: string, unitLabel?: string) => {
    if (unitLabel?.includes('/')) return unitLabel;
    if (defaultUnitDisplayMap[unitType]) return defaultUnitDisplayMap[unitType];
    return unitLabel || '-';
  };

  const reverseUnitTextMap = useMemo(() => {
    const pairs: Array<readonly [string, string]> = pricingModes.flatMap((mode) => ([
      [mode.name, mode.id || ''] as const,
      [defaultUnitTextMap[mode.id || ''] || '', mode.id || ''] as const,
    ]));
    return new Map(pairs.filter(([key, value]) => key && value));
  }, [pricingModes]);

  const filteredMaterials = useMemo(() => (
    materials.filter((item) => {
      const matchesCategory = selectedCategoryId === 'all' || item.categoryId === selectedCategoryId;
      const categoryName = categoryNameMap.get(item.categoryId) || '';
      const pricingModeName = pricingModeMap.get(item.unitType)?.name || '';
      const matchesKeyword = `${item.name} ${categoryName} ${pricingModeName}`.toLowerCase().includes(deferredKeyword.toLowerCase());
      const matchesFavorites = !showFavoritesOnly || favoriteMaterialSet.has(item.id || '');
      return matchesCategory && matchesKeyword && matchesFavorites;
    })
  ), [categoryNameMap, deferredKeyword, favoriteMaterialSet, materials, pricingModeMap, selectedCategoryId, showFavoritesOnly]);

  const recentMaterials = useMemo(
    () => recentMaterialIds.map((id) => materialMap.get(id)).filter(Boolean) as MaterialItem[],
    [materialMap, recentMaterialIds],
  );

  const totalPages = Math.max(1, Math.ceil(filteredMaterials.length / pageSize));
  const pagedMaterials = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredMaterials.slice(start, start + pageSize);
  }, [filteredMaterials, page, pageSize]);

  const allCurrentPageSelected = pagedMaterials.length > 0 && pagedMaterials.every((material) => selectedMaterialIds.includes(material.id || ''));
  const someCurrentPageSelected = pagedMaterials.some((material) => selectedMaterialIds.includes(material.id || ''));

  const markRecent = (id: string) => {
    setRecentMaterialIds((prev) => [id, ...prev.filter((item) => item !== id)].slice(0, 10));
  };

  const toggleMaterialSelection = (id: string) => {
    setSelectedMaterialIds((prev) => prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]);
  };

  const handleBulkAdjust = async () => {
    const percentage = Number(bulkAdjustment);
    if (selectedMaterialIds.length === 0 || !Number.isFinite(percentage) || percentage === 0) return;

    notifications.show({ id: 'adjusting', title: '批量调价中', message: '正在更新选中材料...', loading: true, autoClose: false });
    try {
      await Promise.all(selectedMaterialIds.map((id) => {
        const material = materials.find((item) => item.id === id);
        if (!material) return Promise.resolve();
        return updateMaterial.mutateAsync({
          id,
          data: {
            retailPrice: Number((material.retailPrice * (1 + percentage / 100)).toFixed(2)),
          },
        });
      }));
      notifications.update({ id: 'adjusting', title: '调价成功', message: `已更新 ${selectedMaterialIds.length} 项材料`, color: 'teal', loading: false, autoClose: 3000 });
      setBulkAdjustOpened(false);
      setBulkAdjustment('');
      setSelectedMaterialIds([]);
    } catch (error: any) {
      notifications.update({ id: 'adjusting', title: '调价失败', message: error.message || '部分数据更新失败', color: 'red', loading: false, autoClose: 3000 });
    }
  };

  const handleBulkDelete = async () => {
    if (selectedMaterialIds.length === 0) return;
    if (!window.confirm(`确定删除选中的 ${selectedMaterialIds.length} 项材料吗？`)) return;

    try {
      await Promise.all(selectedMaterialIds.map((id) => deleteMaterial.mutateAsync(id)));
      notifications.show({ title: '删除成功', message: '选中材料已删除', color: 'teal' });
      setSelectedMaterialIds([]);
    } catch (error: any) {
      notifications.show({ title: '删除失败', message: error.message || '部分材料删除失败', color: 'red' });
    }
  };

  const handleDuplicate = async (material: MaterialItem) => {
    try {
      await createMaterial.mutateAsync({
        ...material,
        id: undefined,
        createdAt: undefined,
        updatedAt: undefined,
        name: `${material.name} (副本)`,
      } as any);
      notifications.show({ title: '复制成功', message: `已创建 ${material.name} 的副本`, color: 'teal' });
    } catch {
      notifications.show({ title: '复制失败', message: '当前材料无法复制', color: 'red' });
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      notifications.show({
        id: 'template-export',
        title: '模板生成中',
        message: '正在准备 Excel 模板...',
        loading: true,
        autoClose: false,
      });

      const ExcelJS = (await import('exceljs')).default;
      const workbook = new ExcelJS.Workbook();
      const firstMode = pricingModes[0];
      const dictionarySheetName = '基础数据';
      const categoryCount = Math.max(categories.length, 1);
      const pricingModeCount = Math.max(pricingModes.length, 1);
      const templateSheet = workbook.addWorksheet('材料模板');
      const dictionarySheet = workbook.addWorksheet(dictionarySheetName);

      templateSheet.columns = [
        { header: '材料名称', key: 'name', width: 24 },
        { header: '所属分类', key: 'categoryName', width: 20 },
        { header: '计价方式', key: 'modeName', width: 18 },
        { header: '成本单价', key: 'costPrice', width: 14 },
        { header: '销售单价', key: 'retailPrice', width: 14 },
        { header: '备注', key: 'remarks', width: 30 },
      ];
      templateSheet.addRows([
        {
          name: '示例铝材A',
          categoryName: categories[0]?.name || '默认分类',
          modeName: firstMode?.name || '按面积',
          costPrice: 100,
          retailPrice: 150,
          remarks: '国标 1.4mm',
        },
        {
          name: '示例玻璃B',
          categoryName: categories[1]?.name || categories[0]?.name || '默认分类',
          modeName: pricingModes[1]?.name || firstMode?.name || '按面积',
          costPrice: 88,
          retailPrice: 128,
          remarks: '5+12A+5 中空钢化',
        },
      ]);
      templateSheet.views = [{ state: 'frozen', ySplit: 1 }];
      templateSheet.autoFilter = 'A1:F1';

      templateSheet.getRow(1).font = { bold: true };
      templateSheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE6F4EA' },
      };
      templateSheet.getColumn('D').numFmt = '0.00';
      templateSheet.getColumn('E').numFmt = '0.00';

      dictionarySheet.columns = [
        { header: '分类名称', key: 'categoryName', width: 20 },
        { header: '计价方式名称', key: 'modeName', width: 18 },
        { header: '单位', key: 'unitLabel', width: 12 },
      ];
      const dictionaryRows = Array.from({ length: Math.max(categories.length, pricingModes.length, 1) }, (_, index) => ({
        categoryName: categories[index]?.name || '',
        modeName: pricingModes[index]?.name || '',
        unitLabel: pricingModes[index]?.unitLabel || '',
      }));
      dictionarySheet.addRows(dictionaryRows);
      dictionarySheet.state = 'veryHidden';

      workbook.definedNames.add(
        `${escapeSheetReference(dictionarySheetName)}!$A$2:$A$${categoryCount + 1}`,
        'MaterialCategoryOptions',
      );
      workbook.definedNames.add(
        `${escapeSheetReference(dictionarySheetName)}!$B$2:$B$${pricingModeCount + 1}`,
        'MaterialPricingModeOptions',
      );

      for (let rowIndex = 2; rowIndex <= TEMPLATE_DROPDOWN_ROW_LIMIT + 1; rowIndex += 1) {
        templateSheet.getCell(`B${rowIndex}`).dataValidation = {
          type: 'list',
          allowBlank: true,
          showInputMessage: true,
          showErrorMessage: true,
          promptTitle: '所属分类',
          prompt: '请从下拉列表中选择分类',
          errorTitle: '分类无效',
          error: '请选择模板提供的所属分类',
          formulae: ['MaterialCategoryOptions'],
        };
        templateSheet.getCell(`C${rowIndex}`).dataValidation = {
          type: 'list',
          allowBlank: true,
          showInputMessage: true,
          showErrorMessage: true,
          promptTitle: '计价方式',
          prompt: '请从下拉列表中选择计价方式',
          errorTitle: '计价方式无效',
          error: '请选择模板提供的计价方式',
          formulae: ['MaterialPricingModeOptions'],
        };
      }

      const workbookBuffer = await workbook.xlsx.writeBuffer();
      downloadExcelBlob(new Uint8Array(workbookBuffer), '材料模板.xlsx');
      notifications.update({
        id: 'template-export',
        title: '模板已生成',
        message: '已下载最新材料模板',
        color: 'teal',
        loading: false,
        autoClose: 3000,
      });
    } catch (error: any) {
      notifications.update({
        id: 'template-export',
        title: '模板导出失败',
        message: error?.message || '请稍后重试',
        color: 'red',
        loading: false,
        autoClose: 3000,
      });
    }
  };

  const handleImport = async (file: File | null) => {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const XLSX = await loadXLSX();
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<any>(sheet);
        const categoryMap = new Map(categories.map((category) => [category.name.trim(), category.id || '']));
        const pricingModeNameMap = new Map(
          pricingModes
            .filter((mode) => mode.name?.trim() && mode.id)
            .map((mode) => [mode.name.trim(), mode.id || ''] as const),
        );
        const importErrors: string[] = [];
        const importErrorRows: Array<Record<string, string | number>> = [];
        const importSeenKeySet = new Set<string>();
        const importPayload: ImportPayloadItem[] = [];

        rows.forEach((row, index) => {
          const name = String(row['材料名称'] || '').trim();
          const categoryName = String(row['所属分类'] || '').trim();
          const modeName = String(row['计价方式'] || '').trim();
          const rowNumber = index + 2;
          const categoryId = categoryMap.get(categoryName) || '';
          const modeId = pricingModeNameMap.get(modeName) || reverseUnitTextMap.get(modeName) || '';
          const mode = pricingModeMap.get(modeId);
          const costPrice = Number(row['成本单价']);
          const retailPrice = Number(row['销售单价']);
          const remarks = String(row['备注'] || '').trim();

          if (!name && !categoryName && !modeName && String(row['成本单价'] || '').trim() === '' && String(row['销售单价'] || '').trim() === '' && !remarks) {
            return;
          }

          const pushImportError = (reason: string) => {
            importErrors.push(`第 ${rowNumber} 行：${reason}`);
            importErrorRows.push({
              行号: rowNumber,
              错误原因: reason,
              材料名称: name,
              所属分类: categoryName,
              计价方式: modeName,
              成本单价: String(row['成本单价'] ?? ''),
              销售单价: String(row['销售单价'] ?? ''),
              备注: remarks,
            });
          };

          if (!name) {
            pushImportError('材料名称不能为空');
            return;
          }
          if (!categoryName) {
            pushImportError('所属分类不能为空');
            return;
          }
          if (!categoryId) {
            pushImportError(`所属分类“${categoryName}”不在数据库选项中`);
            return;
          }
          if (!modeName) {
            pushImportError('计价方式不能为空');
            return;
          }
          if (!modeId || !mode) {
            pushImportError(`计价方式“${modeName}”不在数据库选项中`);
            return;
          }
          if (!Number.isFinite(costPrice) || costPrice < 0) {
            pushImportError('成本单价必须是大于等于 0 的数字');
            return;
          }
          if (!Number.isFinite(retailPrice) || retailPrice < 0) {
            pushImportError('销售单价必须是大于等于 0 的数字');
            return;
          }

          const duplicateKey = buildMaterialDuplicateKey(name, categoryId, modeId);
          if (existingMaterialKeySet.has(duplicateKey)) {
            pushImportError('与现有材料库重复（材料名称 + 所属分类 + 计价方式）');
            return;
          }
          if (importSeenKeySet.has(duplicateKey)) {
            pushImportError('与本次导入文件中的其他行重复（材料名称 + 所属分类 + 计价方式）');
            return;
          }
          importSeenKeySet.add(duplicateKey);

          importPayload.push({
            name,
            categoryId,
            unitType: modeId,
            unitLabel: mode?.unitLabel || '㎡',
            costPrice,
            retailPrice,
            remarks,
          });
        });

        const importedDetails = importPayload.map((item, index) => {
          const categoryName = categoryNameMap.get(item.categoryId) || '-';
          const pricingModeName = pricingModeMap.get(item.unitType)?.name || item.unitType;
          return `${index + 1}. ${item.name} / ${categoryName} / ${pricingModeName} / 成本 ${item.costPrice.toFixed(2)} / 销售 ${item.retailPrice.toFixed(2)}`;
        });
        setImportPreview({
          opened: true,
          fileName: file.name,
          validItems: importPayload,
          validDetails: importedDetails,
          errorDetails: importErrors,
          errorRows: importErrorRows,
        });
        setImportPreviewFilter('all');
        notifications.update({
          id: 'import',
          title: '预览已生成',
          message: `可导入 ${importPayload.length} 项，问题 ${importErrors.length} 项`,
          color: importErrors.length > 0 ? 'orange' : 'teal',
          loading: false,
          autoClose: 3000,
        });
      } catch (error: any) {
        notifications.update({
          id: 'import',
          title: '预览失败',
          message: error?.message || '请检查模板格式',
          color: 'red',
          loading: false,
          autoClose: 3000,
        });
      }
    };
    notifications.show({ id: 'import', title: '解析中', message: '正在生成导入预览...', loading: true, autoClose: false });
    reader.readAsArrayBuffer(file);
  };

  const handleConfirmImport = async () => {
    const validItems = importPreview.validItems;
    const importErrors = importPreview.errorDetails;
    const importErrorRows = importPreview.errorRows;

    if (validItems.length === 0) {
      setImportPreview((prev) => ({ ...prev, opened: false }));
      setImportResult({
        opened: true,
        title: '导入失败',
        tone: 'red',
        summary: '表格中没有可导入的数据行。',
        details: [],
        reportRows: importErrorRows,
      });
      return;
    }

    if (importErrors.length > 0 && importMode === 'strict') {
      const preview = importErrors.slice(0, IMPORT_ERROR_PREVIEW_LIMIT).join('\n');
      const moreText = importErrors.length > IMPORT_ERROR_PREVIEW_LIMIT
        ? `\n另有 ${importErrors.length - IMPORT_ERROR_PREVIEW_LIMIT} 条错误未展示`
        : '';
      setImportPreview((prev) => ({ ...prev, opened: false }));
      setImportResult({
        opened: true,
        title: '导入失败',
        tone: 'red',
        summary: `共发现 ${importErrors.length} 个问题，本次未导入任何数据。`,
        details: importErrors,
        reportRows: importErrorRows,
      });
      notifications.update({
        id: 'import',
        title: '导入失败',
        message: `共发现 ${importErrors.length} 个问题\n${preview}${moreText}`,
        color: 'red',
        loading: false,
        autoClose: 8000,
      });
      return;
    }

    notifications.update({
      id: 'import',
      title: '导入中',
      message: '正在写入材料数据...',
      loading: true,
      color: 'blue',
      autoClose: false,
    });

    try {
      for (const item of validItems) {
        await createMaterial.mutateAsync(item);
      }

      const importedDetails = importPreview.validDetails;
      setImportPreview((prev) => ({ ...prev, opened: false }));

      if (importErrors.length > 0) {
        const skippedDetails = importErrors.map((error, index) => `跳过 ${index + 1}. ${error}`);
        setImportResult({
          opened: true,
          title: '部分导入成功',
          tone: 'orange',
          summary: `成功导入 ${validItems.length} 项，跳过 ${importErrors.length} 项。`,
          details: [...importedDetails, ...skippedDetails],
          reportRows: importErrorRows,
        });
        notifications.update({
          id: 'import',
          title: '部分导入成功',
          message: `成功导入 ${validItems.length} 项，跳过 ${importErrors.length} 项`,
          color: 'orange',
          loading: false,
          autoClose: 5000,
        });
        return;
      }

      setImportResult({
        opened: true,
        title: '导入成功',
        tone: 'teal',
        summary: `成功导入 ${validItems.length} 项材料。`,
        details: importedDetails,
        reportRows: [],
      });
      notifications.update({
        id: 'import',
        title: '导入成功',
        message: `成功导入 ${validItems.length} 项材料`,
        color: 'teal',
        loading: false,
        autoClose: 3000,
      });
    } catch (error: any) {
      setImportPreview((prev) => ({ ...prev, opened: false }));
      setImportResult({
        opened: true,
        title: '导入失败',
        tone: 'red',
        summary: error?.message || '请检查模板格式。',
        details: [],
        reportRows: importErrorRows,
      });
      notifications.update({
        id: 'import',
        title: '导入失败',
        message: error?.message || '请检查模板格式',
        color: 'red',
        loading: false,
        autoClose: 3000,
      });
    }
  };

  const handleCopyImportDetails = async () => {
    const content = [importResult.summary, ...importResult.details].filter(Boolean).join('\n');
    if (!content) return;

    try {
      await navigator.clipboard.writeText(content);
      notifications.show({ title: '已复制', message: '导入结果已复制到剪贴板', color: 'teal' });
    } catch {
      notifications.show({ title: '复制失败', message: '当前环境不支持自动复制', color: 'red' });
    }
  };

  const handleDownloadImportErrorReport = () => {
    if (importResult.reportRows.length === 0) return;

    void (async () => {
      const XLSX = await loadXLSX();
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(importResult.reportRows);
    ws['!cols'] = [
      { wch: 10 },
      { wch: 36 },
      { wch: 24 },
      { wch: 20 },
      { wch: 18 },
      { wch: 14 },
      { wch: 14 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, '导入错误');
    XLSX.writeFile(wb, '材料导入错误明细.xlsx');
    })();
  };

  return (
    <PageScaffold
      title="材料单价"
      description="在这里维护材料、分类和单位，后面的组合和报价都会直接引用这里的单价。"
      actions={
        <Group gap="xs">
          <Button size="sm" variant="subtle" color="gray" leftSection={<IconDownload size={16} />} onClick={handleDownloadTemplate}>
            下载模板
          </Button>
          <Select
            size="sm"
            w={150}
            value={importMode}
            onChange={(value) => setImportMode((value as ImportMode) || 'strict')}
            data={[
              { value: 'strict', label: '严格导入' },
              { value: 'skip-invalid', label: '跳过错误项' },
            ]}
          />
          <FileButton onChange={handleImport} accept=".xlsx,.xls">
            {(props) => (
              <Button size="sm" {...props} variant="default" leftSection={<IconDatabaseImport size={16} />}>
                批量导入
              </Button>
            )}
          </FileButton>
          <Button size="sm" color="teal" leftSection={<IconCirclePlus size={16} />} onClick={() => setCreateModalOpened(true)}>
            新建材料
          </Button>
        </Group>
      }
    >
      <Tabs value={activeTab} onChange={setActiveTab} variant="pills" radius="xl">
        <Tabs.List mb="sm" p={3} style={{ background: 'var(--mantine-color-gray-1)', borderRadius: 100, width: 'fit-content' }}>
          <Tabs.Tab value="list" color="teal" leftSection={<IconList size={16} />}>材料列表</Tabs.Tab>
          <Tabs.Tab value="pricingModes" color="blue" leftSection={<IconPercentage size={16} />}>单位</Tabs.Tab>
          <Tabs.Tab value="categories" color="orange" leftSection={<IconCategory size={16} />}>分类管理</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="list">
          <Stack gap="sm">
            <div className="app-stat-grid">
              <div className="app-stat-card">
                <div className="app-stat-label">材料总数</div>
                <div className="app-stat-value">{materials.length}</div>
                <div className="app-stat-note">当前可用于组合和报价的基础材料项</div>
              </div>
              <div className="app-stat-card">
                <div className="app-stat-label">筛选结果</div>
                <div className="app-stat-value">{filteredMaterials.length}</div>
                <div className="app-stat-note">会随关键词、分类和收藏条件联动更新</div>
              </div>
              <div className="app-stat-card">
                <div className="app-stat-label">分类数量</div>
                <div className="app-stat-value">{categories.length}</div>
                <div className="app-stat-note">分类规则会直接影响组合选材节奏</div>
              </div>
              <div className="app-stat-card">
                <div className="app-stat-label">快捷访问</div>
                <div className="app-stat-value">{favoriteMaterialIds.length + recentMaterials.length}</div>
                <div className="app-stat-note">收藏 {favoriteMaterialIds.length} 项，最近 {recentMaterials.length} 项</div>
              </div>
            </div>

            <div className="page-toolbar">
              <Stack gap="sm">
                <div className="page-toolbar-main">
                  <Tooltip label="本页全选">
                    <Checkbox
                      size="sm"
                      color="teal"
                      checked={allCurrentPageSelected}
                      indeterminate={!allCurrentPageSelected && someCurrentPageSelected}
                      onChange={() => {
                        const pageIds = pagedMaterials.map((material) => material.id || '');
                        setSelectedMaterialIds((prev) => allCurrentPageSelected
                          ? prev.filter((id) => !pageIds.includes(id))
                          : Array.from(new Set([...prev, ...pageIds])));
                      }}
                    />
                  </Tooltip>
                  <TextInput
                    size="sm"
                    placeholder="搜索材料、分类、单位"
                    leftSection={<IconSearch size={16} />}
                    value={keyword}
                    onChange={(event) => setKeyword(event.currentTarget.value)}
                    className="page-toolbar-fill"
                  />
                  <div className="page-toolbar-meta">
                    <Select
                      size="sm"
                      placeholder="分类"
                      leftSection={<IconCategory size={15} />}
                      data={[{ value: 'all', label: '全部' }, ...categories.map((category) => ({ value: category.id || '', label: category.name }))]}
                      value={selectedCategoryId}
                      onChange={(value) => setSelectedCategoryId(value || 'all')}
                      w={160}
                    />
                    <Select
                      size="sm"
                      leftSection={<IconChecklist size={15} />}
                      data={PAGE_SIZE_OPTIONS}
                      value={String(pageSize)}
                      onChange={(value) => setPageSize(Number(value) || 20)}
                      w={120}
                    />
                    <Tooltip label={showFavoritesOnly ? '显示全部材料' : '仅看收藏'}>
                      <ActionIcon
                        size="lg"
                        radius="xl"
                        variant={showFavoritesOnly ? 'filled' : 'light'}
                        color="yellow"
                        onClick={() => setShowFavoritesOnly((prev) => !prev)}
                      >
                        <IconStar size={14} fill={showFavoritesOnly ? 'currentColor' : 'none'} />
                      </ActionIcon>
                    </Tooltip>
                  </div>
                </div>

                {(recentMaterials.length > 0 || selectedMaterialIds.length > 0) && (
                  <div className="selection-strip">
                    <Group gap="xs" wrap="nowrap" style={{ minWidth: 0, flex: 1 }}>
                      {recentMaterials.length > 0 && (
                        <>
                          <IconHistory size={16} color="gray" />
                          <Button
                            size="xs"
                            variant="subtle"
                            color="gray"
                            rightSection={recentExpanded ? <IconChevronUp size={13} /> : <IconChevronDown size={13} />}
                            onClick={() => setRecentExpanded((prev) => !prev)}
                          >
                            最近 {recentMaterials.length}
                          </Button>
                          {recentExpanded && recentMaterials.slice(0, 4).map((material) => (
                            <Button
                              key={material.id}
                              size="xs"
                              variant="subtle"
                              color="gray"
                              onClick={() => setKeyword(material.name)}
                            >
                              {material.name}
                            </Button>
                          ))}
                        </>
                      )}
                    </Group>
                    {selectedMaterialIds.length > 0 && (
                      <Group gap="xs" wrap="nowrap">
                        <Badge size="sm" color="teal" variant="light">已选 {selectedMaterialIds.length} 项</Badge>
                        <Button size="xs" color="teal" onClick={() => setBulkAdjustOpened(true)}>
                          批量调价
                        </Button>
                        <Button size="xs" variant="light" color="gray" onClick={() => setSelectedMaterialIds([])}>
                          清空
                        </Button>
                        <Button size="xs" variant="light" color="red" leftSection={<IconTrash size={13} />} onClick={handleBulkDelete}>
                          删除
                        </Button>
                      </Group>
                    )}
                  </div>
                )}
              </Stack>
            </div>

            <Box style={{ minHeight: 400 }}>
              {pagedMaterials.length > 0 ? (
                <>
                  <Paper withBorder radius="md" className="app-surface app-table-shell">
                    <ScrollArea h="calc(100vh - 290px)">
                    <Table highlightOnHover striped verticalSpacing="sm" horizontalSpacing="sm" stickyHeader>
                      <Table.Thead bg="gray.0">
                        <Table.Tr>
                          <Table.Th ta="center" w={52}></Table.Th>
                          <Table.Th ta="left" w={320}>材料名称</Table.Th>
                          <Table.Th ta="center">分类</Table.Th>
                          <Table.Th ta="center" w={220}>单位</Table.Th>
                          <Table.Th ta="right" w={120}>成本</Table.Th>
                          <Table.Th ta="right" w={120}>销售</Table.Th>
                          <Table.Th ta="left">备注</Table.Th>
                          <Table.Th ta="center" w={96}>操作</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {pagedMaterials.map((material) => {
                          const categoryName = categoryNameMap.get(material.categoryId) || '未分类';
                          const pricingMode = pricingModeMap.get(material.unitType);
                          const isSelected = selectedMaterialSet.has(material.id || '');
                          const isFavorite = favoriteMaterialSet.has(material.id || '');

                          return (
                            <Table.Tr
                              key={material.id}
                              bg={isSelected ? 'teal.0' : undefined}
                              style={{ cursor: 'pointer' }}
                              onClick={() => markRecent(material.id || '')}
                            >
                              <Table.Td ta="center">
                                <Checkbox
                                  size="sm"
                                  checked={isSelected}
                                  color="teal"
                                  onClick={(event) => event.stopPropagation()}
                                  onChange={() => toggleMaterialSelection(material.id || '')}
                                />
                              </Table.Td>
                              <Table.Td ta="left">
                                <Text fw={700} size="sm" truncate>{material.name}</Text>
                              </Table.Td>
                              <Table.Td ta="center">
                                <Badge size="sm" variant="light" color="gray">{categoryName}</Badge>
                              </Table.Td>
                              <Table.Td ta="center">
                                <Text size="sm">
                                  {(pricingMode?.name || defaultUnitTextMap[material.unitType] || material.unitType)}
                                  {' · '}
                                  {formatUnitDisplay(material.unitType, material.unitLabel || pricingMode?.unitLabel)}
                                </Text>
                              </Table.Td>
                              <Table.Td ta="right">
                                <Text size="sm" fw={700} c="teal.8">¥ {material.costPrice.toFixed(2)}</Text>
                              </Table.Td>
                              <Table.Td ta="right">
                                <Text size="sm" fw={700} c="orange.8">¥ {material.retailPrice.toFixed(2)}</Text>
                              </Table.Td>
                              <Table.Td ta="left">
                                <Text size="xs" c="dimmed" lineClamp={2}>{material.remarks || '-'}</Text>
                              </Table.Td>
                              <Table.Td ta="center">
                                <Group gap={6} justify="center" wrap="nowrap">
                                  <Tooltip label="收藏">
                                    <ActionIcon
                                      variant={isFavorite ? 'filled' : 'subtle'}
                                      color="yellow"
                                      size="sm"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        setFavoriteMaterialIds((prev) => prev.includes(material.id || '')
                                          ? prev.filter((id) => id !== material.id)
                                          : [...prev, material.id || '']);
                                      }}
                                    >
                                      <IconStar size={16} fill={isFavorite ? 'currentColor' : 'none'} />
                                    </ActionIcon>
                                  </Tooltip>
                                  <Tooltip label="复制">
                                    <ActionIcon
                                      variant="light"
                                      color="gray"
                                      size="sm"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        void handleDuplicate(material);
                                      }}
                                    >
                                      <IconCopy size={14} />
                                    </ActionIcon>
                                  </Tooltip>
                                  <Tooltip label="编辑">
                                    <ActionIcon
                                      variant="light"
                                      color="indigo"
                                      size="sm"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        setEditingMaterial(material);
                                      }}
                                    >
                                      <IconEdit size={14} />
                                    </ActionIcon>
                                  </Tooltip>
                                  <Tooltip label="删除">
                                    <ActionIcon
                                      variant="light"
                                      color="red"
                                      size="sm"
                                      onClick={async (event) => {
                                        event.stopPropagation();
                                        if (window.confirm(`确定删除 ${material.name}？`)) {
                                          await deleteMaterial.mutateAsync(material.id || '');
                                        }
                                      }}
                                    >
                                      <IconTrash size={14} />
                                    </ActionIcon>
                                  </Tooltip>
                                </Group>
                              </Table.Td>
                            </Table.Tr>
                          );
                        })}
                      </Table.Tbody>
                    </Table>
                    </ScrollArea>
                  </Paper>

                  {totalPages > 1 && (
                    <Center mt="md" pb="xs">
                      <Pagination size="sm" total={totalPages} value={page} onChange={setPage} color="teal" radius="xl" withEdges siblings={1} boundaries={1} />
                    </Center>
                  )}
                </>
              ) : (
                <Center h={300}>
                  <Text c="dimmed">未找到匹配材料</Text>
                </Center>
              )}
            </Box>
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="pricingModes">
          <PricingModesTab />
        </Tabs.Panel>

        <Tabs.Panel value="categories">
          <CategoryManager materials={materials} />
        </Tabs.Panel>
      </Tabs>

      <MaterialFormModal
        opened={createModalOpened}
        title="新建材料"
        categories={categories}
        pricingModes={pricingModes}
        initialValues={{
          ...EMPTY_FORM,
          unitType: pricingModes[0]?.id || 'area',
        }}
        loading={createMaterial.isPending}
        onClose={() => setCreateModalOpened(false)}
        onSubmit={async (values) => {
          const pricingMode = pricingModeMap.get(values.unitType);
          await createMaterial.mutateAsync({
            ...values,
            unitLabel: pricingMode?.unitLabel || '',
          });
          setCreateModalOpened(false);
          notifications.show({ title: '添加成功', message: values.name, color: 'teal' });
        }}
      />

      <MaterialFormModal
        opened={!!editingMaterial}
        title="编辑材料"
        categories={categories}
        pricingModes={pricingModes}
        initialValues={editingMaterial ? {
          id: editingMaterial.id,
          categoryId: editingMaterial.categoryId,
          name: editingMaterial.name,
          unitType: editingMaterial.unitType,
          costPrice: editingMaterial.costPrice,
          retailPrice: editingMaterial.retailPrice,
          remarks: editingMaterial.remarks || '',
        } : { ...EMPTY_FORM, unitType: pricingModes[0]?.id || 'area' }}
        loading={updateMaterial.isPending}
        onClose={() => setEditingMaterial(null)}
        onSubmit={async (values) => {
          const pricingMode = pricingModeMap.get(values.unitType);
          await updateMaterial.mutateAsync({
            id: values.id || '',
            data: {
              categoryId: values.categoryId,
              name: values.name,
              unitType: values.unitType,
              unitLabel: pricingMode?.unitLabel || '',
              costPrice: values.costPrice,
              retailPrice: values.retailPrice,
              remarks: values.remarks,
            },
          });
          setEditingMaterial(null);
          notifications.show({ title: '更新成功', message: values.name, color: 'teal' });
        }}
      />

      <Modal opened={bulkAdjustOpened} onClose={() => setBulkAdjustOpened(false)} title="批量调价" centered radius="md">
        <Stack>
          <Text size="sm" c="dimmed">对当前选中的 {selectedMaterialIds.length} 项材料统一调整销售单价。</Text>
          <NumberInput
            label="调价百分比"
            placeholder="例如 10 或 -5"
            suffix=" %"
            value={bulkAdjustment}
            onChange={(value) => setBulkAdjustment(typeof value === 'number' ? value : '')}
          />
          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => setBulkAdjustOpened(false)}>取消</Button>
            <Button color="teal" onClick={handleBulkAdjust}>应用</Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={importPreview.opened}
        onClose={() => setImportPreview((prev) => ({ ...prev, opened: false }))}
        title="导入预览"
        centered
        radius="md"
        size="xl"
      >
        <Stack gap="sm">
          <Group justify="space-between" align="flex-start">
            <Stack gap={4}>
              <Text size="sm" fw={600}>{importPreview.fileName || '未命名文件'}</Text>
              <Text size="sm" c="dimmed">
                可导入 {importPreview.validItems.length} 项，发现问题 {importPreview.errorDetails.length} 项，当前模式：{importMode === 'strict' ? '严格导入' : '跳过错误项'}
              </Text>
            </Stack>
            {importPreview.errorRows.length > 0 && (
              <Button
                size="xs"
                variant="light"
                color="orange"
                leftSection={<IconDownload size={14} />}
                onClick={() => {
                  setImportResult((prev) => ({ ...prev, reportRows: importPreview.errorRows }));
                  handleDownloadImportErrorReport();
                }}
              >
                下载错误表
              </Button>
            )}
          </Group>

          {importPreviewErrorGroups.length > 0 && (
            <Group gap="xs">
              {importPreviewErrorGroups.map((group) => (
                <Badge key={group.label} size="md" color="orange" variant="light">
                  {group.label} {group.count}
                </Badge>
              ))}
            </Group>
          )}

          <Group gap="xs">
            <Button
              size="xs"
              variant={importPreviewFilter === 'all' ? 'filled' : 'light'}
              color="gray"
              onClick={() => setImportPreviewFilter('all')}
            >
              全部
            </Button>
            <Button
              size="xs"
              variant={importPreviewFilter === 'valid' ? 'filled' : 'light'}
              color="teal"
              onClick={() => setImportPreviewFilter('valid')}
            >
              待导入
            </Button>
            <Button
              size="xs"
              variant={importPreviewFilter === 'error' ? 'filled' : 'light'}
              color="orange"
              onClick={() => setImportPreviewFilter('error')}
            >
              问题项
            </Button>
          </Group>

          <Paper withBorder radius="md" p="xs">
            <ScrollArea h={320}>
              <Stack gap="xs">
                {visibleImportPreviewValidDetails.length > 0 && (
                  <>
                    <Text size="sm" fw={700} c="teal">待导入</Text>
                    {visibleImportPreviewValidDetails.map((detail, index) => (
                      <Text key={`valid-${index}`} size="sm">{detail}</Text>
                    ))}
                  </>
                )}
                {visibleImportPreviewErrorDetails.length > 0 && (
                  <>
                    <Text size="sm" fw={700} c="orange">问题项</Text>
                    {visibleImportPreviewErrorDetails.map((detail, index) => (
                      <Text key={`error-${index}`} size="sm" c="orange.9">{detail}</Text>
                    ))}
                  </>
                )}
                {visibleImportPreviewValidDetails.length === 0 && visibleImportPreviewErrorDetails.length === 0 && (
                  <Text size="sm" c="dimmed">表格中没有可识别的数据。</Text>
                )}
              </Stack>
            </ScrollArea>
          </Paper>

          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => setImportPreview((prev) => ({ ...prev, opened: false }))}>取消</Button>
            <Button
              color="teal"
              onClick={() => { void handleConfirmImport(); }}
              disabled={importPreview.validItems.length === 0 || (importMode === 'strict' && importPreview.errorDetails.length > 0)}
            >
              确认导入
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={importResult.opened}
        onClose={() => setImportResult((prev) => ({ ...prev, opened: false }))}
        title={importResult.title}
        centered
        radius="md"
        size="lg"
      >
        <Stack gap="sm">
          <Group justify="space-between" align="center">
            <Text size="sm" fw={600} c={importResult.tone}>
              {importResult.summary}
            </Text>
            {importResult.details.length > 0 && (
              <Group gap="xs">
                {importResult.reportRows.length > 0 && (
                  <Button
                    size="xs"
                    variant="light"
                    color={importResult.tone}
                    leftSection={<IconDownload size={14} />}
                    onClick={handleDownloadImportErrorReport}
                  >
                    下载错误表
                  </Button>
                )}
                <Button
                  size="xs"
                  variant="light"
                  color={importResult.tone}
                  leftSection={<IconCopy size={14} />}
                  onClick={() => { void handleCopyImportDetails(); }}
                >
                  复制明细
                </Button>
              </Group>
            )}
          </Group>
          {importResult.details.length > 0 && (
            <Paper withBorder radius="md" p="xs">
              <ScrollArea h={280}>
                <Stack gap={6}>
                  {importResult.details.map((detail, index) => (
                    <Text key={`${detail}-${index}`} size="sm" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {detail}
                    </Text>
                  ))}
                </Stack>
              </ScrollArea>
            </Paper>
          )}
        </Stack>
      </Modal>
    </PageScaffold>
  );
}

function CategoryManager({ materials }: { materials: MaterialItem[] }) {
  const { data: categories = [] } = useMaterialCategories();
  const createCategory = useCreateMaterialCategory();
  const deleteCategory = useDeleteMaterialCategory();
  const updateCategory = useUpdateMaterialCategory();

  const [newName, setNewName] = useState('');
  const [newAllowMultiple, setNewAllowMultiple] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const handleMove = async (id: string, direction: number) => {
    const index = categories.findIndex((category) => category.id === id);
    const target = categories[index + direction];
    if (!target) return;

    await Promise.all([
      updateCategory.mutateAsync({ id, data: { sortOrder: target.sortOrder || 0 } }),
      updateCategory.mutateAsync({ id: target.id || '', data: { sortOrder: categories[index].sortOrder || 0 } }),
    ]);
  };

  return (
    <Stack gap="sm">
      <Paper withBorder p="sm" radius="md" bg="gray.0">
        <Group align="flex-end" gap="sm" wrap="nowrap">
          <TextInput size="sm" label="新增分类" placeholder="输入名称..." style={{ flex: 1 }} value={newName} onChange={(event) => setNewName(event.currentTarget.value)} />
          <Switch size="sm" label="允许组合重复" checked={newAllowMultiple} onChange={(event) => setNewAllowMultiple(event.currentTarget.checked)} />
          <Button
            size="sm"
            color="orange"
            leftSection={<IconCirclePlus size={16} />}
            onClick={async () => {
              if (!newName.trim()) return;
              await createCategory.mutateAsync({
                name: newName.trim(),
                sortOrder: categories.length,
                allowMultipleInProduct: newAllowMultiple ? 1 : 0,
              });
              setNewName('');
              setNewAllowMultiple(false);
            }}
          >
            确认添加
          </Button>
        </Group>
      </Paper>

      <Paper withBorder radius="md" style={{ overflow: 'hidden' }}>
        <ScrollArea h="calc(100vh - 300px)">
        <Table verticalSpacing="sm" horizontalSpacing="sm" stickyHeader>
          <Table.Thead bg="gray.1">
            <Table.Tr>
              <Table.Th ta="center" w={80}>序号</Table.Th>
              <Table.Th ta="center">分类名称</Table.Th>
              <Table.Th ta="center" w={150}>允许重复</Table.Th>
              <Table.Th ta="center" w={120}>排序</Table.Th>
              <Table.Th ta="center" w={120}>材料数</Table.Th>
              <Table.Th ta="center" w={200}>操作</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {categories.map((category, index) => {
              const count = materials.filter((material) => material.categoryId === category.id).length;
              const isEditing = editingId === category.id;

              return (
                <Table.Tr key={category.id}>
                  <Table.Td ta="center">
                    <Badge size="sm" variant="light" color="orange">{index + 1}</Badge>
                  </Table.Td>
                  <Table.Td ta="center">
                    {isEditing ? (
                      <TextInput size="sm" value={editValue} onChange={(event) => setEditValue(event.currentTarget.value)} autoFocus />
                    ) : (
                      <Text size="sm" fw={600}>{category.name}</Text>
                    )}
                  </Table.Td>
                  <Table.Td ta="center">
                    <Switch
                      size="sm"
                      checked={Boolean(category.allowMultipleInProduct)}
                      onChange={(event) => updateCategory.mutateAsync({
                        id: category.id || '',
                        data: { allowMultipleInProduct: event.currentTarget.checked ? 1 : 0 },
                      })}
                      onLabel="是"
                      offLabel="否"
                    />
                  </Table.Td>
                  <Table.Td ta="center">
                    <Group gap={4} justify="center">
                      <ActionIcon size="sm" variant="subtle" disabled={index === 0} onClick={() => handleMove(category.id || '', -1)}>
                        <IconArrowUp size={16} />
                      </ActionIcon>
                      <ActionIcon size="sm" variant="subtle" disabled={index === categories.length - 1} onClick={() => handleMove(category.id || '', 1)}>
                        <IconArrowDown size={16} />
                      </ActionIcon>
                    </Group>
                  </Table.Td>
                  <Table.Td ta="center">
                    <Badge size="sm" variant="outline" color={count > 0 ? 'blue' : 'gray'}>{count}</Badge>
                  </Table.Td>
                  <Table.Td ta="center">
                    <Group gap={6} justify="center" wrap="nowrap">
                      {isEditing ? (
                        <>
                          <ActionIcon
                            size="sm"
                            color="teal"
                            onClick={async () => {
                              if (!editValue.trim()) return;
                              await updateCategory.mutateAsync({ id: category.id || '', data: { name: editValue.trim() } });
                              setEditingId(null);
                            }}
                          >
                            <IconCheck size={18} />
                          </ActionIcon>
                          <ActionIcon size="sm" color="gray" onClick={() => setEditingId(null)}>
                            <IconX size={16} />
                          </ActionIcon>
                        </>
                      ) : (
                        <>
                          <ActionIcon size="sm" variant="subtle" color="indigo" onClick={() => { setEditingId(category.id || ''); setEditValue(category.name); }}>
                            <IconEdit size={16} />
                          </ActionIcon>
                          <ActionIcon size="sm" variant="subtle" color="red" onClick={() => setDeleteConfirmId(category.id || '')}>
                            <IconTrash size={16} />
                          </ActionIcon>
                        </>
                      )}
                    </Group>
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
        </ScrollArea>
      </Paper>

      <Modal opened={!!deleteConfirmId} onClose={() => setDeleteConfirmId(null)} title="确认删除" centered radius="md">
        <Stack>
          <Text size="sm">确定要删除分类 “{categories.find((category) => category.id === deleteConfirmId)?.name}” 吗？</Text>
          <Group justify="flex-end" mt="md">
            <Button variant="subtle" onClick={() => setDeleteConfirmId(null)}>取消</Button>
            <Button
              color="red"
              onClick={async () => {
                const count = materials.filter((material) => material.categoryId === deleteConfirmId).length;
                if (count > 0) {
                  notifications.show({ title: '无法删除', message: `仍有 ${count} 项材料关联`, color: 'red' });
                  return;
                }
                await deleteCategory.mutateAsync(deleteConfirmId || '');
                setDeleteConfirmId(null);
              }}
            >
              确认删除
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
