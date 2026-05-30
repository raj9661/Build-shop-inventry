
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const saleId = 26n;
    const customerId = 1n; // Sumit Kumar

    console.log(`Fixing Sale #${saleId} for Customer #${customerId}...`);

    // 1. Update the Sale with Customer ID
    const updatedSale = await prisma.tmtSale.update({
        where: { id: saleId },
        data: {
            customerId: customerId
        }
    });
    console.log('Updated Sale customerId:', updatedSale.customerId);

    // 2. Create Ledger Entry
    const description = `[COMPLETED] TMT Sale #${saleId}`;

    // Check if already exists (just in case)
    const existing = await prisma.customerLedgerEntry.findFirst({
        where: {
            customerId: customerId,
            description: description
        }
    });

    // Use contains to be safe like before
    const existingByContains = await prisma.customerLedgerEntry.findFirst({
        where: {
            customerId: customerId,
            description: { contains: `TMT Sale #${saleId}` }
        }
    });

    if (existingByContains) {
        console.log('Ledger entry already exists.');
        return;
    }

    const entry = await prisma.customerLedgerEntry.create({
        data: {
            customerId: customerId,
            amount: updatedSale.totalAmount,
            type: 'sale_payment', // Debit
            method: 'CASH',
            date: updatedSale.saleDate,
            description: description,
            shopId: updatedSale.shopId,
            isActive: true
        }
    });

    console.log('Created Ledger Entry:', entry.id);
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
