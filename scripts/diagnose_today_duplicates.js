const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

async function main() {
    console.log('--- DIAGNOSE TODAY DUPLICATES (FILE) ---');

    // Find entries for today
    const entries = await prisma.customerLedgerEntry.findMany({
        where: {
            customerId: 1,
            date: {
                gte: new Date('2026-02-10T00:00:00.000Z')
            }
        },
        orderBy: { id: 'desc' }
    });

    const output = JSON.stringify(entries, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value
        , 2);

    fs.writeFileSync('debug_today.json', output);
    console.log(`Written ${entries.length} entries to debug_today.json`);

    await prisma.$disconnect();
}

main();
