import Fastify from 'fastify';
import cors from '@fastify/cors';
import { serializerCompiler, validatorCompiler, ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

import {
  MaterialCategorySchema,
  MaterialPricingModeSchema,
  MaterialItemSchema,
} from '../../shared/schemas';
import { initDb } from '../database/db';

const fastify = Fastify({ logger: true });

// 显式配置跨域允许的方法
fastify.register(cors, { 
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
});
fastify.setValidatorCompiler(validatorCompiler);
fastify.setSerializerCompiler(serializerCompiler);

const db = initDb('./dxf-app.db');

export const startServer = async (port: number = 3001) => {
  const api = fastify.withTypeProvider<ZodTypeProvider>();

  // --- 材料分类 ---
  api.get('/api/material-categories', async () => {
    const categories = await db.selectFrom('material_categories').selectAll().orderBy('sortOrder asc').orderBy('createdAt asc').execute();
    return { success: true, data: categories };
  });

  api.post('/api/material-categories', {
    schema: { body: MaterialCategorySchema.omit({ id: true, createdAt: true }) },
  }, async (request) => {
    const data = { ...request.body, id: uuidv4(), createdAt: new Date().toISOString() };
    await db.insertInto('material_categories').values(data).execute();
    return { success: true, data };
  });

  api.patch('/api/material-categories/:id', {
    schema: {
      params: z.object({ id: z.string() }),
      body: MaterialCategorySchema.omit({ id: true, createdAt: true }).partial(),
    },
  }, async (request) => {
    await db.updateTable('material_categories').set(request.body).where('id', '=', request.params.id).execute();
    return { success: true };
  });

  api.delete('/api/material-categories/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const materialCountResult = await db
      .selectFrom('materials')
      .select(({ fn }) => fn.count<string>('id').as('count'))
      .where('categoryId', '=', id)
      .executeTakeFirst();

    const materialCount = Number(materialCountResult?.count || 0);
    if (materialCount > 0) {
      reply.status(409).send({
        success: false,
        error: `此分类下仍有 ${materialCount} 项材料，请先处理后再删除。`,
      });
      return;
    }

    await db.deleteFrom('material_categories').where('id', '=', id).execute();
    return { success: true };
  });

  // --- 计价方式 ---
  api.get('/api/material-pricing-modes', async () => {
    const modes = await db.selectFrom('material_pricing_modes').selectAll().orderBy('sortOrder asc').orderBy('createdAt asc').execute();
    return { success: true, data: modes };
  });

  api.post('/api/material-pricing-modes', {
    schema: { body: MaterialPricingModeSchema.omit({ id: true, createdAt: true }) },
  }, async (request) => {
    const data = { ...request.body, id: uuidv4(), createdAt: new Date().toISOString() };
    await db.insertInto('material_pricing_modes').values(data).execute();
    return { success: true, data };
  });

  api.patch('/api/material-pricing-modes/:id', {
    schema: {
      params: z.object({ id: z.string() }),
      body: MaterialPricingModeSchema.omit({ id: true, createdAt: true }).partial(),
    },
  }, async (request) => {
    await db.updateTable('material_pricing_modes').set(request.body).where('id', '=', request.params.id).execute();
    return { success: true };
  });

  api.delete('/api/material-pricing-modes/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    if (['area', 'perimeter', 'fixed'].includes(id)) {
      reply.status(403).send({ success: false, error: '系统默认计价方式不可删除。' });
      return;
    }
    const materialCountResult = await db
      .selectFrom('materials')
      .select(({ fn }) => fn.count<string>('id').as('count'))
      .where('unitType', '=', id)
      .executeTakeFirst();

    const materialCount = Number(materialCountResult?.count || 0);
    if (materialCount > 0) {
      reply.status(409).send({
        success: false,
        error: `此计价方式仍被 ${materialCount} 项材料使用，请先处理。`,
      });
      return;
    }
    await db.deleteFrom('material_pricing_modes').where('id', '=', id).execute();
    return { success: true };
  });

  // --- 材料库 ---
  api.get('/api/materials', async () => {
    const materials = await db.selectFrom('materials').selectAll().orderBy('createdAt desc').execute();
    return { success: true, data: materials };
  });

  api.post('/api/materials', {
    schema: { body: MaterialItemSchema.omit({ id: true, createdAt: true }) },
  }, async (request) => {
    const now = new Date().toISOString();
    const data = { ...request.body, id: uuidv4(), createdAt: now, updatedAt: now };
    await db.insertInto('materials').values(data).execute();
    return { success: true, data };
  });

  api.patch('/api/materials/:id', {
    schema: {
      params: z.object({ id: z.string() }),
      body: MaterialItemSchema.omit({ id: true, createdAt: true }).partial(),
    },
  }, async (request) => {
    await db.updateTable('materials').set({ ...request.body, updatedAt: new Date().toISOString() }).where('id', '=', request.params.id).execute();
    return { success: true };
  });

  api.delete('/api/materials/:id', async (request) => {
    const { id } = request.params as { id: string };
    await db.deleteFrom('materials').where('id', '=', id).execute();
    return { success: true };
  });

  // --- 产品组合 ---
  api.get('/api/pricing-products', async () => {
    const products = await db.selectFrom('pricing_products').selectAll().orderBy('createdAt desc').execute();
    const items = await db.selectFrom('pricing_product_items').selectAll().execute();
    const materials = await db.selectFrom('materials').selectAll().execute();

    const data = products.map((product) => ({
      ...product,
      items: items
        .filter((item) => item.productId === product.id)
        .sort((a: any, b: any) => (a.sortOrder || 0) - (b.sortOrder || 0))
        .map((item) => {
          const material = materials.find((entry) => entry.id === item.materialId);
          return {
            ...item,
            materialName: material?.name,
            unitLabel: material?.unitLabel,
            costPrice: material?.costPrice ?? 0,
            retailPrice: material?.retailPrice ?? 0,
          };
        }),
    }));
    return { success: true, data };
  });

  api.post('/api/pricing-products', {
    schema: {
      body: z.object({
        name: z.string(),
        pricingMode: z.enum(['area', 'perimeter', 'fixed']),
        items: z.array(z.object({
          materialId: z.string(),
          calcMode: z.enum(['area', 'perimeter', 'fixed']).default('area'),
          quantity: z.number(),
          includeInComboTotal: z.number().optional(),
          sortOrder: z.number().optional(),
        })),
      }),
    },
  }, async (request, reply) => {
    const existingProduct = await db.selectFrom('pricing_products').select(['id']).where('name', '=', request.body.name.trim()).executeTakeFirst();
    if (existingProduct) {
      return reply.status(409).send({ success: false, error: '组合名称已存在，请修改后再保存。' });
    }
    const productId = uuidv4();
    const createdAt = new Date().toISOString();
    await db.insertInto('pricing_products').values({
      id: productId,
      name: request.body.name.trim(),
      pricingMode: request.body.pricingMode,
      createdAt,
      updatedAt: createdAt,
    }).execute();

    if (request.body.items.length > 0) {
      await db.insertInto('pricing_product_items').values(
        request.body.items.map((item) => ({
          id: uuidv4(),
          productId,
          materialId: item.materialId,
          calcMode: item.calcMode,
          quantity: item.quantity,
          includeInComboTotal: item.includeInComboTotal ?? 0,
          sortOrder: item.sortOrder || 0,
        })),
      ).execute();
    }
    return { success: true, data: { id: productId } };
  });

  api.put('/api/pricing-products/:id', {
    schema: {
      params: z.object({ id: z.string() }),
      body: z.object({
        name: z.string(),
        pricingMode: z.enum(['area', 'perimeter', 'fixed']),
        items: z.array(z.object({
          materialId: z.string(),
          calcMode: z.enum(['area', 'perimeter', 'fixed']).default('area'),
          quantity: z.number(),
          includeInComboTotal: z.number().optional(),
          sortOrder: z.number().optional(),
        })),
      }),
    },
  }, async (request, reply) => {
    const { id } = request.params;
    const nextName = request.body.name.trim();
    const existingProduct = await db.selectFrom('pricing_products').select(['id']).where('name', '=', nextName).where('id', '!=', id).executeTakeFirst();
    if (existingProduct) {
      return reply.status(409).send({ success: false, error: '组合名称已存在，请修改后再保存。' });
    }
    await db.updateTable('pricing_products').set({
      name: nextName,
      pricingMode: request.body.pricingMode,
      updatedAt: new Date().toISOString(),
    }).where('id', '=', id).execute();

    await db.deleteFrom('pricing_product_items').where('productId', '=', id).execute();
    if (request.body.items.length > 0) {
      await db.insertInto('pricing_product_items').values(
        request.body.items.map((item) => ({
          id: uuidv4(),
          productId: id,
          materialId: item.materialId,
          calcMode: item.calcMode,
          quantity: item.quantity,
          includeInComboTotal: item.includeInComboTotal ?? 0,
          sortOrder: item.sortOrder || 0,
        })),
      ).execute();
    }
    return { success: true };
  });

  api.delete('/api/pricing-products/:id', async (request) => {
    const { id } = request.params as { id: string };
    await db.deleteFrom('pricing_products').where('id', '=', id).execute();
    return { success: true };
  });

  try {
    await fastify.listen({ port, host: '0.0.0.0' });
  } catch (error) {
    fastify.log.error(error);
    process.exit(1);
  }
};
