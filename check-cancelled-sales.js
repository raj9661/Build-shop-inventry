const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkCancelledSales() {
  try {
    console.log('🔍 Checking for cancelled sales in database...');
    
    // Get all sales with their notes and status
    const allSales = await prisma.sale.findMany({
      select: {
        id: true,
        paymentStatus: true,
        notes: true,
        customer: { select: { name: true } },
        finalAmount: true,
        paidAmount: true,
        dueAmount: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: { createdAt: 'desc' }
    });

    console.log(`📊 Found ${allSales.length} total sales`);

    // Look for sales that were cancelled
    const cancelledSales = allSales.filter(sale => {
      const notes = sale.notes || '';
      const isCancelledInNotes = notes.toLowerCase().includes('cancelled') || 
                                notes.toLowerCase().includes('cancel') ||
                                notes.toLowerCase().includes('रद्द');
      
      return isCancelledInNotes || sale.paymentStatus === 'CANCELLED';
    });

    console.log(`🔴 Found ${cancelledSales.length} potentially cancelled sales:`);
    
    cancelledSales.forEach(sale => {
      console.log(`\n📋 Sale #${sale.id}:`);
      console.log(`   Customer: ${sale.customer?.name || 'Unknown'}`);
      console.log(`   Status: ${sale.paymentStatus}`);
      console.log(`   Notes: ${sale.notes || 'No notes'}`);
      console.log(`   Amount: ₹${Number(sale.finalAmount)}`);
      console.log(`   Created: ${sale.createdAt}`);
      console.log(`   Updated: ${sale.updatedAt}`);
    });

    // Show current status distribution
    const statusCounts = await prisma.sale.groupBy({
      by: ['paymentStatus'],
      _count: { id: true }
    });

    console.log('\n📊 Current Sales Distribution:');
    statusCounts.forEach(status => {
      console.log(`${status.paymentStatus}: ${status._count.id} sales`);
    });

  } catch (error) {
    console.error('❌ Error checking cancelled sales:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
checkCancelledSales()
  .then(() => {
    console.log('🎉 Cancelled sales check completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Script failed:', error);
    process.exit(1);
  }); 