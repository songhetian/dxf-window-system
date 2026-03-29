import Fastify from 'fastify';
import cors from '@fastify/cors';
import { serializerCompiler, validatorCompiler, ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

import {
  MaterialCategorySchema,
  MaterialPricingModeSchema,
  MaterialItemSchema,
  PricingRateSchema,
  StandardSchema,
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

  // --- API 路由定义 ---

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
    const nextIncludeInComboTotal = request.body.includeInComboTotal;
    await db.updateTable('material_pricing_modes').set(request.body).where('id', '=', request.params.id).execute();

    if (typeof nextIncludeInComboTotal === 'number') {
      await db
        .updateTable('pricing_product_items')
        .set({ includeInComboTotal: nextIncludeInComboTotal })
        .where('materialId', 'in',
          db.selectFrom('materials')
            .select('id')
            .where('unitType', '=', request.params.id),
        )
        .execute();
    }

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
            remarks: material?.remarks,
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

  // --- 费率 ---
  api.get('/api/pricing-rates', async () => {
    const rates = await db.selectFrom('pricing_rates').selectAll().orderBy('createdAt asc').execute();
    return { success: true, data: rates };
  });

  api.post('/api/pricing-rates', {
    schema: { body: PricingRateSchema.omit({ id: true, createdAt: true }) },
  }, async (request) => {
    const data = {
      id: uuidv4(),
      ...request.body,
      createdAt: new Date().toISOString(),
    };
    await db.insertInto('pricing_rates').values(data).execute();
    return { success: true, data };
  });

  api.patch('/api/pricing-rates/:id', {
    schema: {
      params: z.object({ id: z.string() }),
      body: PricingRateSchema.omit({ id: true, createdAt: true }).partial(),
    },
  }, async (request) => {
    await db.updateTable('pricing_rates').set(request.body).where('id', '=', request.params.id).execute();
    return { success: true };
  });

  api.delete('/api/pricing-rates/:id', async (request) => {
    const { id } = request.params as { id: string };
    await db.deleteFrom('pricing_rates').where('id', '=', id).execute();
    return { success: true };
  });

  // --- 识别标准 ---
  api.get('/api/standards', async () => {
    const standards = await db.selectFrom('standards').selectAll().orderBy('createdAt asc').execute();
    return { success: true, data: standards };
  });

  api.patch('/api/standards/:id', {
    schema: {
      params: z.object({ id: z.string() }),
      body: StandardSchema.omit({ id: true, createdAt: true }).partial(),
    },
  }, async (request) => {
    await db.updateTable('standards').set(request.body).where('id', '=', request.params.id).execute();
    return { success: true };
  });

  // --- 报价中心 ---
  api.get('/api/quotation-projects', async () => {
    const projects = await db.selectFrom('quotation_projects').selectAll().orderBy('updatedAt desc').execute();
    return { success: true, data: projects };
  });

  api.get('/api/quotation-projects/:id', async (request) => {
    const { id } = request.params as { id: string };
    const project = await db.selectFrom('quotation_projects').selectAll().where('id', '=', id).executeTakeFirst();
    if (!project) throw new Error('项目不存在');

    // 1. 获取直接添加的手动单项
    const items = await db.selectFrom('quotation_items')
      .selectAll()
      .where('projectId', '=', id)
      .orderBy('createdAt asc')
      .execute();

    const products = await db.selectFrom('pricing_products').selectAll().execute();
    const enrichedItems = items.map(item => {
      const product = products.find(p => p.id === item.productId);
      return {
        ...item,
        productName: product?.name,
        area: (item.width * item.height) / 1000000,
      };
    });

    // 2. 核心改进：获取关联的计算中心工作表 (drawing_records)
    const sheets = await db.selectFrom('drawing_records')
      .selectAll()
      .where('projectId', '=', id)
      .orderBy('createdAt desc')
      .execute();

    return { 
      success: true, 
      data: { 
        ...project, 
        items: enrichedItems,
        sheets: sheets // 将计算中心的工作表数据带回给报价中心
      } 
    };
  });

  api.post('/api/quotation-projects', async (request: any) => {
    const id = uuidv4();
    const now = new Date().toISOString();
    const data = {
      id,
      name: request.body.name || '未命名项目',
      buildingName: request.body.buildingName || '',
      remarks: request.body.remarks || '',
      rateSettings: JSON.stringify(request.body.rateSettings || []),
      isCompleted: Number(request.body.isCompleted || 0),
      createdAt: now,
      updatedAt: now,
    };
    await db.insertInto('quotation_projects').values(data).execute();
    return { success: true, data };
  });

  api.patch('/api/quotation-projects/:id', async (request: any) => {
    const { id } = request.params;
    await db.updateTable('quotation_projects')
      .set({ ...request.body, updatedAt: new Date().toISOString() })
      .where('id', '=', id)
      .execute();
    return { success: true };
  });

  api.delete('/api/quotation-projects/:id', async (request) => {
    const { id } = request.params as { id: string };
    await db.deleteFrom('quotation_projects').where('id', '=', id).execute();
    return { success: true };
  });

  api.post('/api/quotation-items', async (request: any) => {
    const id = uuidv4();
    const data = {
      id,
      ...request.body,
      createdAt: new Date().toISOString(),
    };
    await db.insertInto('quotation_items').values(data).execute();
    // 更新项目的 updatedAt
    await db.updateTable('quotation_projects')
      .set({ updatedAt: new Date().toISOString() })
      .where('id', '=', request.body.projectId)
      .execute();
    return { success: true, data };
  });

  api.patch('/api/quotation-items/:id', async (request: any) => {
    const { id } = request.params;
    await db.updateTable('quotation_items')
      .set(request.body)
      .where('id', '=', id)
      .execute();
    return { success: true };
  });

  api.delete('/api/quotation-items/:id', async (request) => {
    const { id } = request.params as { id: string };
    await db.deleteFrom('quotation_items').where('id', '=', id).execute();
    return { success: true };
  });

  // --- 计算中心历史记录 (Records) ---
  api.get('/api/drawing-records', async (request: any) => {
    const { projectId } = request.query;
    let query = db.selectFrom('drawing_records').selectAll();
    if (projectId) {
      query = query.where('projectId', '=', projectId);
    }
    const records = await query.orderBy('createdAt desc').execute();
    return { success: true, data: records };
  });

  api.get('/api/drawing-records/:id', async (request) => {
    const { id } = request.params as { id: string };
    const drawing = await db.selectFrom('drawing_records').selectAll().where('id', '=', id).executeTakeFirst();
    if (!drawing) throw new Error('工作表不存在');

    const items = await db.selectFrom('window_records')
      .selectAll()
      .where('drawingId', '=', id)
      .orderBy('createdAt asc')
      .execute();

    const products = await db.selectFrom('pricing_products').selectAll().execute();
    
    // 获取所有分配明细
    const itemIds = items.map(i => i.id);
    let allocations: any[] = [];
    if (itemIds.length > 0) {
      allocations = await db.selectFrom('window_allocations')
        .selectAll()
        .where('windowRecordId', 'in', itemIds)
        .execute();
    }

    const enrichedItems = items.map(item => {
      const product = products.find(p => p.id === item.productId);
      const calculatedArea = Number((item as any).calculatedArea || 0) || (item.width * item.height) / 1000000;
      return {
        ...item,
        productName: product?.name,
        area: calculatedArea,
        compDetails: JSON.parse((item as any).componentDetails || '[]'),
        accDetails: JSON.parse((item as any).accessoryDetails || '[]'),
        allocations: allocations.filter(a => a.windowRecordId === item.id)
      };
    });

    return { success: true, data: { ...drawing, items: enrichedItems, allocationLabels: JSON.parse(drawing.allocationLabels || '[]') } };
  });

  api.post('/api/drawing-records', async (request: any, reply) => {
    try {
      const id = uuidv4();
      const now = new Date().toISOString();
      const { items, ...drawingData } = request.body;
      
      await db.insertInto('drawing_records').values({
        id,
        projectId: drawingData.projectId || null,
        sheetName: drawingData.sheetName || '新工作表',
        fileName: drawingData.fileName || '',
        allocationLabels: JSON.stringify(drawingData.allocationLabels || []),
        rateSettings: JSON.stringify(drawingData.rateSettings || []),
        totalArea: Number(drawingData.totalArea || 0),
        totalCost: Number(drawingData.totalCost || 0),
        totalRetail: Number(drawingData.totalRetail || 0),
        itemCount: items?.length || 0,
        createdAt: now,
        updatedAt: now,
      }).execute();

      if (items && items.length > 0) {
        for (const item of items) {
          const windowRecordId = uuidv4();
          await db.insertInto('window_records').values({
            id: windowRecordId,
            drawingId: id,
            windowType: String(item.windowType || ''),
            designNumber: String(item.designNumber || '未命名'),
            width: Number(item.width || 0),
            height: Number(item.height || 0),
            calculatedArea: Number(item.area || 0),
            quantity: Number(item.quantity || 1),
            productId: (item.productId && item.productId !== '') ? item.productId : null, // 强制空ID转为null
            unitPrice: Number(item.unitPrice || 0),
            totalPrice: Number(item.totalPrice || 0),
            unitRetailPrice: Number(item.unitRetailPrice || 0),
            totalRetailPrice: Number(item.totalRetailPrice || 0),
            componentDetails: JSON.stringify(item.compDetails || []),
            accessoryDetails: JSON.stringify(item.accDetails || []),
            createdAt: now,
          }).execute();

          if (item.allocations && Array.isArray(item.allocations)) {
            for (const a of item.allocations) {
              if (a.label) {
                await db.insertInto('window_allocations').values({
                  id: uuidv4(),
                  windowRecordId,
                  label: String(a.label),
                  quantity: Number(a.quantity || 0),
                }).execute();
              }
            }
          }
        }
      }

      if (drawingData.projectId) {
        await db.updateTable('quotation_projects')
          .set({ updatedAt: now })
          .where('id', '=', drawingData.projectId)
          .execute();
      }

      return { success: true, data: { id } };
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send({ success: false, error: err.message || '内部服务器错误' });
    }
  });

  api.delete('/api/drawing-records/:id', async (request) => {
    const { id } = request.params as { id: string };
    await db.deleteFrom('drawing_records').where('id', '=', id).execute();
    return { success: true };
  });

  api.patch('/api/drawing-records/:id', async (request: any) => {
    const { id } = request.params;
    const payload = { ...request.body };
    if (payload.rateSettings && !Array.isArray(payload.rateSettings) && typeof payload.rateSettings !== 'string') {
      payload.rateSettings = [];
    }
    if (Array.isArray(payload.rateSettings)) {
      payload.rateSettings = JSON.stringify(payload.rateSettings);
    }
    await db.updateTable('drawing_records')
      .set({ ...payload, updatedAt: new Date().toISOString() })
      .where('id', '=', id)
      .execute();
    return { success: true };
  });

  try {
    await fastify.listen({ port, host: '0.0.0.0' });
  } catch (error) {
    fastify.log.error(error);
    process.exit(1);
  }
};
