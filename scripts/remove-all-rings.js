// Script to remove all 'Rings' products from the database
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Find all products where the name contains 'ring' (case-insensitive)
  const ringsProducts = await prisma.product.findMany({
    where: { name: { contains: 'ring', mode: 'insensitive' } },
    select: { id: true }
  });
  const productIds = ringsProducts.map(p => p.id);
  if (productIds.length === 0) {
    console.log('No products with "ring" in the name found.');
    return;
  }
  // Delete related records first
  await prisma.stockEntry.deleteMany({ where: { productId: { in: productIds } } });
  await prisma.saleItem.deleteMany({ where: { productId: { in: productIds } } });
  await prisma.dailyProductPrice.deleteMany({ where: { productId: { in: productIds } } });
  await prisma.productSalesAnalytics.deleteMany({ where: { productId: { in: productIds } } });
  // Now delete the products
  const deleted = await prisma.product.deleteMany({ where: { id: { in: productIds } } });
  console.log(`Deleted ${deleted.count} products with 'ring' in the name.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 