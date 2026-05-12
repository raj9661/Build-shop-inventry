const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- INSPECT ALL CUSTOMER ENTRIES ---');

    // Find a regular sale with payment status COMPLETED
    const sale = await prisma.sale.findFirst({
        where: {
            paymentStatus: { in: ['COMPLETED'] },
            customerId: { not: null }
        },
        orderBy: { id: 'desc' }
    });

    if (!sale) {
        console.log('No COMPLETED regular sale with customer found.');
        return;
    }

    console.log(`Found Sale #${sale.id} for Customer ID: ${sale.customerId}`);
    console.log(`Sale Date: ${sale.saleDate}`);
    console.log(`Total: ${sale.totalAmount}`);

    // List all ledger entries for this customer
    const entries = await prisma.customerLedgerEntry.findMany({
        where: {
            customerId: sale.customerId
        },
        orderBy: { id: 'desc' },
        take: 10
    });

    console.log(`Found ${entries.length} recent ledger entries for Customer ${sale.customerId}:`);
    entries.forEach(e => {
        console.log(`ID: ${e.id}, Date: ${e.date}, Type: ${e.type}, Amount: ${e.amount}, Desc: ${e.description}`);
    });

    await prisma.$disconnect();
}

main();
