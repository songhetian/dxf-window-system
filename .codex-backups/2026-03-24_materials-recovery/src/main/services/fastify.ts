import Fastify from 'fastify';
import cors from '@fastify/cors';
import { serializerCompiler, validatorCompiler, ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

import {
  WindowItemSchema,
  WindowResponseSchema,
  DrawingResponseSchema,
  StandardSchema,
  MaterialCategorySchema,
  MaterialPricingModeSchema,
  MaterialItemSchema,
  PricingProductSchema,
  PricingRateSchema,
  PricingQuoteSchema,
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

const quoteBodySchema = z.object({
  name: z.string(),
  productId: z.string().nullable().optional(),
  productName: z.string().optional(),
  width: z.number(),
  height: z.number(),
  quantity: z.number(),
  area: z.number(),
  perimeter: z.number(),
  costTotal: z.number(),
  retailTotal: z.number(),
  details: z.array(z.object({
    materialId: z.string().optional(),
    name: z.string(),
    quantity: z.number(),
    unit: z.string(),
    costPrice: z.number(),
    retailPrice: z.number(),
    costSubtotal: z.number(),
    retailSubtotal: z.number(),
  })),
});

export const startServer = async (port: number = 3001) => {
  const api = fastify.withTypeProvider<ZodTypeProvider>();

  api.get('/api/drawings', {
    schema: { response: { 200: DrawingResponseSchema } },
  }, async () => {
    const drawings = await db.selectFrom('drawings').selectAll().orderBy('createdAt desc').execute();
    return { success: true, data: drawings };
  });

  api.post('/api/drawings', {
    schema: {
      body: z.object({
        title: z.string(),
        fileName: z.string(),
        windows: z.array(WindowItemSchema.omit({ id: true, drawingId: true, createdAt: true })),
      }),
      response: { 201: DrawingResponseSchema },
    },
  }, async (request, reply) => {
    const { title, fileName, windows } = request.body;
    const drawingId = uuidv4();
    const createdAt = new Date().toISOString();
    const totalArea = windows.reduce((sum, item) => sum + item.area, 0);

    const drawing = {
      id: drawingId,
      title,
      fileName,
      windowCount: windows.length,
      totalArea,
      createdAt,
    };

    await db.insertInto('drawings').values(drawing).execute();

    if (windows.length > 0) {
      await db.insertInto('windows').values(
        windows.map((item) => ({
          ...item,
          id: uuidv4(),
          drawingId,
          points: JSON.stringify(item.points),
          createdAt,
        })) as any,
      ).execute();
    }

    reply.status(201).send({ success: true, data: drawing });
  });

  api.get('/api/drawings/:id/windows', {
    schema: {
      params: z.object({ id: z.string().uuid() }),
      response: { 200: WindowResponseSchema },
    },
  }, async (request) => {
    const windows = await db.selectFrom('windows').where('drawingId', '=', request.params.id).selectAll().execute();
    return {
      success: true,
      data: windows.map((item) => ({ ...item, points: JSON.parse(item.points as any) })),
    };
  });

  api.delete('/api/drawings/:id', {
    schema: { params: z.object({ id: z.string().uuid() }) },
  }, async (request) => {
    await db.deleteFrom('drawings').where('id', '=', request.params.id).execute();
    return { success: true };
  });

  api.get('/api/standards', async () => {
    const standards = await db.selectFrom('standards').selectAll().orderBy('createdAt desc').execute();
    return { success: true, data: standards };
  });

  api.post('/api/standards', {
    schema: {
      body: StandardSchema.omit({ id: true, createdAt: true, isDefault: true }),
    },
  }, async (request) => {
    const data = { ...request.body, id: uuidv4(), isDefault: 0, createdAt: new Date().toISOString() };
    await db.insertInto('standards').values(data).execute();
    return { success: true, data };
  });

  api.patch('/api/standards/:id', {
    schema: {
      params: z.object({ id: z.string() }),
      body: StandardSchema.omit({ id: true, createdAt: true, isDefault: true }).partial(),
    },
  }, async (request) => {
    await db.updateTable('standards').set(request.body).where('id', '=', request.params.id).execute();
    return { success: true };
  });

  api.delete('/api/standards/:id', async (request) => {
    const { id } = request.params as { id: string };
    await db.deleteFrom('standards').where('id', '=', id).execute();
    return { success: true };
  });

  api.get('/api/material-categories', async () => {
    const categories = await db.selectFrom('material_categories').selectAll().orderBy('sortOrder asc').orderBy('createdAt asc').execute();
    return { success: true, data: categories };
  });

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
      reply.status(403).send({
        success: false,
        error: '系统默认计价方式不可删除。',
      });
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

  api.get('/api/pricing-rates', async () => {
    const rates = await db.selectFrom('pricing_rates').selectAll().orderBy('createdAt desc').execute();
    return { success: true, data: rates };
  });

  api.post('/api/pricing-rates', {
    schema: { body: PricingRateSchema.omit({ id: true, createdAt: true }) },
  }, async (request) => {
    const data = { ...request.body, id: uuidv4(), createdAt: new Date().toISOString() };
    await db.insertInto('pricing_rates').values(data).execute();
    return { success: true, data };
  });

  api.delete('/api/pricing-rates/:id', async (request) => {
    const { id } = request.params as { id: string };
    await db.deleteFrom('pricing_rates').where('id', '=', id).execute();
    return { success: true };
  });

  api.get('/api/pricing-products', async () => {
    const products = await db.selectFrom('pricing_products').selectAll().orderBy('createdAt desc').execute();
    const items = await db.selectFrom('pricing_product_items').selectAll().execute();
    const materials = await db.selectFrom('materials').selectAll().execute();

    const data = products.map((product) => ({
      ...product,
      items: items
        .filter((item) => item.productId === product.id)
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
          quantity: z.number(),
        })),
      }),
    },
  }, async (request) => {
    const productId = uuidv4();
    const createdAt = new Date().toISOString();
    await db.insertInto('pricing_products').values({
      id: productId,
      name: request.body.name,
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
          quantity: item.quantity,
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
          quantity: z.number(),
        })),
      }),
    },
  }, async (request) => {
    const { id } = request.params;
    await db.updateTable('pricing_products').set({
      name: request.body.name,
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
          quantity: item.quantity,
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

  api.get('/api/pricing-quotes', async () => {
    const quotes = await db.selectFrom('pricing_quotes').selectAll().orderBy('createdAt desc').execute();
    return {
      success: true,
      data: quotes.map((item) => ({ ...item, details: JSON.parse(item.details) })),
    };
  });

  api.post('/api/pricing-quotes', {
    schema: {
      body: quoteBodySchema,
      response: { 201: PricingQuoteSchema },
    },
  }, async (request, reply) => {
    const data = {
      ...request.body,
      id: uuidv4(),
      details: JSON.stringify(request.body.details),
      createdAt: new Date().toISOString(),
    };
    await db.insertInto('pricing_quotes').values(data).execute();
    reply.status(201).send({ ...data, details: request.body.details } as any);
  });

  api.delete('/api/pricing-quotes/:id', async (request) => {
    const { id } = request.params as { id: string };
    await db.deleteFrom('pricing_quotes').where('id', '=', id).execute();
    return { success: true };
  });

  try {
    await fastify.listen({ port, host: '0.0.0.0' });
  } catch (error) {
    fastify.log.error(error);
    process.exit(1);
  }
};
