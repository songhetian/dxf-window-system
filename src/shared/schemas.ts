import { z } from 'zod';

export const UnitSchema = z.enum(['mm', 'm']);
export type Unit = z.infer<typeof UnitSchema>;

export const WindowItemSchema = z.object({
  id: z.string().uuid().optional(),
  drawingId: z.string().uuid().optional(), // 关联图纸 ID
  name: z.string().min(1, '名称不能为空'),
  category: z.string().default('默认'),
  shapeType: z.string(),
  width: z.number(),
  height: z.number(),
  area: z.number(),
  glassArea: z.number().optional(),
  perimeter: z.number().optional(),
  frameWeight: z.number().optional(),
  handle: z.string().optional(),
  arcRatio: z.number().optional(),
  symmetryRate: z.number().optional(),
  points: z.array(z.object({ x: z.number(), y: z.number() })),
  createdAt: z.string().optional(),
});

export const DrawingSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string(),
  fileName: z.string(),
  windowCount: z.number(),
  totalArea: z.number(),
  createdAt: z.string().optional(),
});

export type WindowItem = z.infer<typeof WindowItemSchema>;
export type DrawingItem = z.infer<typeof DrawingSchema>;

export const StandardSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  windowPattern: z.string().default('^C\\d{4}$'),
  doorPattern: z.string().default('M\\d{4}'),
  wallAreaThreshold: z.number().default(4),
  minWindowArea: z.number().default(0.08),
  minSideLength: z.number().default(180),
  labelMaxDistance: z.number().default(600),
  layerIncludeKeywords: z.string().default('窗,window,win'),
  layerExcludeKeywords: z.string().default('标注,text,dim,轴网,图框,title'),
  isDefault: z.number().default(0),
  createdAt: z.string().optional(),
});

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
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export const PricingRateSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string(),
  percentage: z.number().default(0),
  isActive: z.number().default(1),
  createdAt: z.string().optional(),
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
  })).default([]),
});

export const QuoteDetailSchema = z.object({
  materialId: z.string().optional(),
  name: z.string(),
  lineId: z.string().optional(),
  lineName: z.string().optional(),
  sourceType: z.string().optional(),
  basisMode: z.string().optional(),
  baseValue: z.number().optional(),
  categoryName: z.string().optional(),
  quantity: z.number(),
  unit: z.string(),
  costPrice: z.number(),
  retailPrice: z.number(),
  costSubtotal: z.number(),
  retailSubtotal: z.number(),
  allocatedCostPerSquareMeter: z.number().optional(),
  allocatedRetailPerSquareMeter: z.number().optional(),
});

export const QuoteExtraMaterialSchema = z.object({
  id: z.string(),
  materialId: z.string(),
  name: z.string(),
  categoryId: z.string().optional(),
  categoryName: z.string().optional(),
  unitType: z.string(),
  unitLabel: z.string().optional(),
  quantity: z.number().default(1),
  costPrice: z.number().default(0),
  retailPrice: z.number().default(0),
});

export const QuoteLineSchema = z.object({
  id: z.string(),
  sourceName: z.string().optional(),
  productId: z.string().optional().nullable(),
  productName: z.string().optional(),
  shapeMode: z.enum(['rect', 'triangle', 'trapezoid', 'arch', 'manual']).default('rect'),
  width: z.number().default(0),
  height: z.number().default(0),
  shapeTopWidth: z.number().default(0),
  shapeRise: z.number().default(0),
  pricingArea: z.number().default(0),
  pricingPerimeter: z.number().default(0),
  quantity: z.number().default(1),
  area: z.number().default(0),
  perimeter: z.number().default(0),
  costTotal: z.number().default(0),
  retailTotal: z.number().default(0),
  lineRateIds: z.array(z.string()).default([]),
  lineRateSummary: z.array(z.object({
    id: z.string().optional(),
    name: z.string(),
    percentage: z.number(),
  })).default([]),
  extraMaterials: z.array(QuoteExtraMaterialSchema).default([]),
  details: z.array(QuoteDetailSchema).default([]),
});

export const PricingQuoteSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string(),
  productId: z.string().optional().nullable(),
  productName: z.string().optional(),
  width: z.number().default(0),
  height: z.number().default(0),
  quantity: z.number().default(1),
  area: z.number().default(0),
  perimeter: z.number().default(0),
  costTotal: z.number().default(0),
  retailTotal: z.number().default(0),
  globalRateIds: z.array(z.string()).default([]),
  globalRateSummary: z.array(z.object({
    id: z.string().optional(),
    name: z.string(),
    percentage: z.number(),
  })).default([]),
  items: z.array(QuoteLineSchema).default([]),
  details: z.array(QuoteDetailSchema).default([]),
  createdAt: z.string().optional(),
});

export type MaterialCategory = z.infer<typeof MaterialCategorySchema>;
export type MaterialPricingMode = z.infer<typeof MaterialPricingModeSchema>;
export type MaterialItem = z.infer<typeof MaterialItemSchema>;
export type StandardItem = z.infer<typeof StandardSchema>;
export type PricingRate = z.infer<typeof PricingRateSchema>;
export type PricingProduct = z.infer<typeof PricingProductSchema>;
export type PricingQuote = z.infer<typeof PricingQuoteSchema>;

export const WindowResponseSchema = z.object({
  success: z.boolean(),
  data: z.union([z.array(WindowItemSchema), WindowItemSchema, z.null()]).optional(),
  error: z.string().optional(),
});

export const DrawingResponseSchema = z.object({
  success: z.boolean(),
  data: z.union([z.array(DrawingSchema), DrawingSchema, z.null()]).optional(),
  error: z.string().optional(),
});
