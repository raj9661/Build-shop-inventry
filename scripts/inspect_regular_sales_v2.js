const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- INSPECT REGULAR SALE ENTRIES (BY DESCRIPTION) ---');

    // Find a regular sale with payment status COMPLETED (fully paid or partially)
    // Note: Schema uses 'COMPLETED', 'PENDING' etc for SaleStatus, but also has PaymentStatus enum
    // Sale model: paymentStatus PaymentStatus @default(PAID) -> wait, schema said @default(PAID) but enum didn't have PAID?
    // Let me check Schema line 901:  paymentStatus TmtPaymentStatus @default(PAID) for TmtSale!
    // For SALE model (not TmtSale), line 1061-1067: enum PaymentStatus { PENDING, COMPLETED, FAILED, CANCELLED, REFUNDED }
    // A regular SALE uses PaymentStatus enum. So it should be 'COMPLETED'.

    // So for Regular Sale (Sale model):
    const sale = await prisma.sale.findFirst({
        where: {
            paymentStatus: 'COMPLETED'
        },
        orderBy: { id: 'desc' }
    });

    if (!sale) {
        console.log('No COMPLETED regular sale found.');
        return;
    }

    console.log(`Found Sale #${sale.id}`);
    console.log(`Total: ${sale.totalAmount}, PaymentStatus: ${sale.paymentStatus}`);

    // Find entries with description containing "Sale #{id}"
    // Regular sales create entries like "Sale #123 - Customer Name" or similar.
    // Or maybe just "Sale #123"?
    const entries = await prisma.customerLedgerEntry.findMany({
        where: {
            customerId: sale.customerId,
            description: { contains: `Sale #${sale.id}` }
        }
    });

    console.log(`Found ${entries.length} ledger entries for Sale #${sale.id}:`);
    entries.forEach(e => {
        console.log(`ID: ${e.id}, Type: ${e.type}, Amount: ${e.amount}, Desc: ${e.description}`);
    });

    // Also check for any PAYMENT entries around that time
    const paymentEntries = await prisma.customerLedgerEntry.findMany({
        where: {
            customerId: sale.customerId,
            type: 'sale_payment',
            amount: { lt: 0 }, // Credit/Payment
            date: {
                gte: new Date(sale.saleDate.getTime() - 60000), // 1 min before
                lte: new Date(sale.saleDate.getTime() + 60000)  // 1 min after
            }
        }
    });
    console.log(`Found ${paymentEntries.length} payment entries around sale time:`);
    paymentEntries.forEach(e => {
        console.log(`ID: ${e.id}, Type: ${e.type}, Amount: ${e.amount}, Desc: ${e.description}`);
    });

    await prisma.$disconnect();
}

main();
