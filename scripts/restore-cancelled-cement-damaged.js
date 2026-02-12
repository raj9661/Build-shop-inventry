// restore-cancelled-cement-damaged.js
// Run with: node scripts/restore-cancelled-cement-damaged.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function restoreDamagedCementFromCancelledSales() {
  const cancelledSales = await prisma.sale.findMany({
    where: { paymentStatus: 'CANCELLED' },
    include: {
      items: { include: { product: true } }
    }
  });

  let totalRestored = 0;
  for (const sale of cancelledSales) {
    for (const item of sale.items) {
      const isCement = item.product && item.product.name.toLowerCase().includes('cement');
      const isLoose = item.unit === 'kg';
      if (isCement && isLoose) {
        const productId = item.product.id;
        const restoreQty = Number(item.quantity);
        const product = await prisma.product.findUnique({ where: { id: productId } });
        const oldDamaged = product.damagedQuantity || 0;
        const newDamaged = oldDamaged + restoreQty;
        await prisma.product.update({
          where: { id: productId },
          data: { damagedQuantity: newDamaged }
        });
        console.log(`Restored ${restoreQty}kg to damagedQuantity for product '${item.product.name}' (ID: ${productId}): ${oldDamaged} -> ${newDamaged}`);
        totalRestored += restoreQty;
      }
    }
  }
  console.log(`\nDone. Total loose cement restored: ${totalRestored} kg.`);
  await prisma.$disconnect();
}

restoreDamagedCementFromCancelledSales().catch(e => {
  console.error('Error restoring damaged cement:', e);
  prisma.$disconnect();
  process.exit(1);
}); 