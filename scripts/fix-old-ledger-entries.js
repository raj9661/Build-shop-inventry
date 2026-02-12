// scripts/fix-old-ledger-entries.js

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Starting old ledger fix...');

  // 1. Find all payment (credit) ledger entries for sales
  const paymentEntries = await prisma.customerLedgerEntry.findMany({
    where: {
      creditAmount: { gt: 0 },
      description: {
        contains: 'Payment',
        mode: 'insensitive',
      },
    },
  });

  // Further filter to only those that also mention 'Sale #' in description
  const salePaymentEntries = paymentEntries.filter(entry =>
    entry.description && entry.description.includes('Sale #')
  );

  if (salePaymentEntries.length === 0) {
    console.log('✅ No old payment ledger entries for sales found.');
    return;
  }

  // 2. Delete these entries
  const idsToDelete = salePaymentEntries.map(e => e.id);
  await prisma.customerLedgerItem.deleteMany({
    where: { ledgerEntryId: { in: idsToDelete } },
  });
  const result = await prisma.customerLedgerEntry.deleteMany({
    where: { id: { in: idsToDelete } },
  });

  console.log(`✅ Deleted ${result.count} old payment ledger entries for sales.`);

  // Optionally, you can recalculate running balances for all customers here
  // (Recommended if you want to ensure balances are correct)

  // Get all affected customer IDs
  const affectedCustomerIds = [...new Set(salePaymentEntries.map(e => e.customerId))];
  for (const customerId of affectedCustomerIds) {
    // Get all entries for this customer
    const entries = await prisma.customerLedgerEntry.findMany({
      where: { customerId },
      orderBy: [
        { date: 'asc' },
        { id: 'asc' },
      ],
    });
    let runningBalance = 0;
    for (const entry of entries) {
      runningBalance += Number(entry.debitAmount) - Number(entry.creditAmount);
      await prisma.customerLedgerEntry.update({
        where: { id: entry.id },
        data: { balance: runningBalance },
      });
    }
    await prisma.customer.update({
      where: { id: customerId },
      data: { currentBalance: runningBalance },
    });
    console.log(`🔄 Recalculated balance for customer ${customerId}`);
  }

  console.log('🎉 Old ledger fix complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 