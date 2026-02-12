const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- DIAGNOSE DUPLICATES (TARGETED) ---');

    const entries = await prisma.customerLedgerEntry.findMany({
        where: {
            customerId: 1,
            amount: 2520
        },
        orderBy: { id: 'desc' }
    });

    console.log(`Found ${entries.length} entries with amount 2520.`);

    entries.forEach(e => {
        console.log(`ID: ${e.id} | Date: ${e.date.toISOString()} | Type: ${e.type} | Desc: ${e.description}`);
    });

    await prisma.$disconnect();
}

main();
