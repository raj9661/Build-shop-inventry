const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- DIAGNOSE DUPLICATES (FULL) ---');

    const entries = await prisma.customerLedgerEntry.findMany({
        where: {
            customerId: 1,
            description: { contains: 'TMT Sale' }
        },
        orderBy: { id: 'desc' },
        take: 30
    });

    entries.forEach(e => {
        console.log(`[${e.type}] ID: ${e.id} | Date: ${e.date.toISOString().split('T')[0]} | Amt: ${e.amount} | Desc: ${e.description}`);
    });

    await prisma.$disconnect();
}

main();
