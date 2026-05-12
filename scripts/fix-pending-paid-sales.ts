
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('Starting Fix for Pending Paid Sales...');

    // 1. Find sales that are PENDING but fully paid (or PAID status)
    // We check for: status = PENDING AND (paymentStatus = PAID OR paidAmount >= totalAmount)
    const pendingPaidSales = await prisma.tmtSale.findMany({
        where: {
            status: 'PENDING',
            OR: [
                { paymentStatus: 'PAID' },
                {
                    // For simple comparison we assume paidAmount is not null
                    // Ideally we'd compare colums but Prisma doesn't support col comparison in where easily
                    // So we fetch potential candidates and filter in JS
                }
            ]
        },
        include: {
            customer: true
        }
    });

    // Also fetch all pending sales to check amount manually if needed
    const allPending = await prisma.tmtSale.findMany({
        where: { status: 'PENDING' }
    });

    for (const sale of allPending) {
        const isPaid = sale.paymentStatus === 'PAID' || (Number(sale.paidAmount || 0) >= Number(sale.totalAmount));

        if (isPaid) {
            console.log(`Found Pending but Paid Sale #${sale.id}. Updating...`);

            // Update status to COMPLETED
            await prisma.tmtSale.update({
                where: { id: sale.id },
                data: { status: 'COMPLETED' }
            });

            if (sale.customerId) {
                // Check if ledger entry exists
                const existing = await prisma.customerLedgerEntry.findFirst({
                    where: {
                        description: { contains: `TMT Sale #${sale.id}` }
                    }
                });

                if (!existing) {
                    console.log(`Creating missing Ledger Entry for Sale #${sale.id}`);
                    await prisma.customerLedgerEntry.create({
                        data: {
                            customerId: sale.customerId,
                            amount: sale.totalAmount,
                            type: 'sale_payment',
                            method: 'CASH', // Default or fetch from sale
                            date: sale.saleDate,
                            description: `[COMPLETED] TMT Sale #${sale.id}`,
                            shopId: sale.shopId,
                            isActive: true
                        }
                    });
                } else {
                    console.log(`Ledger entry already exists for Sale #${sale.id}`);
                }
            }
        }
    }

    console.log('Fix script completed.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
