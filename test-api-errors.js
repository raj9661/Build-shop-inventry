const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testAPIErrors() {
  try {
    console.log('🔍 Testing API endpoints for errors...\n');

    // Test 1: Check if customers table exists and has data
    console.log('📊 Test 1: Checking customers table...');
    try {
      const customerCount = await prisma.customer.count({
        where: { isWalkIn: false }
      });
      console.log(`✅ Found ${customerCount} non-walk-in customers`);
      
      if (customerCount > 0) {
        const sampleCustomer = await prisma.customer.findFirst({
          where: { isWalkIn: false },
          select: { id: true, name: true, shopId: true, isActive: true }
        });
        console.log(`✅ Sample customer:`, sampleCustomer);
      }
    } catch (error) {
      console.error('❌ Error accessing customers table:', error.message);
    }

    // Test 2: Check if ledger entries table exists and has data
    console.log('\n📊 Test 2: Checking ledger entries table...');
    try {
      const ledgerCount = await prisma.customerLedgerEntry.count();
      console.log(`✅ Found ${ledgerCount} ledger entries`);
      
      if (ledgerCount > 0) {
        const sampleEntry = await prisma.customerLedgerEntry.findFirst({
          select: { id: true, customerId: true, date: true, description: true }
        });
        console.log(`✅ Sample ledger entry:`, sampleEntry);
      }
    } catch (error) {
      console.error('❌ Error accessing ledger entries table:', error.message);
    }

    // Test 3: Test the specific query that might be failing
    console.log('\n📊 Test 3: Testing customer query with shop filter...');
    try {
      const customers = await prisma.customer.findMany({
        where: {
          shopId: 2,
          isWalkIn: false
        },
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          address: true,
          isActive: true,
          currentBalance: true,
          createdAt: true,
          shop: {
            select: { 
              id: true, 
              name: true 
            }
          }
        },
        take: 100,
        orderBy: [
          { isActive: 'desc' },
          { name: 'asc' }
        ]
      });
      console.log(`✅ Found ${customers.length} customers for shop 2`);
    } catch (error) {
      console.error('❌ Error in customer query:', error.message);
      console.error('Full error:', error);
    }

    // Test 4: Test ledger query
    console.log('\n📊 Test 4: Testing ledger query...');
    try {
      const entries = await prisma.customerLedgerEntry.findMany({
        where: {
          customerId: 5,
          isActive: true
        },
        include: {
          items: {
            select: {
              id: true,
              quantity: true,
              unitPrice: true,
              totalAmount: true,
              description: true,
              unit: true
            }
          }
        },
        orderBy: [
          { date: 'desc' },
          { id: 'desc' }
        ],
        take: 200
      });
      console.log(`✅ Found ${entries.length} ledger entries for customer 5`);
    } catch (error) {
      console.error('❌ Error in ledger query:', error.message);
      console.error('Full error:', error);
    }

    // Test 5: Check database indexes
    console.log('\n📊 Test 5: Checking database indexes...');
    try {
      const indexes = await prisma.$queryRaw`
        SELECT 
          indexname, 
          tablename, 
          indexdef 
        FROM pg_indexes 
        WHERE tablename IN ('Customer', 'CustomerLedgerEntry')
        AND indexname LIKE 'idx_%'
        ORDER BY tablename, indexname;
      `;
      console.log(`✅ Found ${indexes.length} performance indexes`);
      indexes.forEach(index => {
        console.log(`   - ${index.indexname} on ${index.tablename}`);
      });
    } catch (error) {
      console.error('❌ Error checking indexes:', error.message);
    }

    console.log('\n🎯 API Error Analysis Complete!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testAPIErrors(); 