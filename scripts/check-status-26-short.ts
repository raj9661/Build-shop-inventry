
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const sale = await prisma.tmtSale.findUnique({
        where: { id: 26n }, // Using BigInt literal
        select: { id: true, status: true, customerId: true }
    });

    if (sale) {
        console.log(`Sale ${sale.id} Status: ${sale.status}`);
        console.log(`Sale ${sale.id} CustomerId: ${sale.customerId}`);
    } else {
        console.log('Sale 26 not found.');
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
