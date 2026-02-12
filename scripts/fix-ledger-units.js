// Script to fix customer ledger items with incorrect unit ('units') by looking up the original sale item
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Starting ledger unit fix...');
  // Find all ledger items with unit 'units'
  const items = await prisma.customerLedgerItem.findMany({
    where: { unit: 'units' },
    include: {
      ledgerEntry: {
        include: {
          // Try to find sale reference in description
          // We'll use this to look up the original sale item
        }
      }
    }
  });

  let updatedCount = 0;

  for (const item of items) {
    // Try to extract saleId from the ledger entry description
    let saleId = null;
    if (item.ledgerEntry && item.ledgerEntry.description) {
      const match = item.ledgerEntry.description.match(/Sale #(\d+)/);
      if (match) {
        saleId = parseInt(match[1], 10);
      }
    }
    if (!saleId) {
      // No sale reference, cannot fix
      continue;
    }
    // Find the sale item with matching product and quantity
    const sale = await prisma.sale.findUnique({
      where: { id: saleId },
      include: { items: true }
    });
    if (!sale) continue;
    // Try to find a matching sale item
    const matchingSaleItem = sale.items.find(
      si =>
        (item.productId ? si.productId === item.productId : true) &&
        si.quantity === item.quantity
    );
    if (matchingSaleItem && matchingSaleItem.unit && matchingSaleItem.unit !== 'units') {
      // Update the ledger item with the correct unit
      await prisma.customerLedgerItem.update({
        where: { id: item.id },
        data: { unit: matchingSaleItem.unit }
      });
      updatedCount++;
      console.log(`✅ Updated ledger item ${item.id}: unit -> ${matchingSaleItem.unit}`);
    }
  }

  console.log(`\n🎉 Done! Updated ${updatedCount} ledger items.`);
  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
}); 