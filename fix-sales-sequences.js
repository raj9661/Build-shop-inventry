const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixSalesSequences() {
  try {
    console.log('🔧 Checking sales-related data and sequences...\n');
    
    // Check current data
    const sales = await prisma.sale.findMany({
      select: { id: true, totalAmount: true, createdAt: true }
    });
    
    const saleItems = await prisma.saleItem.findMany({
      select: { id: true, saleId: true, productId: true }
    });
    
    const payments = await prisma.payment.findMany({
      select: { id: true, amount: true, createdAt: true }
    });
    
    console.log(`📊 Current data counts:`);
    console.log(`  - Sales: ${sales.length}`);
    console.log(`  - Sale Items: ${saleItems.length}`);
    console.log(`  - Payments: ${payments.length}`);
    
    if (sales.length > 0) {
      console.log('\n💰 Sale IDs:', sales.map(s => s.id.toString()).sort((a, b) => BigInt(a) - BigInt(b)));
    }
    
    if (saleItems.length > 0) {
      console.log('\n🛍️ Sale Item IDs:', saleItems.map(si => si.id.toString()).sort((a, b) => BigInt(a) - BigInt(b)));
    }
    
    if (payments.length > 0) {
      console.log('\n💳 Payment IDs:', payments.map(p => p.id.toString()).sort((a, b) => BigInt(a) - BigInt(b)));
    }
    
    // For CockroachDB, we need to reset sequences manually
    console.log('\n🔄 Attempting to fix sequences...');
    
    // Try to create a test record to see if sequences work
    try {
      // Create a test sale to check if sequences work
      const testSale = await prisma.sale.create({
        data: {
          customerId: 1, // Assuming customer 1 exists
          shopId: 1, // Assuming shop 1 exists
          saleDate: new Date(),
          totalAmount: 0,
          finalAmount: 0,
          isActive: false, // Mark as inactive so it can be easily identified
          createdBy: 1,
          updatedBy: 1
        }
      });
      
      console.log(`✅ Test sale created with ID: ${testSale.id}`);
      
      // Delete the test sale
      await prisma.sale.delete({
        where: { id: testSale.id }
      });
      
      console.log('✅ Test sale deleted successfully');
      console.log('✅ Sequences appear to be working correctly');
      
    } catch (error) {
      console.error('❌ Error creating test sale:', error);
      console.log('💡 The issue might be with existing data or sequence conflicts');
    }
    
  } catch (error) {
    console.error('❌ Error checking sales sequences:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixSalesSequences(); 