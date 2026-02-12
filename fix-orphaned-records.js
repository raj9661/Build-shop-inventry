const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function fixOrphanedRecords() {
  try {
    console.log('Checking for orphaned records...');
    
    // Check if shop with id=1 exists
    const shop1 = await prisma.shop.findUnique({
      where: { id: 1 }
    });
    
    if (!shop1) {
      console.log('Shop with id=1 does not exist, creating it...');
      
      // Create shop with id=1
      await prisma.shop.create({
        data: {
          id: 1,
          name: 'Default Shop',
          location: 'Default Location'
        }
      });
      
      console.log('Created shop with id=1');
    } else {
      console.log('Shop with id=1 already exists');
    }
    
    console.log('Orphaned records fixed successfully');
  } catch (error) {
    console.error('Error fixing orphaned records:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixOrphanedRecords(); 