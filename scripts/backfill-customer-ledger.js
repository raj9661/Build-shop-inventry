const { PrismaClient } = require('@prisma/client');
const { createPurchaseEntry } = require('../app/lib/ledgerUtils');

const prisma = new PrismaClient();

async function main() {
  // Find all sales that do not have a corresponding ledger entry
  const sales = await prisma.sale.findMany({
    include: {
      items: true
    }
  });
  const filteredSales = sales.filter(sale => sale.customerId != null && sale.paymentStatus === 'COMPLETED' && sale.isActive);

  for (const sale of filteredSales) {
    // Check if a ledger entry already exists for this sale
    const existing = await prisma.customerLedgerEntry.findFirst({
      where: {
        customerId: sale.customerId,
        date: sale.saleDate,
        debitAmount: sale.finalAmount
      }
    });
    if (existing) continue; // Skip if already exists

    // Create ledger entry
    await prisma.$transaction(async (tx) => {
      await createPurchaseEntry(tx, {
        customerId: sale.customerId,
        amount: Number(sale.finalAmount),
        method: 'sale-backfill',
        date: sale.saleDate,
        time: sale.saleDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
        description: `Backfill for Sale #${sale.id}`,
        items: sale.items.map(item => ({
          name: item.productName || '',
          quantity: Number(item.quantity),
          price: Number(item.unitPrice),
          unit: item.unit || ''
        }))
      }, sale);
    });
    console.log(`Backfilled ledger for sale #${sale.id}`);
  }
  console.log('Backfill complete!');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
}); 