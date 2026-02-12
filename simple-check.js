// Simple check for cancelled TMT sales
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

async function check() {
    const output = [];

    try {
        const cancelled = await prisma.tmtSale.findMany({
            where: { paymentStatus: 'CANCELLED' },
            include: { items: { include: { product: true } } },
            orderBy: { updatedAt: 'desc' },
            take: 2
        });

        output.push(`Found ${cancelled.length} cancelled sales\n`);

        for (const sale of cancelled) {
            output.push(`\nSale ${sale.id}: ${sale.customerName}, Shop ${sale.shopId}`);
            for (const item of sale.items) {
                output.push(`  ${item.product.productName}: ${item.quantity} ${item.unitType}`);

                const inv = await prisma.tmtInventory.findUnique({
                    where: { productId_shopId: { productId: item.productId, shopId: sale.shopId } }
                });
                output.push(`    Current stock: ${inv ? inv.availableQtyKg + 'kg' : 'NOT FOUND'}`);
            }
        }

        fs.writeFileSync('c:\\Build-shop-inventry\\debug-output.txt', output.join('\n'));
        console.log('WRITTEN TO debug-output.txt');

    } catch (err) {
        console.error(err);
    } finally {
        await prisma.$disconnect();
    }
}

check();
