// Check cancelled TMT sales and inventory
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkCancelledSales() {
    try {
        console.log('\n=== CANCELLED TMT SALES ===');
        const cancelledSales = await prisma.tmtSale.findMany({
            where: { paymentStatus: 'CANCELLED' },
            include: {
                items: {
                    include: {
                        product: true
                    }
                }
            },
            orderBy: { updatedAt: 'desc' },
            take: 3
        });

        for (const sale of cancelledSales) {
            console.log(`\nSale ID: ${sale.id}`);
            console.log(`Customer: ${sale.customerName}`);
            console.log(`Cancelled At: ${sale.updatedAt}`);
            console.log(`Shop ID: ${sale.shopId}`);
            console.log(`Items that should have been restored:`);

            for (const item of sale.items) {
                console.log(`  - Product ID: ${item.productId}`);
                console.log(`    Name: ${item.product.productName}`);
                console.log(`    Quantity: ${item.quantity} ${item.unitType}`);
                console.log(`    Weight per rod: ${item.weightPerRodKg}kg`);
                console.log(`    Rods per bundle: ${item.rodsPerBundle}`);
                console.log(`    Weight per bundle: ${item.weightPerBundleKg}kg`);

                // Calculate equivalent KG based on unit type
                let equivalentKg = 0;
                const qty = Number(item.quantity);
                if (item.unitType === 'BUNDLE') {
                    equivalentKg = qty * Number(item.weightPerBundleKg);
                } else if (item.unitType === 'PIECE') {
                    equivalentKg = qty * Number(item.weightPerRodKg);
                } else { // KG
                    equivalentKg = qty;
                }
                console.log(`    Equivalent KG to restore: ${equivalentKg}kg`);

                // Check current inventory
                const inventory = await prisma.tmtInventory.findUnique({
                    where: {
                        productId_shopId: {
                            productId: item.productId,
                            shopId: sale.shopId
                        }
                    }
                });

                if (inventory) {
                    console.log(`    Current Inventory: ${inventory.availableQtyKg}kg`);
                    console.log(`    Last Updated: ${inventory.lastUpdated}`);
                } else {
                    console.log(`    ⚠️  NO INVENTORY RECORD FOUND!`);
                }
            }
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkCancelledSales();
