const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- VERIFY DEDUPLICATION LOGIC ---');

    // Get the exact 3 entries we found earlier for Sale #33
    const entries = await prisma.customerLedgerEntry.findMany({
        where: {
            id: { in: [92, 93, 94] }
        },
        orderBy: { id: 'desc' } // 94, 93, 92
    });

    console.log(`Loaded ${entries.length} entries.`);

    // Simulate the new logic
    const seenSaleIds = new Set();
    const keptEntries = [];
    const skippedEntries = [];

    entries.forEach(entry => {
        const amount = Number(entry.amount);
        const isNegative = amount < 0;

        // Assume all are linked to TMT Sale #33
        const saleKey = 'tmt-33';

        if (entry.type === 'sale_payment') {
            if (!isNegative) {
                if (seenSaleIds.has(saleKey)) {
                    skippedEntries.push(entry.id);
                    return;
                }
                seenSaleIds.add(saleKey);
                keptEntries.push({ id: entry.id, type: 'Purchase (Positive)' });
            } else {
                keptEntries.push({ id: entry.id, type: 'Payment (Negative)' });
            }
        } else {
            keptEntries.push({ id: entry.id, type: entry.type });
        }
    });

    console.log(`Kept ${keptEntries.length} entries.`);
    keptEntries.forEach(e => console.log(`- ID ${e.id}: ${e.type}`));

    console.log(`Skipped ${skippedEntries.length} entries (Duplicates).`);
    skippedEntries.forEach(id => console.log(`- ID ${id}`));

    await prisma.$disconnect();
}

main();
