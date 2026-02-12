const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testAnalyticsAPI() {
  try {
    console.log('🔍 Testing analytics API logic...\n');

    // 1. Find the SUPER_ADMIN user
    const superAdmin = await prisma.user.findFirst({
      where: { email: 'testuser01@gmail.com' },
      select: { id: true, name: true, email: true, role: true }
    });

    if (!superAdmin) {
      console.log('❌ SUPER_ADMIN not found');
      return;
    }

    console.log('✅ SUPER_ADMIN found:', {
      id: superAdmin.id.toString(),
      name: superAdmin.name,
      email: superAdmin.email,
      role: superAdmin.role
    });

    // 2. Test shop assignments logic
    console.log('\n🔍 Testing shop assignments logic...');
    const assignments = await prisma.userShopAssignment.findMany({
      where: {
        userId: superAdmin.id,
        active: true
      },
      include: {
        shop: {
          select: { id: true, name: true, isActive: true }
        }
      }
    });

    console.log('📋 Assignments found:', assignments.length);
    assignments.forEach(assignment => {
      console.log(`  - Shop: ${assignment.shop.name} (ID: ${assignment.shop.id}, Active: ${assignment.shop.isActive})`);
    });

    // 3. Test shop filter generation
    const activeShops = assignments
      .filter(assignment => assignment.shop.isActive)
      .map(assignment => assignment.shop.id);

    console.log('\n🔍 Active shop IDs:', activeShops.map(id => id.toString()));
    const shopFilter = { shopId: { in: activeShops } };
    console.log('🔍 Shop filter:', JSON.stringify(shopFilter, (key, value) => 
      typeof value === 'bigint' ? value.toString() : value, 2));

    // 4. Test payment breakdown query
    console.log('\n🔍 Testing payment breakdown query...');
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    const endDate = new Date();

    try {
      const paymentBreakdown = await prisma.payment.groupBy({
        by: ['method'],
        where: { 
          isActive: true,
          date: {
            gte: startDate,
            lte: endDate
          },
          ...shopFilter
        },
        _sum: { amount: true },
        _count: { id: true }
      });

      console.log('✅ Payment breakdown query successful:', paymentBreakdown);
    } catch (error) {
      console.error('❌ Payment breakdown query failed:', error);
    }

    // 5. Test shops query
    console.log('\n🔍 Testing shops query...');
    try {
      const shops = await prisma.shop.findMany({
        where: {
          id: { in: activeShops },
          isActive: true
        },
        select: { id: true, name: true, location: true }
      });

      console.log('✅ Shops query successful:', shops);
    } catch (error) {
      console.error('❌ Shops query failed:', error);
    }

    // 6. Test sales query
    console.log('\n🔍 Testing sales query...');
    try {
      const sales = await prisma.sale.aggregate({
        where: {
          isActive: true,
          saleDate: {
            gte: startDate,
            lte: endDate
          },
          ...shopFilter
        },
        _sum: { finalAmount: true },
        _count: { id: true }
      });

      console.log('✅ Sales query successful:', sales);
    } catch (error) {
      console.error('❌ Sales query failed:', error);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testAnalyticsAPI();
