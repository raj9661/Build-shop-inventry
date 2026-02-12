const { PrismaClient, Prisma } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const entries = await prisma.customerLedgerEntry.findMany();
  let fixed = 0;
  for (const entry of entries) {
    let update = {};
    if (entry.debitAmount === null || entry.debitAmount === undefined) {
      update.debitAmount = new Prisma.Decimal(0);
    }
    if (entry.creditAmount === null || entry.creditAmount === undefined) {
      update.creditAmount = new Prisma.Decimal(0);
    }
    if (entry.balance === null || entry.balance === undefined) {
      update.balance = new Prisma.Decimal(0);
    }
    if (Object.keys(update).length > 0) {
      await prisma.customerLedgerEntry.update({
        where: { id: entry.id },
        data: update
      });
      fixed++;
      console.log(`Fixed entry id ${entry.id}`);
    }
  }
  console.log(`Done. Fixed ${fixed} entries.`);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
}).finally(() => prisma.$disconnect()); 