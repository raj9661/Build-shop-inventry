const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanupWalkInLedgerEntries() {
  try {
    console.log('🧹 Cleaning up walk-in customer ledger entries...\n');
    
    // Find all walk-in customers
    const walkInCustomers = await prisma.customer.findMany({
      where: { isWalkIn: true },
      select: {
        id: true,
        name: true,
        phone: true
      }
    });

    console.log(`📊 Found ${walkInCustomers.length} walk-in customers:`);
    walkInCustomers.forEach(customer => {
      console.log(`  - ID: ${customer.id}, Name: "${customer.name}", Phone: "${customer.phone}"`);
    });

    if (walkInCustomers.length === 0) {
      console.log('✅ No walk-in customers found to clean up');
      return;
    }

    // Find all ledger entries for walk-in customers
    const walkInCustomerIds = walkInCustomers.map(c => c.id);
    const ledgerEntries = await prisma.customerLedgerEntry.findMany({
      where: {
        customerId: { in: walkInCustomerIds }
      },
      select: {
        id: true,
        customerId: true,
        description: true,
        debitAmount: true,
        creditAmount: true,
        date: true
      }
    });

    console.log(`\n📊 Found ${ledgerEntries.length} ledger entries for walk-in customers:`);
    
    if (ledgerEntries.length > 0) {
      ledgerEntries.forEach(entry => {
        const customer = walkInCustomers.find(c => c.id === entry.customerId);
        console.log(`  - Entry ID: ${entry.id}, Customer: "${customer?.name}", Description: "${entry.description}", Date: ${entry.date}`);
      });

      // Get the ledger entry IDs
      const ledgerEntryIds = ledgerEntries.map(e => e.id);

      // Delete related CustomerLedgerItem records first
      console.log('\n🗑️  Deleting related ledger items...');
      const deletedItems = await prisma.customerLedgerItem.deleteMany({
        where: { ledgerEntryId: { in: ledgerEntryIds } }
      });
      console.log(`  ✅ Deleted ${deletedItems.count} ledger items`);

      // Delete the CustomerLedgerEntry records
      console.log('🗑️  Deleting ledger entries...');
      const deletedEntries = await prisma.customerLedgerEntry.deleteMany({
        where: { id: { in: ledgerEntryIds } }
      });
      console.log(`  ✅ Deleted ${deletedEntries.count} ledger entries`);

      console.log('\n✅ Walk-in customer ledger entries cleaned up successfully!');
    } else {
      console.log('✅ No ledger entries found for walk-in customers');
    }

    // Final verification
    const remainingLedgerEntries = await prisma.customerLedgerEntry.findMany({
      where: {
        customerId: { in: walkInCustomerIds }
      }
    });

    console.log(`\n📊 Verification: ${remainingLedgerEntries.length} ledger entries remaining for walk-in customers`);
    
    if (remainingLedgerEntries.length === 0) {
      console.log('✅ All walk-in customer ledger entries have been successfully removed');
    } else {
      console.log('⚠️  Some ledger entries still remain - manual cleanup may be needed');
    }

  } catch (error) {
    console.error('❌ Error cleaning up walk-in customer ledger entries:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the cleanup
cleanupWalkInLedgerEntries(); 