
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('DEBUG: Checking TMT Sales...');

    const allSales = await prisma.tmtSale.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' }
    });

    console.log(`Total TMT Sales found: ${allSales.length}`);

    if (allSales.length > 0) {
        console.log('Sample TMT Sales:', sanitize(allSales));
    } else {
        console.log('No TMT Sales found.');
    }

    const customers = await prisma.customer.count();
    console.log(`Total Customers: ${customers}`);
}

function sanitize(obj) {
    return JSON.parse(JSON.stringify(obj, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value
    ));
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

export {};
