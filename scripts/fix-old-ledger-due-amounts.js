// scripts/fix-old-ledger-due-amounts.js

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Starting old ledger due amount fix...');

  // 1. Find all purchase (debit) ledger entries related to sales
  const purchaseEntries = await prisma.customerLedgerEntry.findMany({
    where: {
      debitAmount: { gt: 0 },
      description: {
        contains: 'Sale #',
        mode: 'insensitive',
      },
    },
  });

  let updatedCount = 0;
  let affectedCustomerIds = new Set();

  for (const entry of purchaseEntries) {
    // Extract saleId from description
    const match = entry.description.match(/Sale #(\d+)/);
    if (!match) continue;
    const saleId = parseInt(match[1]);
    if (!saleId) continue;
    // Fetch the sale
    const sale = await prisma.sale.findUnique({
      where: { id: saleId },
      select: { dueAmount: true },
    });
    if (!sale) continue;
    const dueAmount = Number(sale.dueAmount);
    // Only update if different
    if (Number(entry.debitAmount) !== dueAmount) {
      await prisma.customerLedgerEntry.update({
        where: { id: entry.id },
        data: { debitAmount: dueAmount },
      });
      updatedCount++;
      affectedCustomerIds.add(entry.customerId);
      console.log(`Updated ledger entry ${entry.id}: debitAmount set to dueAmount ${dueAmount}`);
    }
  }

  // Recalculate running balances for affected customers
  for (const customerId of affectedCustomerIds) {
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

  console.log(`✅ Updated ${updatedCount} ledger entries. Old ledger due amount fix complete!`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 