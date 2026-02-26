import Fastify from 'fastify';
import cors from '@fastify/cors';
import { serializerCompiler, validatorCompiler, ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { WindowItemSchema, WindowResponseSchema, DrawingSchema, DrawingResponseSchema } from '../../shared/schemas';
import { initDb } from '../database/db';
import { v4 as uuidv4 } from 'uuid';

const fastify = Fastify({
  logger: true,
});

fastify.register(cors, { origin: '*' });

fastify.setValidatorCompiler(validatorCompiler);
fastify.setSerializerCompiler(serializerCompiler);

const db = initDb('./dxf-app.db');

export const startServer = async (port: number = 3001) => {
  const api = fastify.withTypeProvider<ZodTypeProvider>();

  // --- Drawing Routes ---
  
  // 获取所有图纸记录
  api.get('/api/drawings', {
    schema: { response: { 200: DrawingResponseSchema } },
  }, async () => {
    const drawings = await db.selectFrom('drawings').selectAll().orderBy('createdAt desc').execute();
    return { success: true, data: drawings };
  });

  // 保存图纸及其窗户明细
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

    const totalArea = windows.reduce((sum, w) => sum + w.area, 0);

    // 插入图纸
    const drawing = {
      id: drawingId,
      title,
      fileName,
      windowCount: windows.length,
      totalArea,
      createdAt,
    };
    await db.insertInto('drawings').values(drawing).execute();

    // 插入窗户
    if (windows.length > 0) {
      const windowEntries = windows.map(win => ({
        ...win,
        id: uuidv4(),
        drawingId,
        points: JSON.stringify(win.points),
        createdAt,
      }));
      await db.insertInto('windows').values(windowEntries as any).execute();
    }

    reply.status(201).send({ success: true, data: drawing });
  });

  // 获取特定图纸的所有窗户
  api.get('/api/drawings/:id/windows', {
    schema: {
      params: z.object({ id: z.string().uuid() }),
      response: { 200: WindowResponseSchema },
    },
  }, async (request) => {
    const { id } = request.params;
    const windows = await db.selectFrom('windows')
      .where('drawingId', '=', id)
      .selectAll()
      .execute();
    return {
      success: true,
      data: windows.map(w => ({ ...w, points: JSON.parse(w.points as any) })),
    };
  });

  // 删除图纸 (级联删除窗户)
  api.delete('/api/drawings/:id', {
    schema: {
      params: z.object({ id: z.string().uuid() }),
    },
  }, async (request) => {
    const { id } = request.params;
    await db.deleteFrom('drawings').where('id', '=', id).execute();
    return { success: true };
  });

  // --- Legacy Window Routes (Optional/Fallback) ---

  api.get('/api/windows', async () => {
    const windows = await db.selectFrom('windows').selectAll().execute();
    return {
      success: true,
      data: windows.map(w => ({ ...w, points: JSON.parse(w.points as any) })),
    };
  });

  // --- Standard Routes ---

  api.get('/api/standards', async () => {
    const stds = await db.selectFrom('standards').selectAll().orderBy('createdAt desc').execute();
    return { success: true, data: stds };
  });

  api.post('/api/standards', {
    schema: {
      body: z.object({
        name: z.string(),
        windowPattern: z.string(),
        doorPattern: z.string(),
        wallAreaThreshold: z.number(),
      }),
    }
  }, async (request) => {
    const id = uuidv4();
    const data = { ...request.body, id, isDefault: 0, createdAt: new Date().toISOString() };
    await db.insertInto('standards').values(data).execute();
    return { success: true, data };
  });

  api.delete('/api/standards/:id', async (request) => {
    const { id } = (request.params as any);
    await db.deleteFrom('standards').where('id', '=', id).execute();
    return { success: true };
  });

  api.patch('/api/standards/:id', {
    schema: {
      params: z.object({ id: z.string() }),
      body: z.object({
        name: z.string().optional(),
        windowPattern: z.string().optional(),
        doorPattern: z.string().optional(),
        wallAreaThreshold: z.number().optional(),
      }),
    }
  }, async (request) => {
    const { id } = request.params;
    await db.updateTable('standards')
      .set(request.body)
      .where('id', '=', id)
      .execute();
    return { success: true };
  });

  try {
    await fastify.listen({ port, host: '0.0.0.0' });
    console.log(`Fastify server listening on http://localhost:${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};
