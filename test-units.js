const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const products = await prisma.product.findMany({
    where: {
      name: { in: ['SAND', '1/2 inchi'] }
    },
    include: {
      unitConversions: true
    }
  });

  for (const p of products) {
    console.log(`Product: ${p.name}, BaseUnit: ${p.unit}, CostPrice: ${p.costPrice}`);
    for (const uc of p.unitConversions) {
      console.log(`  - Conversion: ${uc.unitName} = ${uc.cftValue} CFT`);
    }
  }

  const sales = await prisma.saleItem.findMany({
    where: {
      product: { name: { in: ['SAND', '1/2 inchi'] } }
    },
    take: 5,
    orderBy: { createdAt: 'desc' }
  });

  console.log('\nRecent Sales:');
  for (const s of sales) {
    console.log(`- Qty: ${s.quantity}, unitName: ${s.unitName}, conversionCft: ${s.conversionCft}, unit: ${s.unit}, unitPrice: ${s.unitPrice}, totalPrice: ${s.totalPrice}`);
  }
}

check().catch(console.error).finally(() => prisma.$disconnect());
