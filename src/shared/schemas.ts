import { z } from 'zod';

export const UnitSchema = z.enum(['mm', 'm']);
export type Unit = z.infer<typeof UnitSchema>;

export const WindowItemSchema = z.z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, '名称不能为空'),
  category: z.string().default('默认'),
  shapeType: z.string(), // e.g., 'Rectangle', 'Polygon', 'Irregular'
  width: z.number().positive(),
  height: z.number().positive(),
  area: z.number().positive(),
  perimeter: z.number().positive(),
  points: z.array(z.object({ x: z.number(), y: z.number() })), // 鞋带算法所需的顶点坐标
  createdAt: z.string().optional(),
});

export type WindowItem = z.infer<typeof WindowItemSchema>;

export const CreateWindowSchema = WindowItemSchema.omit({ id: true, createdAt: true });
export const UpdateWindowSchema = WindowItemSchema.partial().omit({ id: true, createdAt: true });

// Fastify 验证用的 Response Schemas
export const WindowResponseSchema = z.object({
  success: z.boolean(),
  data: z.union([WindowItemSchema, z.array(WindowItemSchema)]).optional(),
  error: z.string().optional(),
});
