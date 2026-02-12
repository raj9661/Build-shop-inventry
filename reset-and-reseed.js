const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function resetAndReseed() {
  try {
    console.log('🗑️  Clearing existing data...\n');
    
    // Clear data in correct order to respect foreign key constraints
    await prisma.activityLog.deleteMany({});
    await prisma.loginLog.deleteMany({});
    await prisma.trustedDevice.deleteMany({});
    await prisma.user2FASetting.deleteMany({});
    await prisma.payment.deleteMany({});
    await prisma.saleItem.deleteMany({});
    await prisma.sale.deleteMany({});
    await prisma.stockEntry.deleteMany({});
    await prisma.employee.deleteMany({});
    await prisma.supplier.deleteMany({});
    await prisma.customer.deleteMany({});
    await prisma.product.deleteMany({});
    await prisma.productType.deleteMany({});
    await prisma.productCategory.deleteMany({});
    await prisma.expense.deleteMany({});
    await prisma.analyticsSummary.deleteMany({});
    await prisma.productSalesAnalytics.deleteMany({});
    await prisma.userShopAssignment.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.shop.deleteMany({});
    
    console.log('✅ All data cleared successfully');
    console.log('\n🌱 Re-seeding database...\n');
    
    // Run the seed script
    const { exec } = require('child_process');
    exec('node prisma/seed.js', (error, stdout, stderr) => {
      if (error) {
        console.error('❌ Error running seed script:', error);
        return;
      }
      if (stderr) {
        console.error('❌ Seed script stderr:', stderr);
        return;
      }
      console.log('✅ Seed script output:', stdout);
      console.log('\n🎉 Database reset and re-seeded successfully!');
    });
    
  } catch (error) {
    console.error('❌ Error resetting database:', error);
  } finally {
    await prisma.$disconnect();
  }
}

resetAndReseed(); 