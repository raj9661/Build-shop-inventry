// Test script to check TMT inventory restoration
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkTmtInventory() {
    try {
        // Get all TMT inventory
        const inventory = await prisma.tmtInventory.findMany({
            include: {
                product: true
            }
        });

        console.log('\n=== TMT INVENTORY ===');
        inventory.forEach(inv => {
            console.log(`Product: ${inv.product.productName}`);
            console.log(`  Available: ${inv.availableQtyKg} kg`);
            console.log(`  Reserved: ${inv.reservedQtyKg} kg`);
            console.log(`  Shop ID: ${inv.shopId}`);
            console.log('---');
        });

        // Get recent TMT sales
        const sales = await prisma.tmtSale.findMany({
            take: 5,
            orderBy: { createdAt: 'desc' },
            include: {
                items: {
                    include: {
                        product: true
                    }
                }
            }
        });

        console.log('\n=== RECENT TMT SALES ===');
        sales.forEach(sale => {
            console.log(`Sale ID: ${sale.id}`);
            console.log(`Status: ${sale.paymentStatus}`);
            console.log(`Customer: ${sale.customerName}`);
            console.log(`Items:`);
            sale.items.forEach(item => {
                console.log(`  - ${item.product.productName}: ${item.quantity} ${item.unitType}`);
            });
            console.log('---');
        });

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkTmtInventory();
