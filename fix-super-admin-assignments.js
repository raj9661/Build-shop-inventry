const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function fixSuperAdminAssignments() {
  try {
    console.log('🔧 Fixing SUPER_DUPER_ADMIN shop assignments...\n');

    // Find the SUPER_DUPER_ADMIN user
    const superDuperAdmin = await prisma.user.findFirst({
      where: { role: 'SUPER_DUPER_ADMIN' }
    });

    if (!superDuperAdmin) {
      console.log('❌ No SUPER_DUPER_ADMIN user found!');
      return;
    }

    console.log(`👑 Found SUPER_DUPER_ADMIN: ${superDuperAdmin.name} (${superDuperAdmin.email})`);

    // Get all active shops
    const shops = await prisma.shop.findMany({
      where: { isActive: true }
    });

    console.log(`📊 Found ${shops.length} active shops`);

    // Check existing assignments
    const existingAssignments = await prisma.userShopAssignment.findMany({
      where: {
        userId: superDuperAdmin.id,
        active: true
      }
    });

    console.log(`🔗 Existing assignments: ${existingAssignments.length}`);

    // Create assignments for shops that don't have them
    const assignmentsToCreate = [];
    
    for (const shop of shops) {
      const existingAssignment = existingAssignments.find(a => a.shopId === shop.id);
      
      if (!existingAssignment) {
        assignmentsToCreate.push({
          userId: superDuperAdmin.id,
          shopId: shop.id,
          role: 'SUPER_DUPER_ADMIN',
          active: true,
          assignedById: superDuperAdmin.id // Self-assigned
        });
      }
    }

    if (assignmentsToCreate.length > 0) {
      console.log(`➕ Creating ${assignmentsToCreate.length} new assignments...`);
      
      const newAssignments = await prisma.userShopAssignment.createMany({
        data: assignmentsToCreate
      });

      console.log(`✅ Created ${newAssignments.count} assignments`);
    } else {
      console.log('✅ All assignments already exist');
    }

    // Verify the assignments
    const finalAssignments = await prisma.userShopAssignment.findMany({
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

    console.log('\n📋 Final SUPER_DUPER_ADMIN Assignments:');
    finalAssignments.forEach(assignment => {
      console.log(`  - ${assignment.shop.name} (${assignment.shop.location}) - ${assignment.role}`);
    });

    console.log(`\n🎉 SUPER_DUPER_ADMIN now has access to ${finalAssignments.length} shops!`);

  } catch (error) {
    console.error('❌ Error fixing assignments:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixSuperAdminAssignments(); 