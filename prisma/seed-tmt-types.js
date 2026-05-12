const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    // Find the Steel & Iron category
    const steelCategory = await prisma.productCategory.findFirst({
      where: { name: 'Steel & Iron' }
    });
    if (!steelCategory) throw new Error('Steel & Iron category not found');

    // Find the first shop (or update as needed)
    const mainShop = await prisma.shop.findFirst();
    if (!mainShop) throw new Error('No shop found');

    // Seed TMT bar types with bundle sizes
    const tmtDiameters = [
      { name: '6mm', bundleSize: 16 },
      { name: '8mm', bundleSize: 12 },
      { name: '10mm', bundleSize: 8 },
      { name: '12mm', bundleSize: 5 },
      { name: '16mm', bundleSize: 3 },
      { name: '20mm', bundleSize: 2 }
    ];
    for (const dia of tmtDiameters) {
      await prisma.productType.upsert({
        where: { name: `TMT Bar ${dia.name}` },
        update: { bundleSize: dia.bundleSize, categoryId: steelCategory.id },
        create: {
          name: `TMT Bar ${dia.name}`,
          description: `${dia.name} TMT bar`,
          bundleSize: dia.bundleSize,
          isActive: true,
          category: { connect: { id: steelCategory.id } },
          shop: { connect: { id: mainShop.id } }
        }
      });
      console.log(`Seeded: TMT Bar ${dia.name} (bundleSize: ${dia.bundleSize})`);
    }
    console.log('✅ TMT bar types seeded successfully!');
  } catch (error) {
    console.error('❌ Error seeding TMT bar types:', error);
  } finally {
    await prisma.$disconnect();
  }
}

async function updateTmtBundleSizes() {
  const bundleSizes = {
    '6mm': 16,
    '8mm': 12,
    '10mm': 8,
    '12mm': 5,
    '16mm': 3,
    '20mm': 2
  };
  const tmtTypes = await prisma.productType.findMany({
    where: {
      name: { contains: 'tmt', mode: 'insensitive' }
    }
  });
  for (const type of tmtTypes) {
    const size = Object.keys(bundleSizes).find(sz => type.name.toLowerCase().includes(sz));
    if (size) {
      await prisma.productType.update({
        where: { id: type.id },
        data: { bundleSize: bundleSizes[size] }
      });
      console.log(`Updated ${type.name} to bundleSize ${bundleSizes[size]}`);
    } else {
      console.log(`Skipped ${type.name} (no size match)`);
    }
  }
}

updateTmtBundleSizes().then(() => prisma.$disconnect());

main(); 