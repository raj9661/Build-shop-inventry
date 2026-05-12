const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const updates = [
    { id: 6, outstandingPayment: 138140 },
    { id: 7, outstandingPayment: 97060 },
    { id: 8, outstandingPayment: 96625 },
  ];

  for (const u of updates) {
    const result = await prisma.supplier.update({
      where: { id: BigInt(u.id) },
      data: { outstandingPayment: u.outstandingPayment },
    });
    console.log(`Updated supplier id=${u.id} | name=${result.name} | outstandingPayment=${result.outstandingPayment}`);
  }

  await prisma.$disconnect();
  console.log('Done!');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
