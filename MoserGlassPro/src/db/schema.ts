import { z } from 'zod';

export const CategoryTypeEnum = z.enum(['MATERIAL', 'ACCESSORY']);

export const SpecSchema = z.object({
  id: z.number(),
  name: z.string(),
  category: CategoryTypeEnum
});

export const OptionSchema = z.object({
  id: z.number(),
  name: z.string(),
  category: CategoryTypeEnum
});

export const MatrixItemSchema = z.object({
  subLibId: z.number(),
  specId: z.number(),
  specName: z.string(),
  category: CategoryTypeEnum,
  optionId: z.number(),
  optionName: z.string(),
  agencyPrice: z.number().default(0),
  guidePrice: z.number().default(0),
  lossRate: z.number().default(1.0),
  priceId: z.number().nullable()
});

export type Spec = z.infer<typeof SpecSchema>;
export type LibraryOption = z.infer<typeof OptionSchema>;
export type MatrixItem = z.infer<typeof MatrixItemSchema>;

export const FeeDefinitionSchema = z.object({
  id: z.number(),
  name: z.string(),
  default_rate: z.number(),
  is_optional: z.number()
});

export type FeeDefinition = z.infer<typeof FeeDefinitionSchema>;
