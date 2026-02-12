// Check TMT product weights
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkProduct() {
    try {
        const product = await prisma.tmtProduct.findFirst({
            where: { productName: { contains: 'RUNGTA' } }
        });

        if (product) {
            console.log('\n=== RUNGTA STEEL 10MM ===');
            console.log(`Product ID: ${product.id}`);
            console.log(`Product Name: ${product.productName}`);
            console.log(`Weight Per Rod (piece): ${product.weightPerRodKg} kg`);
            console.log(`Rods Per Bundle: ${product.rodsPerBundle}`);
            console.log(`Weight Per Bundle: ${product.weightPerBundleKg} kg`);
            console.log(`Default Unit: ${product.defaultUnit}`);

            console.log('\n=== CALCULATIONS ===');
            console.log(`1 PIECE should subtract: ${product.weightPerRodKg} kg`);
            console.log(`1 BUNDLE should subtract: ${product.weightPerBundleKg} kg`);

            // Check inventory
            const inventory = await prisma.tmtInventory.findFirst({
                where: { productId: product.id }
            });

            if (inventory) {
                console.log('\n=== CURRENT INVENTORY ===');
                console.log(`Available: ${inventory.availableQtyKg} kg`);

                const weightPerRod = Number(product.weightPerRodKg);
                const rodsPerBundle = Number(product.rodsPerBundle);
                const weightPerBundle = Number(product.weightPerBundleKg);

                const totalKg = Number(inventory.availableQtyKg);
                const bundles = Math.floor(totalKg / weightPerBundle);
                const remainingKg = totalKg % weightPerBundle;
                const loosePieces = Math.floor(remainingKg / weightPerRod);

                console.log(`Calculated Bundles: ${bundles}`);
                console.log(`Calculated Loose Pieces: ${loosePieces}`);
                console.log(`Total Pieces: ${bundles * rodsPerBundle + loosePieces}`);
            }
        }
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkProduct();
