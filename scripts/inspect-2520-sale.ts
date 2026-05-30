
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('Searching for TMT Sale with amount 2520...');

    const sales = await prisma.tmtSale.findMany({
        where: {
            totalAmount: 2520
        },
        orderBy: { createdAt: 'desc' },
        include: { customer: true }
    });

    const fs = require('fs');
    let output = `Found ${sales.length} sales.\n`;

    for (const sale of sales) {
        const entries = await prisma.customerLedgerEntry.findMany({
            where: {
                description: { contains: `TMT Sale #${sale.id}` }
            }
        });

        output += '--- SALE DETAILS ---\n';
        output += `ID: ${sale.id}\n`;
        output += `Date: ${sale.createdAt}\n`;
        output += `Status: ${sale.status}\n`;
        output += `Payment Status: ${sale.paymentStatus}\n`;
        output += `Customer: ${sale.customerId} (${sale.customer?.name})\n`;
        output += `Total: ${sale.totalAmount}\n`;
        output += `Paid: ${sale.paidAmount}\n`;
        output += `Due: ${sale.dueAmount}\n`;
        output += `Ledger Entries Found: ${entries.length}\n`;
        entries.forEach(e => {
            output += `   -> [${e.type}] Amount: ${e.amount}, Date: ${e.date}\n`;
        });
        output += '--------------------\n';
    }
    fs.writeFileSync('sale-2520-info.txt', output);
    console.log('Output written to sale-2520-info.txt');
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
