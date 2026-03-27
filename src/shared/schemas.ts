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
  })).default([]),
});

export type MaterialCategory = z.infer<typeof MaterialCategorySchema>;
export type MaterialPricingMode = z.infer<typeof MaterialPricingModeSchema>;
export type MaterialItem = z.infer<typeof MaterialItemSchema>;
export type PricingProduct = z.infer<typeof PricingProductSchema>;
