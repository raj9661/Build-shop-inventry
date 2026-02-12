const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function fixCancelledSales() {
  try {
    console.log('🔍 Fixing cancelled sales status...');
    
    // Get all sales with notes
    const allSales = await prisma.sale.findMany({
      select: {
        id: true,
        paymentStatus: true,
        notes: true,
        customer: { select: { name: true } },
        finalAmount: true,
        paidAmount: true,
        dueAmount: true
      },
      orderBy: { createdAt: 'desc' }
    });

    console.log(`📊 Found ${allSales.length} total sales`);

    let updatedCount = 0;

    for (const sale of allSales) {
      const notes = sale.notes || '';
      const isCancelledInNotes = notes.toLowerCase().includes('cancelled') || 
                                notes.toLowerCase().includes('cancel') ||
                                notes.toLowerCase().includes('रद्द');
      
      // If notes indicate cancellation and status is not CANCELLED, update it
      if (isCancelledInNotes && sale.paymentStatus !== 'CANCELLED') {
        await prisma.sale.update({
          where: { id: sale.id },
          data: {
            paymentStatus: 'CANCELLED',
            updatedAt: new Date()
          }
        });
        
        updatedCount++;
        console.log(`✅ Updated Sale #${sale.id} to CANCELLED:`);
        console.log(`   Customer: ${sale.customer?.name || 'Unknown'}`);
        console.log(`   Notes: ${sale.notes}`);
        console.log(`   Amount: ₹${Number(sale.finalAmount)}`);
      }
    }

    console.log(`\n📈 Summary:`);
    console.log(`✅ Updated: ${updatedCount} sales to CANCELLED`);

    // Show final distribution
    const statusCounts = await prisma.sale.groupBy({
      by: ['paymentStatus'],
      _count: { id: true }
    });

    console.log('\n📊 Final Sales Distribution:');
    statusCounts.forEach(status => {
      console.log(`${status.paymentStatus}: ${status._count.id} sales`);
    });

  } catch (error) {
    console.error('❌ Error fixing cancelled sales:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
fixCancelledSales()
  .then(() => {
    console.log('🎉 Cancelled sales fix completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Script failed:', error);
    process.exit(1);
  }); 