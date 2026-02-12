const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        console.log('--- CHECK DUPLICATES START ---');

        // Find all ledger entries related to TMT sales
        const entries = await prisma.customerLedgerEntry.findMany({
            where: {
                description: { contains: 'TMT Sale #' }
            },
            select: {
                id: true,
                customerId: true,
                description: true,
                amount: true,
                date: true
            }
        });

        console.log(`Found ${entries.length} TMT-related ledger entries.`);

        // Group by extracted Sale ID
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
                // It's expected to have Purchase (Debit) and Payment (Credit) for the same sale?
                // But usually they have different descriptions or types?
                // Purchase: "[COMPLETED] TMT Sale #123" or "TMT Sale #123"
                // Payment: "Payment for TMT Sale #123"
                // Let's filter by "Purchase vs Payment" context via description

                const purchases = entryMap[saleId].filter(e => !e.description.includes('Payment for'));
                if (purchases.length > 1) {
                    duplicates.push({ saleId, purchases });
                }
            }
        }

        console.log(`\nFound ${duplicates.length} sets of duplicate PURCHASE entries.`);

        duplicates.forEach(d => {
            console.log(`\nSale #${d.saleId} has ${d.purchases.length} entries:`);
            d.purchases.forEach(p => {
                console.log(`- ID: ${p.id}, Date: ${p.date.toISOString()}, Desc: ${p.description}, Amt: ${p.amount}`);
            });
        });

    } catch (error) {
        console.error(error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
