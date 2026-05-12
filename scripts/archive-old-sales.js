// This script archives (sets isActive=false) completed or cancelled sales older than 7 days.
// Intended to be run automatically every 7 days (e.g., via cron or scheduler).
const { PrismaClient } = require('@prisma/client');
const dayjs = require('dayjs');

const prisma = new PrismaClient();

async function archiveOldSales() {
  try {
    const cutoffDate = dayjs().subtract(7, 'day').toDate();
    console.log('Archiving completed/cancelled sales older than 7 days (cutoff:', cutoffDate, ')');

    // Find all completed or cancelled sales older than 7 days and still active
    const oldSales = await prisma.sale.findMany({
      where: {
        isActive: true,
        paymentStatus: { in: ['COMPLETED', 'CANCELLED'] },
        createdAt: { lt: cutoffDate }
      },
      select: { id: true, paymentStatus: true, createdAt: true }
    });

    if (oldSales.length === 0) {
      console.log('No old completed/cancelled sales to archive.');
      return;
    }

    // Archive them
    const ids = oldSales.map(s => s.id);
    await prisma.sale.updateMany({
      where: { id: { in: ids } },
      data: { isActive: false }
    });

    console.log(`Archived ${ids.length} sales (set isActive=false):`);
    oldSales.forEach(sale => {
      console.log(`  Sale #${sale.id} (${sale.paymentStatus}) created at ${sale.createdAt}`);
    });
  } catch (error) {
    console.error('Error archiving old sales:', error);
  } finally {
    await prisma.$disconnect();
  }
}

archiveOldSales()
  .then(() => {
    console.log('✅ Archive script completed.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('💥 Script failed:', err);
    process.exit(1);
  }); 