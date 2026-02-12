const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function clearCache() {
  try {
    console.log('🧹 Clearing shop assignment cache...');

    // Find the SUPER_DUPER_ADMIN user
    const superDuperAdmin = await prisma.user.findFirst({
      where: { role: 'SUPER_DUPER_ADMIN' }
    });

    if (!superDuperAdmin) {
      console.log('❌ No SUPER_DUPER_ADMIN user found!');
      return;
    }

    console.log(`👑 Found SUPER_DUPER_ADMIN: ${superDuperAdmin.name} (${superDuperAdmin.email})`);

    // Check current assignments
    const assignments = await prisma.userShopAssignment.findMany({
      where: {
        userId: superDuperAdmin.id,
        active: true
      },
      include: {
        shop: {
          select: { id: true, name: true, location: true }
        }
      }
    });

    console.log(`🔗 Current assignments: ${assignments.length}`);
    assignments.forEach(assignment => {
      console.log(`  - ${assignment.shop.name} (${assignment.shop.location})`);
    });

    // Check all active shops
    const allShops = await prisma.shop.findMany({
      where: { isActive: true },
      select: { id: true, name: true, location: true }
    });

    console.log(`🏪 All active shops: ${allShops.length}`);
    allShops.forEach(shop => {
      console.log(`  - ${shop.name} (${shop.location})`);
    });

    console.log('\n✅ Cache check completed!');
    console.log('🔄 Now restart your app and try logging in again.');

  } catch (error) {
    console.error('❌ Error clearing cache:', error);
  } finally {
    await prisma.$disconnect();
  }
}

clearCache(); 