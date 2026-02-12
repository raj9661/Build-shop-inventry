
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function diagnoseMissingLedgerEntry() {
    console.log('Starting diagnosis for sale amount 3540...');

    try {
        // 1. Find the sale(s) with amount 3540
        const sales = await prisma.sale.findMany({
            where: { finalAmount: 3540 }
        });

        console.log(`Found ${sales.length} sales with amount 3540.`);

        for (const sale of sales) {
            console.log('--------------------------------------------------');
            console.log('Sale Details:', {
                id: Number(sale.id),
                customerId: Number(sale.customerId),
                amount: Number(sale.finalAmount),
                date: sale.saleDate,
                createdAt: sale.createdAt,
                shopId: Number(sale.shopId),
                notes: sale.notes
            });

            // 2. Find ALL ledger entries for this customer
            const ledgerEntries = await prisma.customerLedgerEntry.findMany({
                where: {
                    customerId: sale.customerId
                },
                orderBy: { date: 'desc' }
            });

            console.log(`Found ${ledgerEntries.length} TOTAL ledger entries for customer ${sale.customerId}.`);

            ledgerEntries.forEach(entry => {
                console.log(`[Entry #${entry.id}] Shop: ${entry.shopId}, Date: ${entry.date.toISOString()}, Amount: ${entry.amount}, Type: ${entry.type}, Desc: "${entry.description}"`);
            });
        }

    } catch (error) {
        console.error('Error in diagnosis:', error);
    } finally {
        await prisma.$disconnect();
    }
}

diagnoseMissingLedgerEntry();
