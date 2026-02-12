// Remove customer ledger entries for non-completed (active or cancelled) sales
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  // Find all sales that are not completed (paymentStatus !== 'COMPLETED' or isActive !== true)
  const nonCompletedSales = await prisma.sale.findMany({
    where: {
      OR: [
        { paymentStatus: { not: 'COMPLETED' } },
        { isActive: false }
      ]
    },
    select: { id: true }
  });

  const saleIds = nonCompletedSales.map(sale => sale.id.toString());
  if (saleIds.length === 0) {
    console.log('No non-completed (active/cancelled) sales found.');
    return;
  }

  // Build patterns to match in description
  const patterns = saleIds.map(id => `Sale #${id}`);

  // Find matching ledger entry IDs
  const ledgerEntries = await prisma.customerLedgerEntry.findMany({
    where: {
      OR: patterns.map(pattern => ({ description: { contains: pattern } }))
    },
    select: { id: true }
  });
  const ledgerEntryIds = ledgerEntries.map(e => e.id);

  if (ledgerEntryIds.length === 0) {
    console.log('No matching ledger entries found for non-completed sales.');
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

  console.log(`Deleted ${deletedItems.count} ledger items and ${deletedEntries.count} ledger entries for non-completed (active/cancelled) sales.`);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
}); 