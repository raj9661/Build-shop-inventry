const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function fixCustomerBalances() {
  try {
    console.log('🔄 Starting customer balance fix...\n');

    // Get all non-walk-in customers
    const customers = await prisma.customer.findMany({
      where: { isWalkIn: false },
      select: { id: true, name: true, currentBalance: true }
    });

    console.log(`📊 Found ${customers.length} customers to process...\n`);

    let fixedCount = 0;
    let totalDiscrepancy = 0;

    for (const customer of customers) {
      console.log(`Processing customer: ${customer.name} (ID: ${customer.id})`);
      
      // Get all ledger entries for this customer
      const entries = await prisma.customerLedgerEntry.findMany({
        where: {
          customerId: customer.id,
          isActive: true
        },
        orderBy: [
          { date: 'asc' },
          { id: 'asc' }
        ]
      });

      // Calculate correct running balance
      let runningBalance = 0;
      for (const entry of entries) {
        runningBalance += Number(entry.debitAmount) - Number(entry.creditAmount);
        
        // Update entry balance
        await prisma.customerLedgerEntry.update({
          where: { id: entry.id },
          data: { balance: runningBalance }
        });
      }

      // Check if there's a discrepancy
      const oldBalance = Number(customer.currentBalance) || 0;
      const newBalance = runningBalance;
      const discrepancy = Math.abs(oldBalance - newBalance);

      if (discrepancy > 0.01) { // Allow for small rounding differences
        console.log(`  ❌ Balance discrepancy found:`);
        console.log(`     Old balance: ₹${oldBalance.toLocaleString()}`);
        console.log(`     New balance: ₹${newBalance.toLocaleString()}`);
        console.log(`     Difference: ₹${discrepancy.toLocaleString()}`);
        
        // Update customer's current balance
        await prisma.customer.update({
          where: { id: customer.id },
          data: { currentBalance: newBalance }
        });
        
        fixedCount++;
        totalDiscrepancy += discrepancy;
      } else {
        console.log(`  ✅ Balance is correct: ₹${newBalance.toLocaleString()}`);
      }

      console.log(`  📈 Total entries: ${entries.length}`);
      console.log('');
    }

    console.log('🎉 Customer balance fix completed!');
    console.log(`📊 Summary:`);
    console.log(`   - Total customers processed: ${customers.length}`);
    console.log(`   - Customers with fixed balances: ${fixedCount}`);
    console.log(`   - Total discrepancy amount: ₹${totalDiscrepancy.toLocaleString()}`);
    
    if (fixedCount > 0) {
      console.log(`\n✅ All customer balances are now synchronized with their ledger entries!`);
    } else {
      console.log(`\n✅ All customer balances were already correct!`);
    }

  } catch (error) {
    console.error('❌ Error fixing customer balances:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the fix
fixCustomerBalances(); 