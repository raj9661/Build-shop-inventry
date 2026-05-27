const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const p13 = await prisma.product.findUnique({
    where: { id: BigInt(13) },
    include: { stockEntries: true }
  });
  const p27 = await prisma.product.findUnique({
    where: { id: BigInt(27) },
    include: { stockEntries: true }
  });

  console.log('PRODUCT 13:', JSON.stringify(p13, (k, v) => typeof v === 'bigint' ? v.toString() : v, 2));
  console.log('PRODUCT 27:', JSON.stringify(p27, (k, v) => typeof v === 'bigint' ? v.toString() : v, 2));
}

check().catch(console.error).finally(() => prisma.$disconnect());







