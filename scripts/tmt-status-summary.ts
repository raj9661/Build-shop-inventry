
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('Summarizing TMT Sale Statuses...');

    const summary = await prisma.tmtSale.groupBy({
        by: ['status'],
        _count: {
            id: true
        }
    });

    console.log('Status Summary:', summary);

    const completedSales = await prisma.tmtSale.findMany({
        where: { status: 'COMPLETED' },
        select: { id: true, customerId: true, totalAmount: true }
    });

    console.log('Completed Sales Details:', completedSales);
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
