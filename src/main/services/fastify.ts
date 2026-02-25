import Fastify from 'fastify';
import cors from '@fastify/cors';
import { serializerCompiler, validatorCompiler, ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { WindowItemSchema, WindowResponseSchema } from '../../shared/schemas';
import { initDb } from '../database/db';
import { v4 as uuidv4 } from 'uuid';

const fastify = Fastify({
  logger: true,
  ajv: {
    customOptions: {
      removeAdditional: 'all',
      coerceTypes: true,
      useDefaults: true,
    },
  },
});

// 启用 CORS
fastify.register(cors, {
  origin: '*', // 工业开发环境下允许所有来源，生产环境建议更严格
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
});

// 启用 Zod 类型提供者
fastify.setValidatorCompiler(validatorCompiler);
fastify.setSerializerCompiler(serializerCompiler);

// 初始化数据库
const db = initDb('./dxf-app.db');

export const startServer = async (port: number = 3001) => {
  // 注册 API 路由
  const api = fastify.withTypeProvider<ZodTypeProvider>();

  // 获取所有窗户
  api.get('/api/windows', {
    schema: {
      response: {
        200: WindowResponseSchema,
      },
    },
  }, async () => {
    const windows = await db.selectFrom('windows').selectAll().execute();
    return {
      success: true,
      data: windows.map(w => ({ ...w, points: JSON.parse(w.points as any) })),
    };
  });

  // 保存窗户
  api.post('/api/windows', {
    schema: {
      body: WindowItemSchema.omit({ id: true, createdAt: true }),
      response: {
        201: WindowResponseSchema,
      },
    },
  }, async (request, reply) => {
    const newWindow = {
      ...request.body,
      id: uuidv4(),
      points: JSON.stringify(request.body.points),
      createdAt: new Date().toISOString(),
    };
    
    await db.insertInto('windows').values(newWindow as any).execute();
    
    reply.status(201).send({
      success: true,
      data: { ...newWindow, points: request.body.points },
    });
  });

  // 批量保存窗户 (性能优化：先清空再插入)
  api.post('/api/windows/batch', {
    schema: {
      body: z.array(WindowItemSchema.omit({ id: true, createdAt: true })),
      response: {
        201: WindowResponseSchema,
      },
    },
  }, async (request, reply) => {
    // 工业级处理：导入新文件时清空旧数据
    await db.deleteFrom('windows').execute();
    
    const windows = request.body.map(win => ({
      ...win,
      id: uuidv4(),
      points: JSON.stringify(win.points),
      createdAt: new Date().toISOString(),
    }));
    
    if (windows.length > 0) {
      await db.insertInto('windows').values(windows as any).execute();
    }
    
    reply.status(201).send({
      success: true,
      data: windows.map(w => ({ ...w, points: JSON.parse(w.points as any) })),
    });
  });

  // 清空所有数据
  api.delete('/api/windows/all', {}, async () => {
    await db.deleteFrom('windows').execute();
    return { success: true };
  });

  // 修改窗户信息
  api.patch('/api/windows/:id', {
    schema: {
      params: z.object({ id: z.string().uuid() }),
      body: WindowItemSchema.partial().omit({ id: true, createdAt: true }),
      response: {
        200: WindowResponseSchema,
      },
    },
  }, async (request) => {
    const { id } = request.params;
    const updateData = { ...request.body };
    if (updateData.points) {
      (updateData as any).points = JSON.stringify(updateData.points);
    }
    
    await db.updateTable('windows')
      .set(updateData as any)
      .where('id', '=', id)
      .execute();
      
    return { success: true };
  });

  // 删除窗户
  api.delete('/api/windows/:id', {
    schema: {
      params: z.object({ id: z.string().uuid() }),
      response: {
        200: WindowResponseSchema,
      },
    },
  }, async (request) => {
    const { id } = request.params;
    await db.deleteFrom('windows').where('id', '=', id).execute();
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
