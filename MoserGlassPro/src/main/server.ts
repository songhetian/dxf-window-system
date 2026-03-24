import fastify from 'fastify';
import cors from '@fastify/cors';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

const server = fastify({
  logger: true
});

server.register(cors, {
  origin: true
});

// --- Schema Definitions ---
const CategorySchema = {
  type: 'object',
  properties: {
    id: { type: 'integer' },
    name: { type: 'string' },
    type: { type: 'string' },
    parentId: { type: ['integer', 'null'] },
    isRepeatable: { type: 'boolean' },
    unitType: { type: 'string' },
    children: { type: 'array', items: { type: 'object', additionalProperties: true } }
  }
};

const ComponentSchema = {
  type: 'object',
  properties: {
    id: { type: 'integer' },
    categoryId: { type: 'integer' },
    name: { type: 'string' },
    agencyPrice: { type: 'number' },
    retailPrice: { type: 'number' },
    unitType: { type: ['string', 'null'] },
    category: CategorySchema
  }
};

const ExtraRateSchema = {
  type: 'object',
  properties: {
    id: { type: 'integer' },
    name: { type: 'string' },
    percentage: { type: 'number' },
    isActive: { type: 'boolean' }
  }
};

const ShapeSchema = {
  type: 'object',
  properties: {
    id: { type: 'integer' },
    name: { type: 'string' },
    formulaArea: { type: 'string' },
    formulaPerimeter: { type: 'string' },
    parameters: { type: 'string' },
    image: { type: ['string', 'null'] }
  }
};

const CombinationSchema = {
  type: 'object',
  properties: {
    id: { type: 'integer' },
    name: { type: 'string' },
    hash: { type: 'string' },
    agencyPrice: { type: 'number' },
    retailPrice: { type: 'number' },
    createdAt: { type: 'string', format: 'date-time' },
    components: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          componentId: { type: 'integer' },
          quantity: { type: 'number' },
          component: ComponentSchema
        }
      }
    }
  }
};

const CalculationRecordSchema = {
  type: 'object',
  properties: {
    id: { type: 'integer' },
    name: { type: ['string', 'null'] },
    combinationId: { type: ['integer', 'null'] },
    shapeName: { type: ['string', 'null'] },
    params: { type: 'string' },
    totalPrice: { type: 'number' },
    agencyTotalPrice: { type: 'number' },
    retailTotalPrice: { type: 'number' },
    details: { type: 'string' },
    createdAt: { type: 'string', format: 'date-time' },
    combination: CombinationSchema
  }
};

// --- Category API ---
server.get('/api/categories', {
  schema: {
    response: { 200: { type: 'array', items: CategorySchema } }
  }
}, async () => {
  return prisma.category.findMany({ include: { children: true } });
});

server.post('/api/categories', {
  schema: {
    body: {
      type: 'object',
      required: ['name', 'type', 'unitType'],
      properties: {
        name: { type: 'string' },
        type: { type: 'string' },
        parentId: { type: 'integer' },
        isRepeatable: { type: 'boolean' },
        unitType: { type: 'string' }
      }
    },
    response: { 201: CategorySchema }
  }
}, async (request: any, reply) => {
  const result = await prisma.category.create({ data: request.body });
  reply.code(201).send(result);
});

// --- Component API ---
server.get('/api/components', {
  schema: {
    response: { 200: { type: 'array', items: ComponentSchema } }
  }
}, async () => {
  return prisma.component.findMany({ include: { category: true } });
});

// --- Calculation Record API (持久化闭环) ---
server.get('/api/calculation-records', {
  schema: {
    response: { 200: { type: 'array', items: CalculationRecordSchema } }
  }
}, async () => {
  return prisma.calculationRecord.findMany({
    include: { combination: { include: { components: { include: { component: true } } } } },
    orderBy: { createdAt: 'desc' }
  });
});

server.post('/api/calculation-records', {
  schema: {
    body: {
      type: 'object',
      required: ['totalPrice', 'agencyTotalPrice', 'retailTotalPrice', 'params', 'details'],
      properties: {
        name: { type: 'string' },
        combinationId: { type: 'integer' },
        shapeName: { type: 'string' },
        params: { type: 'string' },
        totalPrice: { type: 'number' },
        agencyTotalPrice: { type: 'number' },
        retailTotalPrice: { type: 'number' },
        details: { type: 'string' }
      }
    },
    response: { 201: CalculationRecordSchema }
  }
}, async (request: any, reply) => {
  const result = await prisma.calculationRecord.create({
    data: request.body
  });
  reply.code(201).send(result);
});

server.delete('/api/calculation-records/:id', {
  schema: {
    params: { type: 'object', properties: { id: { type: 'integer' } } }
  }
}, async (request: any) => {
  const { id } = request.params;
  return prisma.calculationRecord.delete({ where: { id: parseInt(id) } });
});

// --- Combination API ---
server.get('/api/combinations', {
  schema: {
    response: { 200: { type: 'array', items: CombinationSchema } }
  }
}, async () => {
  return prisma.combination.findMany({
    include: { components: { include: { component: true } } }
  });
});

server.post('/api/combinations/find-or-create', {
  schema: {
    body: {
      type: 'object',
      required: ['components'],
      properties: {
        name: { type: 'string' },
        components: {
          type: 'array',
          items: {
            type: 'object',
            required: ['componentId', 'quantity'],
            properties: {
              componentId: { type: 'integer' },
              quantity: { type: 'number' }
            }
          }
        }
      }
    },
    response: {
      200: CombinationSchema,
      201: CombinationSchema
    }
  }
}, async (request: any, reply) => {
  const { components, name } = request.body; 
  const hashSource = components
    .sort((a: any, b: any) => a.componentId - b.componentId)
    .map((c: any) => `${c.componentId}:${c.quantity}`)
    .join('|');
  const hash = crypto.createHash('md5').update(hashSource).digest('hex');

  let combination = await prisma.combination.findUnique({
    where: { hash },
    include: { components: { include: { component: true } } }
  });

  if (combination) {
    return reply.code(200).send(combination);
  }

  let agencyPrice = 0;
  let retailPrice = 0;
  for (const item of components) {
    const comp = await prisma.component.findUnique({ where: { id: item.componentId } });
    if (comp) {
      agencyPrice += comp.agencyPrice * item.quantity;
      retailPrice += comp.retailPrice * item.quantity;
    }
  }

  const newCombination = await prisma.combination.create({
    data: {
      name: name || `自动组合-${hash.substring(0, 6)}`,
      hash,
      agencyPrice,
      retailPrice,
      components: {
        create: components.map((c: any) => ({
          componentId: c.componentId,
          quantity: c.quantity
        }))
      }
    },
    include: { components: { include: { component: true } } }
  });

  return reply.code(201).send(newCombination);
});

// --- Extra Rate / Shape API ---
server.get('/api/extra-rates', async () => prisma.extraRate.findMany());
server.get('/api/shapes', async () => prisma.shape.findMany());

export const startServer = async (port = 3000) => {
  try {
    // 启用 WAL 模式 (在启动函数内执行，避免导入阶段崩溃)
    await prisma.$executeRawUnsafe('PRAGMA journal_mode = WAL;');
    await server.listen({ port, host: '127.0.0.1' });
    console.log(`Server listening on http://127.0.0.1:${port}`);
  } catch (err) {
    server.log.error(err);
    throw err; // 抛出异常由主进程捕获
  }
};

export { prisma };
