const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkTmtSaleItems() {
    try {
        const tmtSale = await prisma.tmtSale.findFirst({
            include: {
                items: {
                    include: {
                        product: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        if (!tmtSale) {
            console.log('No TMT sales found');
            return;
        }

        console.log('TMT Sale ID:', tmtSale.id.toString());
        console.log('Customer:', tmtSale.customerName);
        console.log('\nItems:');

        tmtSale.items.forEach((item, idx) => {
            console.log(`\nItem ${idx + 1}:`);
            console.log('  Product:', item.product.productName);
            console.log('  Quantity:', item.quantity?.toString());
            console.log('  Unit:', item.unit);
            console.log('  Price Per Unit:', item.pricePerUnit?.toString());
            console.log('  Total Amount:', item.totalAmount?.toString());
            console.log('  All item fields:', Object.keys(item));
        });

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

checkTmtSaleItems();
