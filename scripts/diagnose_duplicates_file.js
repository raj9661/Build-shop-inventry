const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

async function main() {
    console.log('--- DIAGNOSE DUPLICATES (FILE) ---');

    // Find entries for TMT Sale #23
    const entries = await prisma.customerLedgerEntry.findMany({
        where: {
            customerId: 1,
            description: { contains: 'TMT Sale #23' }
        },
        orderBy: { id: 'desc' }
    });

    const output = JSON.stringify(entries, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value
        , 2);

    fs.writeFileSync('debug_duplicates.json', output);
    console.log(`Written ${entries.length} entries to debug_duplicates.json`);

    await prisma.$disconnect();
}

main();
