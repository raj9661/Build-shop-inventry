const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- VERIFY TMT DISPLAY LOGIC ---');

    // Fetch TMT Sale #33 (or whatever recent one exists)
    const sales = await prisma.tmtSale.findMany({
        take: 3,
        orderBy: { id: 'desc' },
        select: {
            id: true,
            totalAmount: true,
            paidAmount: true,
            dueAmount: true,
            paymentStatus: true,
            status: true,
            paymentMethod: true
        }
    });

    sales.forEach(sale => {
        console.log(`\nMocking Logic for Sale #${sale.id}:`);
        console.log(`DB Values: Total=${sale.totalAmount}, Paid=${sale.paidAmount}, Due=${sale.dueAmount}, Status=${sale.paymentStatus}, Method=${sale.paymentMethod}`);

        const finalAmount = Number(sale.totalAmount) || 0;
        let paidAmount = sale.paidAmount ? Number(sale.paidAmount) : 0;
        let dueAmount = sale.dueAmount ? Number(sale.dueAmount) : 0;

        const status = sale.paymentStatus || sale.status;

        if (status === 'PAID' || status === 'COMPLETED') {
            if (paidAmount === 0 && dueAmount === 0) {
                paidAmount = finalAmount;
            }
        }

        if (dueAmount === 0 && paidAmount < finalAmount && status !== 'PAID' && status !== 'COMPLETED') {
            dueAmount = finalAmount - paidAmount;
        }

        let paymentType = 'cash';
        let partialPaymentMethod = null;

        if (paidAmount > 0 && paidAmount < finalAmount) {
            paymentType = 'partial';
            if (sale.paymentMethod) {
                const methodStr = String(sale.paymentMethod).toLowerCase();
                if (methodStr.includes('upi')) partialPaymentMethod = 'upi';
                else if (methodStr.includes('card')) partialPaymentMethod = 'card';
                else if (methodStr.includes('cash')) partialPaymentMethod = 'cash';
                else partialPaymentMethod = methodStr;
            }
        } else if (paidAmount === 0) {
            paymentType = 'loan';
        } else {
            paymentType = 'cash';
        }

        console.log(`Calculated Display:`);
        console.log(`Total: ${finalAmount}`);
        console.log(`Paid: ${paidAmount}`);
        console.log(`Due: ${dueAmount}`);
        console.log(`Type: ${paymentType}`);
        console.log(`Partial Method: ${partialPaymentMethod}`);
    });

    await prisma.$disconnect();
}

main();
