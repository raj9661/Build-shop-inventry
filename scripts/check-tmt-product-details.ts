
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const saleId = 26n;

    const sale = await prisma.tmtSale.findUnique({
        where: { id: saleId },
        include: {
            items: {
                include: {
                    product: true
                }
            }
        }
    });

    if (sale && sale.items.length > 0) {
        console.log('--- DETAILS ---');
        console.log(`Product Name: "${sale.items[0].product.productName}"`);
        console.log(`Unit Type: "${sale.items[0].unitType}"`);
        console.log('--- END ---');
    } else {
        console.log('Sale or items not found.');
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
