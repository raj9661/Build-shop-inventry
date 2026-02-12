const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- INSPECT REGULAR SALE ENTRIES ---');

    // Find a regular sale with a payment
    const sale = await prisma.sale.findFirst({
        where: {
            paymentStatus: { in: ['PAID', 'PARTIAL'] }
        },
        orderBy: { id: 'desc' },
        include: { items: true }
    });

    if (!sale) {
        console.log('No Paid/Partial regular sale found.');
        return;
    }

    console.log(`Found Sale #${sale.id}`);
    console.log(`Total: ${sale.totalAmount}, Paid: ${sale.paidAmount || 0}, Status: ${sale.paymentStatus}`);

    // Find custom ledger entries linked to this sale
    // Note: Regular sales usually link via 'description' if not explicit saleId, 
    // but let's check explicit saleId first if your schema supports it for regular sales (it does: saleId on LedgerEntry)

    // Check for entries with saleId matching this sale
    // Note: Schema says `saleId` is not on CustomerLedgerEntry directly? 
    // Wait, let's check schema again. 
    // Schema: CustomerLedgerEntry -> id, customerId, amount, type, method... 
    // It DOES NOT have `saleId` column in the schema I read earlier!
    // Wait, `route.ts` uses `entry.saleId`. 
    // Let me re-read the schema for CustomerLedgerEntry to be super sure.
    // If it's not there, `route.ts` might be casting or I missed it.

    // Actually, let's look for entries created around the same time with matching amount
    const entries = await prisma.customerLedgerEntry.findMany({
        where: {
            customerId: sale.customerId,
            date: {
                gte: new Date(sale.saleDate.getTime() - 10000), // 10s before
                lte: new Date(sale.saleDate.getTime() + 10000)  // 10s after
            }
        }
    });

    console.log(`Found ${entries.length} ledger entries around sale time:`);
    entries.forEach(e => {
        console.log(`ID: ${e.id}, Type: ${e.type}, Amount: ${e.amount}, Desc: ${e.description}`);
    });

    await prisma.$disconnect();
}

main();
