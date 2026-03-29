import { z } from 'zod';

export const UnitSchema = z.enum(['mm', 'm']);
export type Unit = z.infer<typeof UnitSchema>;

export const MaterialCategorySchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string(),
  sortOrder: z.number().default(0),
  allowMultipleInProduct: z.number().default(0),
  createdAt: z.string().optional(),
});

export const MaterialPricingModeSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  unitLabel: z.string().default('件'),
  includeInComboTotal: z.number().default(0),
  sortOrder: z.number().default(0),
  createdAt: z.string().optional(),
});

export const MaterialItemSchema = z.object({
  id: z.string().uuid().optional(),
  categoryId: z.string(),
  name: z.string(),
  unitType: z.string().default('area'),
  unitLabel: z.string().default('㎡'),
  costPrice: z.number().default(0),
  retailPrice: z.number().default(0),
  remarks: z.string().default(''),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export const PricingProductItemSchema = z.object({
  id: z.string().uuid().optional(),
  productId: z.string().optional(),
  materialId: z.string(),
  calcMode: z.enum(['area', 'perimeter', 'fixed']).default('area'),
  quantity: z.number().default(1),
  includeInComboTotal: z.number().default(0),
  sortOrder: z.number().default(0),
});

export const PricingProductSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string(),
  pricingMode: z.enum(['area', 'perimeter', 'fixed']).default('area'),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  items: z.array(PricingProductItemSchema.extend({
    materialName: z.string().optional(),
    unitLabel: z.string().optional(),
    costPrice: z.number().optional(),
    retailPrice: z.number().optional(),
    remarks: z.string().optional(),
  })).default([]),
});

export const QuotationItemSchema = z.object({
  id: z.string().uuid().optional(),
  projectId: z.string().optional(),
  designNumber: z.string(), // e.g., C1817
  width: z.number(), // mm
  height: z.number(), // mm
  quantity: z.number().default(1),
  productId: z.string(), // reference to pricing_products
  unitPrice: z.number().default(0), // calculated snapshot
  totalPrice: z.number().default(0), // calculated snapshot
  remarks: z.string().default(''),
  createdAt: z.string().optional(),
});

export const QuotationProjectSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string(), // e.g., 方正岳里小区
  buildingName: z.string().default(''), // e.g., 1#、12#楼
  remarks: z.string().default(''),
  rateSettings: z.string().default('[]'),
  isCompleted: z.number().default(0),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  items: z.array(QuotationItemSchema.extend({
    productName: z.string().optional(),
    area: z.number().optional(),
  })).default([]),
  sheets: z.array(z.object({
    id: z.string().optional(),
    projectId: z.string().nullable().optional(),
    sheetName: z.string(),
    fileName: z.string().optional(),
    allocationLabels: z.string().optional(),
    rateSettings: z.string().optional(),
    totalArea: z.number().default(0),
    totalCost: z.number().default(0),
    totalRetail: z.number().default(0),
    itemCount: z.number().default(0),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
  })).default([]),
});

export const PricingRateSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  percentage: z.number().default(0),
  isActive: z.number().default(1),
  createdAt: z.string().optional(),
});

export const PointSchema = z.object({
  x: z.number(),
  y: z.number(),
});

export const WindowItemSchema = z.object({
  id: z.string(),
  designNumber: z.string().default(''),
  width: z.number().default(0),
  height: z.number().default(0),
  points: z.array(PointSchema).default([]),
});

export const DrawingItemSchema = z.object({
  id: z.string().optional(),
  projectId: z.string().nullable().optional(),
  sheetName: z.string(),
  fileName: z.string().default(''),
  allocationLabels: z.array(z.string()).default([]),
  rateSettings: z.string().default('[]'),
  totalArea: z.number().default(0),
  totalCost: z.number().default(0),
  totalRetail: z.number().default(0),
  itemCount: z.number().default(0),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export const StandardSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  windowPattern: z.string(),
  doorPattern: z.string().default('M\\d{4}'),
  wallAreaThreshold: z.number().default(4),
  minWindowArea: z.number().default(0.08),
  minSideLength: z.number().default(180),
  labelMaxDistance: z.number().default(600),
  layerIncludeKeywords: z.string().default('窗,window,win'),
  layerExcludeKeywords: z.string().default('标注,text,dim,轴网,图框,title'),
  createdAt: z.string().optional(),
});

export type MaterialCategory = z.infer<typeof MaterialCategorySchema>;
export type MaterialPricingMode = z.infer<typeof MaterialPricingModeSchema>;
export type MaterialItem = z.infer<typeof MaterialItemSchema>;
export type PricingProduct = z.infer<typeof PricingProductSchema>;
export type PricingRate = z.infer<typeof PricingRateSchema>;
export type QuotationItem = z.infer<typeof QuotationItemSchema>;
export type QuotationProject = z.infer<typeof QuotationProjectSchema>;
export type WindowItem = z.infer<typeof WindowItemSchema>;
export type DrawingItem = z.infer<typeof DrawingItemSchema>;
export type Standard = z.infer<typeof StandardSchema>;
