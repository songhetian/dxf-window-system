import Fastify from 'fastify';
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
