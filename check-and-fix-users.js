const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function checkAndFixUsers() {
  try {
    console.log('🔍 Checking and fixing users...');
    
    // Check existing users
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        password: true
      }
    });
    
    console.log(`Found ${users.length} users:`);
    
    // Update passwords and create shop assignments
    for (const user of users) {
      console.log(`\n👤 Processing ${user.name} (${user.role})...`);
      
      // Update password to a known value
      const newPassword = getPasswordForRole(user.role);
      const hashedPassword = await bcrypt.hash(newPassword, 12);
      
      await prisma.user.update({
        where: { id: user.id },
        data: { password: hashedPassword }
      });
      
      console.log(`  ✅ Password updated for ${user.email}`);
      console.log(`  📝 New password: ${newPassword}`);
      
      // Create shop assignment if doesn't exist
      const existingAssignment = await prisma.userShopAssignment.findFirst({
        where: {
          userId: user.id,
          active: true
        }
      });
      
      if (!existingAssignment) {
        // Get first available shop
        const firstShop = await prisma.shop.findFirst({
          where: { isActive: true }
        });
        
        if (firstShop) {
          await prisma.userShopAssignment.create({
            data: {
              userId: user.id,
              shopId: firstShop.id,
              role: user.role,
              active: true,
              assignedById: user.id // Self-assignment for now
            }
          });
          console.log(`  ✅ Shop assignment created for shop: ${firstShop.name}`);
        } else {
          console.log(`  ⚠️  No active shops found for assignment`);
        }
      } else {
        console.log(`  ✅ Shop assignment already exists`);
      }
    }
    
    console.log('\n🎉 All users updated successfully!');
    console.log('\n📋 Updated User Credentials:');
    users.forEach(user => {
      const password = getPasswordForRole(user.role);
      console.log(`  ${user.email} (${user.role}): ${password}`);
    });
    
  } catch (error) {
    console.error('❌ Error checking and fixing users:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

function getPasswordForRole(role) {
  switch (role) {
    case 'SUPER_DUPER_ADMIN':
      return 'SuperDuperAdmin@123';
    case 'SUPER_ADMIN':
      return 'SuperAdmin@123';
    case 'ADMIN':
      return 'Admin@123';
    case 'STAFF':
      return 'Staff@123';
    default:
      return 'Password@123';
  }
}

checkAndFixUsers(); 