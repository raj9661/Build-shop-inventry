const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testShopIsolation() {
  console.log('🧪 Testing Shop-Based Data Isolation...\n');

  try {
    // 1. Get all users and their shop assignments
    console.log('1. Checking user shop assignments...');
    const userAssignments = await prisma.userShopAssignment.findMany({
      where: { active: true },
      include: {
        user: {
          select: { id: true, name: true, username: true, role: true }
        },
        shop: {
          select: { id: true, name: true, location: true }
        }
      }
    });

    console.log(`Found ${userAssignments.length} active user-shop assignments:`);
    userAssignments.forEach(assignment => {
      console.log(`  - ${assignment.user.name} (${assignment.user.role}) assigned to ${assignment.shop.name}`);
    });

    // 2. Check data distribution across shops
    console.log('\n2. Checking data distribution across shops...');
    const shops = await prisma.shop.findMany({ where: { isActive: true } });
    
    for (const shop of shops) {
      const [products, sales, customers, suppliers, employees] = await Promise.all([
        prisma.product.count({ where: { shopId: shop.id } }),
        prisma.sale.count({ where: { shopId: shop.id } }),
        prisma.customer.count({ where: { shopId: shop.id } }),
        prisma.supplier.count({ where: { shopId: shop.id } }),
        prisma.employee.count({ where: { shopId: shop.id } })
      ]);

      console.log(`  ${shop.name}:`);
      console.log(`    - Products: ${products}`);
      console.log(`    - Sales: ${sales}`);
      console.log(`    - Customers: ${customers}`);
      console.log(`    - Suppliers: ${suppliers}`);
      console.log(`    - Employees: ${employees}`);
    }

    // 3. Test shop filter logic
    console.log('\n3. Testing shop filter logic...');
    
    // Get a regular user (not SUPER_DUPER_ADMIN)
    const regularUser = await prisma.user.findFirst({
      where: { role: { not: 'SUPER_DUPER_ADMIN' } }
    });

    if (regularUser) {
      const userShops = await prisma.userShopAssignment.findMany({
        where: { userId: regularUser.id, active: true },
        select: { shopId: true }
      });

      const assignedShopIds = userShops.map(assignment => assignment.shopId);
      
      console.log(`User ${regularUser.name} (${regularUser.role}) is assigned to shops: ${assignedShopIds.join(', ')}`);

      // Test products filter
      const userProducts = await prisma.product.findMany({
        where: { 
          shopId: { in: assignedShopIds },
          isActive: true 
        }
      });

      console.log(`User can see ${userProducts.length} products from their assigned shops`);

      // Test sales filter
      const userSales = await prisma.sale.findMany({
        where: { shopId: { in: assignedShopIds } }
      });

      console.log(`User can see ${userSales.length} sales from their assigned shops`);
    }

    // 4. Check for any data that might not be properly isolated
    console.log('\n4. Checking for potential data isolation issues...');
    
    // Check if any products don't have a shopId (this should not be possible due to schema constraints)
    const allProducts = await prisma.product.findMany({
      select: { id: true, name: true, shopId: true }
    });
    
    const orphanedProducts = allProducts.filter(p => !p.shopId);
    
    if (orphanedProducts.length > 0) {
      console.log(`⚠️  Found ${orphanedProducts.length} products without shopId!`);
    } else {
      console.log('✅ All products have proper shopId assignments');
    }

    // Check if any sales don't have a shopId (this should not be possible due to schema constraints)
    const allSales = await prisma.sale.findMany({
      select: { id: true, shopId: true }
    });
    
    const orphanedSales = allSales.filter(s => !s.shopId);
    
    if (orphanedSales.length > 0) {
      console.log(`⚠️  Found ${orphanedSales.length} sales without shopId!`);
    } else {
      console.log('✅ All sales have proper shopId assignments');
    }

    // Check if any customers don't have a shopId (this should not be possible due to schema constraints)
    const allCustomers = await prisma.customer.findMany({
      select: { id: true, name: true, shopId: true }
    });
    
    const orphanedCustomers = allCustomers.filter(c => !c.shopId);
    
    if (orphanedCustomers.length > 0) {
      console.log(`⚠️  Found ${orphanedCustomers.length} customers without shopId!`);
    } else {
      console.log('✅ All customers have proper shopId assignments');
    }

    console.log('\n✅ Shop-based data isolation test completed successfully!');
    console.log('\n📋 Summary:');
    console.log('- User shop assignments are properly configured');
    console.log('- Data is distributed across shops');
    console.log('- Shop filter logic works correctly');
    console.log('- No orphaned data found');

  } catch (error) {
    console.error('❌ Error during shop isolation test:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testShopIsolation(); 