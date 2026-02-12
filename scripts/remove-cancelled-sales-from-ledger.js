// Remove customer ledger entries for cancelled sales
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  // Find all cancelled sales (either paymentStatus == 'CANCELLED' or isActive == false)
  const cancelledSales = await prisma.sale.findMany({
    where: {
      OR: [
        { paymentStatus: 'CANCELLED' },
        { isActive: false }
      ]
    },
    select: { id: true }
  });

  const cancelledSaleIds = cancelledSales.map(sale => sale.id.toString());
  if (cancelledSaleIds.length === 0) {
    console.log('No cancelled sales found.');
    return;
  }

  // Build patterns to match in description
  const patterns = cancelledSaleIds.map(id => `Sale #${id}`);

  // Find matching ledger entry IDs
  const ledgerEntries = await prisma.customerLedgerEntry.findMany({
    where: {
      OR: patterns.map(pattern => ({ description: { contains: pattern } }))
    },
    select: { id: true }
  });
  const ledgerEntryIds = ledgerEntries.map(e => e.id);

  if (ledgerEntryIds.length === 0) {
    console.log('No matching ledger entries found for cancelled sales.');
    return;
  }

  // Delete related CustomerLedgerItem records first
  const deletedItems = await prisma.customerLedgerItem.deleteMany({
    where: { ledgerEntryId: { in: ledgerEntryIds } }
  });

  // Delete the CustomerLedgerEntry records
  const deletedEntries = await prisma.customerLedgerEntry.deleteMany({
    where: { id: { in: ledgerEntryIds } }
  });

  console.log(`Deleted ${deletedItems.count} ledger items and ${deletedEntries.count} ledger entries for cancelled sales.`);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
}); 