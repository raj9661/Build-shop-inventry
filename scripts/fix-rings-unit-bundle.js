// Script to update all existing 'Rings' products to have unit 'bundle'
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const ringsCategory = await prisma.productCategory.findFirst({
    where: { name: { contains: 'ring', mode: 'insensitive' } },
  });
  if (!ringsCategory) {
    console.log('No category found for Rings.');
    return;
  }
  const updated = await prisma.product.updateMany({
    where: { categoryId: ringsCategory.id },
    data: { unit: 'bundle' }, // Optionally add: price: NEW_BUNDLE_PRICE
  });
  console.log(`Updated ${updated.count} products to unit 'bundle' in category '${ringsCategory.name}'.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 