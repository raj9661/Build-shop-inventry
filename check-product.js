const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkProduct() {
    try {
        const product = await prisma.tmtProduct.findUnique({
            where: { id: 2n }
        });

        if (product) {
            console.log('\n=== TMT Product Details ===');
            console.log('Product ID:', product.id.toString());
            console.log('Product Name:', product.productName);
            console.log('weightPerRodKg:', product.weightPerRodKg.toString());
            console.log('rodsPerBundle:', product.rodsPerBundle);
            console.log('weightPerBundleKg:', product.weightPerBundleKg.toString());
            console.log('\n=== Calculations ===');
            const rodWeight = Number(product.weightPerRodKg);
            const bundleWeight = Number(product.weightPerBundleKg);
            const rodsPerBundle = Number(product.rodsPerBundle);
            console.log('Expected bundle weight (rods × rod weight):', (rodsPerBundle * rodWeight).toFixed(3), 'kg');
            console.log('Actual bundle weight from DB:', bundleWeight, 'kg');
            console.log('Difference:', (bundleWeight - (rodsPerBundle * rodWeight)).toFixed(3), 'kg');
        } else {
            console.log('Product not found');
        }
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkProduct();
