const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

async function main() {
    const output = [];
    try {
        output.push('--- CHECK DUPLICATES START ---');

        const entries = await prisma.customerLedgerEntry.findMany({
            where: {
                description: { contains: 'TMT Sale #' }
            }
        });

        output.push(`Found ${entries.length} TMT-related ledger entries.`);

        const entryMap = {};
        const duplicates = [];

        for (const entry of entries) {
            const match = entry.description.match(/TMT Sale #(\d+)/i);
            if (match) {
                const saleId = match[1];
                if (!entryMap[saleId]) {
                    entryMap[saleId] = [];
                }
                entryMap[saleId].push(entry);
            }
        }

        // Check for duplicates
        for (const saleId in entryMap) {
            if (entryMap[saleId].length > 1) {
                const purchases = entryMap[saleId].filter(e => !e.description.toLowerCase().includes('payment for') && e.type !== 'loan_clearing' && e.type !== 'credit');
                if (purchases.length > 1) {
                    duplicates.push({ saleId, purchases });
                }
            }
        }

        output.push(`Found ${duplicates.length} sets of duplicate PURCHASE entries.`);

        fs.writeFileSync('check_duplicates_clean.txt', output.join('\n'));
        console.log('Results written to check_duplicates_clean.txt');

    } catch (error) {
        console.error(error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
