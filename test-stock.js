const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const stock = await prisma.stockEntry.findMany({
    where: { product: { name: 'SAND' } },
    orderBy: { createdAt: 'desc' }
  });
  console.log(stock);
  const p = await prisma.product.findFirst({ where: { name: 'SAND' } });
  console.log(p);
}
check().finally(() => prisma.$disconnect());
