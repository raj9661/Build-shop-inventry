
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkSaleStatus() {
    const sale = await prisma.sale.findUnique({
        where: { id: 40 }
    });
    console.log('Sale #40 Status:', sale ? sale.paymentStatus : 'Not Found');
}

checkSaleStatus();
