const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const p = await prisma.productUnitConversion.findMany({
    where: { product: { name: { in: ['SAND', '1/2 inchi'] } } }
  });
  console.log(p);
}
check().finally(() => prisma.$disconnect());
