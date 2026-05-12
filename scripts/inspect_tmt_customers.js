const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- INSPECT TMT SALES CUSTOMER DATA ---');

    const sales = await prisma.tmtSale.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
            customer: true
        }
    });

    console.log(`Found ${sales.length} recent TMT sales.`);
    sales.forEach(s => {
        console.log(`ID: ${s.id}, CustomerID: ${s.customerId}, Name: ${s.customerName}`);
        if (s.customer) {
            console.log(`   -> Linked Customer: ${s.customer.name}, Phone: ${s.customer.phone}`);
        } else {
            console.log(`   -> No linked customer object.`);
        }
    });

    await prisma.$disconnect();
}

main();
