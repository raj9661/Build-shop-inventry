const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- DIAGNOSE DUPLICATES (JSON) ---');

    const entries = await prisma.customerLedgerEntry.findMany({
        where: {
            customerId: 1,
            description: { contains: 'TMT Sale' }
        },
        orderBy: { id: 'desc' },
        take: 30
    });

    console.log(JSON.stringify(entries, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value
        , 2));

    await prisma.$disconnect();
}

main();
