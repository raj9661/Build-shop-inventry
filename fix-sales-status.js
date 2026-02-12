const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function fixSalesStatus() {
  try {
    console.log('🔍 Starting sales status fix...');
    
    // Get all sales for analysis
    const allSales = await prisma.sale.findMany({
      include: {
        customer: true,
        payments: true,
        items: true
      },
      orderBy: { createdAt: 'desc' }
    });

    console.log(`📊 Found ${allSales.length} total sales`);

    let updatedCount = 0;
    let completedCount = 0;
    let cancelledCount = 0;
    let pendingCount = 0;

    for (const sale of allSales) {
      const paidAmount = Number(sale.paidAmount || 0);
      const finalAmount = Number(sale.finalAmount || 0);
      const dueAmount = Number(sale.dueAmount || 0);
      const currentStatus = sale.paymentStatus;

      let newStatus = currentStatus;
      let reason = '';

      // Logic to determine correct status
      if (paidAmount >= finalAmount && finalAmount > 0) {
        // Fully paid - mark as COMPLETED
        if (currentStatus !== 'COMPLETED') {
          newStatus = 'COMPLETED';
          reason = 'Fully paid sale';
          completedCount++;
        }
      } else if (dueAmount === finalAmount && paidAmount === 0) {
        // No payment made, full amount due - keep as PENDING (credit sale)
        if (currentStatus !== 'PENDING') {
          newStatus = 'PENDING';
          reason = 'Credit sale - no payment made';
          pendingCount++;
        }
      } else if (paidAmount > 0 && dueAmount > 0) {
        // Partial payment - mark as COMPLETED (since partial payments are considered completed)
        if (currentStatus !== 'COMPLETED') {
          newStatus = 'COMPLETED';
          reason = 'Partial payment made';
          completedCount++;
        }
      } else if (currentStatus === 'PENDING' && finalAmount === 0) {
        // Zero amount sale - mark as COMPLETED
        newStatus = 'COMPLETED';
        reason = 'Zero amount sale';
        completedCount++;
      }

      // Update if status changed
      if (newStatus !== currentStatus) {
        await prisma.sale.update({
          where: { id: sale.id },
          data: {
            paymentStatus: newStatus,
            updatedAt: new Date()
          }
        });
        updatedCount++;
        
        console.log(`✅ Updated Sale #${sale.id}: ${currentStatus} → ${newStatus} (${reason})`);
        console.log(`   Customer: ${sale.customer?.name || 'Unknown'}`);
        console.log(`   Amount: ₹${finalAmount}, Paid: ₹${paidAmount}, Due: ₹${dueAmount}`);
      }
    }

    console.log('\n📈 Summary:');
    console.log(`✅ Updated: ${updatedCount} sales`);
    console.log(`🟢 Completed: ${completedCount} sales`);
    console.log(`🟡 Pending: ${pendingCount} sales`);
    console.log(`🔴 Cancelled: ${cancelledCount} sales`);

    // Show current distribution
    const statusCounts = await prisma.sale.groupBy({
      by: ['paymentStatus'],
      _count: { id: true }
    });

    console.log('\n📊 Current Sales Distribution:');
    statusCounts.forEach(status => {
      console.log(`${status.paymentStatus}: ${status._count.id} sales`);
    });

  } catch (error) {
    console.error('❌ Error fixing sales status:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
fixSalesStatus()
  .then(() => {
    console.log('🎉 Sales status fix completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Script failed:', error);
    process.exit(1);
  }); 