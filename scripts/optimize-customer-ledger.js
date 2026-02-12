const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function optimizeCustomerLedger() {
  try {
    console.log('🔄 Starting customer ledger optimization...');

    // Add indexes for better performance
    console.log('📊 Adding database indexes...');
    
    // Index for customer search
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS idx_customer_search 
      ON "Customer" ("name", "phone", "email", "address") 
      WHERE "isWalkIn" = false;
    `;

    // Index for customer ledger entries by customer and date
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS idx_ledger_customer_date 
      ON "CustomerLedgerEntry" ("customerId", "date", "isActive");
    `;

    // Index for customer ledger entries by shop and customer
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS idx_ledger_shop_customer 
      ON "CustomerLedgerEntry" ("shopId", "customerId", "isActive");
    `;

    // Index for recent activity queries
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS idx_ledger_recent_activity 
      ON "CustomerLedgerEntry" ("customerId", "date", "debitAmount", "creditAmount", "isActive");
    `;

    // Index for customer by shop and active status
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS idx_customer_shop_active 
      ON "Customer" ("shopId", "isActive", "isWalkIn") 
      WHERE "isWalkIn" = false;
    `;

    console.log('✅ Database indexes added successfully!');

    // Update customer current balances
    console.log('💰 Updating customer current balances...');
    
    const customers = await prisma.customer.findMany({
      where: { isWalkIn: false },
      select: { id: true, name: true }
    });

    let updatedCount = 0;
    for (const customer of customers) {
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

      // Calculate running balance
      let runningBalance = 0;
      for (const entry of entries) {
        runningBalance += Number(entry.debitAmount) - Number(entry.creditAmount);
        
        // Update entry balance
        await prisma.customerLedgerEntry.update({
          where: { id: entry.id },
          data: { balance: runningBalance }
        });
      }

      // Update customer current balance
      await prisma.customer.update({
        where: { id: customer.id },
        data: { currentBalance: runningBalance }
      });

      updatedCount++;
      if (updatedCount % 10 === 0) {
        console.log(`📈 Updated ${updatedCount}/${customers.length} customers...`);
      }
    }

    console.log(`✅ Updated current balances for ${updatedCount} customers!`);

    // Add some sample data for testing if none exists
    const sampleCustomer = await prisma.customer.findFirst({
      where: { isWalkIn: false }
    });

    if (sampleCustomer) {
      const hasEntries = await prisma.customerLedgerEntry.findFirst({
        where: { customerId: sampleCustomer.id }
      });

      if (!hasEntries) {
        console.log('📝 Adding sample ledger entries for testing...');
        
        // Add sample entries
        const sampleEntries = [
          {
            customerId: sampleCustomer.id,
            date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
            description: 'Sample Purchase - Cement',
            debitAmount: 5000,
            creditAmount: 0,
            balance: 5000,
            shopId: sampleCustomer.shopId,
            isActive: true
          },
          {
            customerId: sampleCustomer.id,
            date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
            description: 'Payment (Cash)',
            debitAmount: 0,
            creditAmount: 2000,
            balance: 3000,
            shopId: sampleCustomer.shopId,
            isActive: true
          },
          {
            customerId: sampleCustomer.id,
            date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
            description: 'Sample Purchase - TMT Bars',
            debitAmount: 8000,
            creditAmount: 0,
            balance: 11000,
            shopId: sampleCustomer.shopId,
            isActive: true
          },
          {
            customerId: sampleCustomer.id,
            date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
            description: 'Payment (UPI)',
            debitAmount: 0,
            creditAmount: 6000,
            balance: 5000,
            shopId: sampleCustomer.shopId,
            isActive: true
          }
        ];

        for (const entry of sampleEntries) {
          await prisma.customerLedgerEntry.create({
            data: {
              ...entry,
              createdBy: 1,
              updatedBy: 1
            }
          });
        }

        console.log('✅ Sample ledger entries added!');
      }
    }

    console.log('🎉 Customer ledger optimization completed successfully!');
    console.log('\n📋 Summary:');
    console.log('- Added database indexes for better performance');
    console.log('- Updated customer current balances');
    console.log('- Added sample data for testing (if needed)');
    console.log('\n🚀 The customer ledger should now be much faster!');

  } catch (error) {
    console.error('❌ Error during optimization:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the optimization
optimizeCustomerLedger(); 