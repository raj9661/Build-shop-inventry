
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- Latest 5 TMT Sales ---');
    const sales = await prisma.tmtSale.findMany({
        take: 1,
        orderBy: { createdAt: 'desc' },
        include: {
            customer: { select: { name: true } }
        }
    });

    if (sales.length > 0) {
        const sale = sales[0];
        const entry = await prisma.customerLedgerEntry.findFirst({
            where: {
                description: { contains: `TMT Sale #${sale.id}` }
            }
        });

        console.log(JSON.stringify({
            ID: sale.id.toString(),
            Date: sale.createdAt,
            Status: sale.status,
            PaymentStatus: sale.paymentStatus,
            Customer: `${sale.customerId} (${sale.customer?.name})`,
            TotalAmount: sale.totalAmount,
            PaidAmount: sale.paidAmount,
            DueAmount: sale.dueAmount,
            LedgerEntry: entry ? `FOUND (ID: ${entry.id})` : 'MISSING'
        }, null, 2));
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
