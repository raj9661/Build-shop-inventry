const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- INSPECT TMT SALE DATA ---');

    // Fetch a few recent TMT sales to check their payment data
    const sales = await prisma.tmtSale.findMany({
        take: 3,
        orderBy: { id: 'desc' },
        include: {
            items: true
        }
    });

    console.log(`Loaded ${sales.length} TMT Sales.`);

    sales.forEach(sale => {
        console.log(`\nSale ID: ${sale.id}`);
        console.log(`Total: ${sale.totalAmount}`);
        console.log(`Paid: ${sale.paidAmount}`);
        console.log(`Due: ${sale.dueAmount}`);
        console.log(`Status: ${sale.paymentStatus}`);
        console.log(`Method: ${sale.paymentMethod}`);
        console.log(`Date: ${sale.saleDate}`);
        console.log(`Items: ${sale.items.length}`);
    });

    await prisma.$disconnect();
}

main();
