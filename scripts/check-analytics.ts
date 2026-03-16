import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  const rows = await prisma.inventoryAnalytics.findMany({
    include: { product: { select: { name: true, costPrice: true, stockEntries: { select: { conversionCft: true }, where: { conversionCft: { not: null } }, orderBy: { createdAt: 'desc' }, take: 1 } } } }
  });
  rows.forEach(r => {
    const conv = r.product.stockEntries?.[0]?.conversionCft;
    console.log('Product:', r.product.name);
    console.log('  costPrice (per Highwa/bulk unit):', r.product.costPrice.toString());
    console.log('  conversionCft:', conv ? conv.toString() : 'N/A (not a bulk item)');
    console.log('  normalizedUnitCost:', conv ? (Number(r.product.costPrice) / Number(conv)).toFixed(2) + ' per CFT' : 'same as costPrice');
    console.log('  avgStock:', r.avgStock.toString());
    console.log('  COGS (correctly calculated):', r.cogs.toString());
    console.log('  Turnover:', r.turnoverRatio.toString());
    console.log('  DaysInInv:', r.daysInInventory.toString());
    console.log('');
  });
}
check().catch(console.error).finally(() => prisma.$disconnect());
