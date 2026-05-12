// Script to remove specific ring products by SKU and name patterns
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Find products by SKU pattern and name patterns
  const ringsProducts = await prisma.product.findMany({
    where: {
      OR: [
        { sku: { contains: 'RING', mode: 'insensitive' } },
        { name: { contains: 'Rings', mode: 'insensitive' } },
        { name: { contains: 'Ring', mode: 'insensitive' } },
        { name: { contains: 'ring', mode: 'insensitive' } }
      ]
    },
    select: { id: true, name: true, sku: true }
  });
  
  console.log('Found products to delete:');
  ringsProducts.forEach(p => {
    console.log(`- ${p.name} (SKU: ${p.sku})`);
  });
  
  const productIds = ringsProducts.map(p => p.id);
  
  if (productIds.length === 0) {
    console.log('No ring products found.');
    return;
  }
  
  // Delete related records first
  await prisma.stockEntry.deleteMany({ where: { productId: { in: productIds } } });
  await prisma.saleItem.deleteMany({ where: { productId: { in: productIds } } });
  await prisma.dailyProductPrice.deleteMany({ where: { productId: { in: productIds } } });
  await prisma.productSalesAnalytics.deleteMany({ where: { productId: { in: productIds } } });
  
  // Now delete the products
  const deleted = await prisma.product.deleteMany({ where: { id: { in: productIds } } });
  console.log(`Deleted ${deleted.count} ring products.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 