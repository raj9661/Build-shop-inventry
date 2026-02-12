const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        console.log('--- FIX DUPLICATES START ---');

        const entries = await prisma.customerLedgerEntry.findMany({
            where: {
                description: { contains: 'TMT Sale #' }
            },
            orderBy: { id: 'asc' } // Keep the oldest/original? Or newest? let's keep oldest.
        });

        console.log(`Scanning ${entries.length} TMT entries for duplicates...`);

        const processed = new Set();
        const toDelete = [];

        // Grouping keys:
        // For Purchase: "PURCHASE-SALEID"
        // For Payment: "PAYMENT-SALEID"

        for (const entry of entries) {
            const saleIdMatch = entry.description.match(/TMT Sale #(\d+)/i);
            if (!saleIdMatch) continue;

            const saleId = saleIdMatch[1];
            const isPayment = entry.description.toLowerCase().includes('payment for') || entry.type === 'loan_clearing' || entry.type === 'credit';
            const typeKey = isPayment ? 'PAYMENT' : 'PURCHASE';
            const uniqueKey = `${typeKey}-${saleId}`;

            if (processed.has(uniqueKey)) {
                // Duplicate found!
                console.log(`Found Duplicate: ${uniqueKey} (ID: ${entry.id}) - Marking for deletion.`);
                toDelete.push(entry.id);
            } else {
                processed.add(uniqueKey);
            }
        }

        console.log(`Found ${toDelete.length} duplicate entries to delete.`);

        if (toDelete.length > 0) {
            const result = await prisma.customerLedgerEntry.deleteMany({
                where: {
                    id: { in: toDelete }
                }
            });
            console.log(`Deleted ${result.count} entries.`);
        }

        console.log('--- FIX COMPLETE ---');

    } catch (error) {
        console.error(error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
