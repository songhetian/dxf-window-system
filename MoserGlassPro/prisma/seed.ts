import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // 1. Categories
  const catGlass = await prisma.category.create({
    data: { name: '玻璃材质', type: 'BASIC', unitType: 'SQM', isRepeatable: false }
  });

  const catProcess = await prisma.category.create({
    data: { name: '玻璃工艺', type: 'BASIC', unitType: 'SQM', isRepeatable: true }
  });

  const catHardware = await prisma.category.create({
    data: { name: '五金配件', type: 'ACCESSORY', unitType: 'PIECE', isRepeatable: true }
  });

  const catGlue = await prisma.category.create({
    data: { name: '密封辅材', type: 'ACCESSORY', unitType: 'LINEAR', isRepeatable: true }
  });

  // 2. Components
  await prisma.component.createMany({
    data: [
      { categoryId: catGlass.id, name: '5mm 透明白玻', agencyPrice: 45, retailPrice: 80 },
      { categoryId: catGlass.id, name: '6mm 钢化玻璃', agencyPrice: 60, retailPrice: 110 },
      { categoryId: catProcess.id, name: '超白处理', agencyPrice: 15, retailPrice: 30 },
      { categoryId: catHardware.id, name: '进口内开五金', agencyPrice: 180, retailPrice: 350 },
      { categoryId: catGlue.id, name: '三元乙丙胶条', agencyPrice: 5, retailPrice: 12 },
    ]
  });

  // 3. Extra Rates
  await prisma.extraRate.createMany({
    data: [
      { name: '管理费', percentage: 5 },
      { name: '安装费', percentage: 10 },
      { name: '运输费', percentage: 3 },
    ]
  });

  console.log('Seed data created successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
