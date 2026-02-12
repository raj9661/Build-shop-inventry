
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixLedgerDescriptions() {
    console.log('Starting ledger description fix...');

    try {
        // 1. Find all debit/sale_payment entries without 'Sale #' in description
        const orphanedEntries = await prisma.customerLedgerEntry.findMany({
            where: {
                OR: [
                    { type: 'sale_payment' },
                    { type: 'debit' } // Sometimes purchases are marked as debit
                ],
                NOT: {
                    description: { contains: 'Sale #' }
                }
            }
        });

        console.log(`Found ${orphanedEntries.length} entries without 'Sale #' in description.`);

        let fixedCount = 0;

        for (const entry of orphanedEntries) {
            // 2. Try to find a matching Sale
            // Match by: customerId, amount, and time (within 1 minute)
            const entryTime = new Date(entry.date).getTime(); // entry.date might be stripped of time in some logic, but usually DB has full datetime
            // Actually entry.date is DateTime in Prisma, so it has time.

            const timeWindow = 60 * 1000; // 1 minute

            const matchingSale = await prisma.sale.findFirst({
                where: {
                    customerId: entry.customerId,
                    // finalAmount might slightly differ if there was a discrepancy, but usually exact matches for auto-generated entries
                    finalAmount: entry.amount,
                    createdAt: {
                        gte: new Date(entry.createdAt.getTime() - timeWindow),
                        lte: new Date(entry.createdAt.getTime() + timeWindow)
                    }
                }
            });

            if (matchingSale) {
                console.log(`Found match! Ledger Entry ${entry.id} matches Sale ${matchingSale.id}`);

                // 3. Update description
                const newDescription = entry.description
                    ? `${entry.description} (Sale #${matchingSale.id})`
                    : `Sale #${matchingSale.id}`;

                await prisma.customerLedgerEntry.update({
                    where: { id: entry.id },
                    data: { description: newDescription }
                });

                fixedCount++;
                console.log(`Updated Ledger Entry ${entry.id} description to: "${newDescription}"`);
            } else {
                // If exact time match fails, try relaxing time window to 5 mins if created separately?
                // But these are auto-created in transaction, so times should be identical.
                // Let's print one failure to debug if needed
                // console.log(`No matching sale found for Ledger Entry ${entry.id} (Amount: ${entry.amount}, Date: ${entry.date})`);
            }
        }

        console.log(`Fix complete. Fixed ${fixedCount} entries.`);

    } catch (error) {
        console.error('Error fixing ledger descriptions:', error);
    } finally {
        await prisma.$disconnect();
    }
}

fixLedgerDescriptions();
