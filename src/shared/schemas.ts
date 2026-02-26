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
