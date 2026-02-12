const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verifyWalkInFiltering() {
  try {
    console.log('🔍 Verifying walk-in customer filtering...\n');
    
    // Check all customers
    const allCustomers = await prisma.customer.findMany({
      select: {
        id: true,
        name: true,
        phone: true,
        isWalkIn: true,
        shopId: true
      },
      orderBy: { id: 'asc' }
    });

    console.log('📊 All customers in database:');
    allCustomers.forEach(customer => {
      const walkInStatus = customer.isWalkIn ? '🚶 WALK-IN' : '👤 REGULAR';
      console.log(`  - ID: ${customer.id}, Name: "${customer.name}", Phone: "${customer.phone}", ${walkInStatus}`);
    });

    // Check walk-in customers specifically
    const walkInCustomers = allCustomers.filter(c => c.isWalkIn);
    const regularCustomers = allCustomers.filter(c => !c.isWalkIn);

    console.log(`\n📊 Summary:`);
    console.log(`  - Total customers: ${allCustomers.length}`);
    console.log(`  - Walk-in customers: ${walkInCustomers.length}`);
    console.log(`  - Regular customers: ${regularCustomers.length}`);

    // Check if any walk-in customers have ledger entries
    console.log('\n🔍 Checking ledger entries for walk-in customers...');
    
    for (const walkInCustomer of walkInCustomers) {
      const ledgerEntries = await prisma.customerLedgerEntry.findMany({
        where: { customerId: walkInCustomer.id },
        select: {
          id: true,
          description: true,
          debitAmount: true,
          creditAmount: true,
          date: true
        }
      });

      if (ledgerEntries.length > 0) {
        console.log(`  ⚠️  Walk-in customer ID ${walkInCustomer.id} has ${ledgerEntries.length} ledger entries:`);
        ledgerEntries.forEach(entry => {
          console.log(`    - Entry ID: ${entry.id}, Description: "${entry.description}", Date: ${entry.date}`);
        });
      } else {
        console.log(`  ✅ Walk-in customer ID ${walkInCustomer.id} has no ledger entries`);
      }
    }

    // Check if any walk-in customers have sales
    console.log('\n🔍 Checking sales for walk-in customers...');
    
    for (const walkInCustomer of walkInCustomers) {
      const sales = await prisma.sale.findMany({
        where: { customerId: walkInCustomer.id },
        select: {
          id: true,
          totalAmount: true,
          finalAmount: true,
          saleDate: true,
          paymentStatus: true
        }
      });

      if (sales.length > 0) {
        console.log(`  📦 Walk-in customer ID ${walkInCustomer.id} has ${sales.length} sales:`);
        sales.forEach(sale => {
          console.log(`    - Sale ID: ${sale.id}, Amount: ₹${sale.finalAmount}, Date: ${sale.saleDate}, Status: ${sale.paymentStatus}`);
        });
      } else {
        console.log(`  ✅ Walk-in customer ID ${walkInCustomer.id} has no sales`);
      }
    }

    // Test the filtering logic that should be used in APIs
    console.log('\n🔍 Testing API filtering logic...');
    
    // Simulate the customers API filter
    const filteredCustomers = await prisma.customer.findMany({
      where: {
        isWalkIn: false // This is what the API should use
      },
      select: {
        id: true,
        name: true,
        phone: true,
        isWalkIn: true
      }
    });

    console.log(`  ✅ Customers API should return ${filteredCustomers.length} customers (excluding walk-ins):`);
    filteredCustomers.forEach(customer => {
      console.log(`    - ID: ${customer.id}, Name: "${customer.name}", Phone: "${customer.phone}"`);
    });

    console.log('\n✅ Walk-in customer filtering verification completed!');

  } catch (error) {
    console.error('❌ Error verifying walk-in customer filtering:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the verification
verifyWalkInFiltering(); 