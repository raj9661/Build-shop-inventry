const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkShopData() {
  try {
    console.log('🔍 Checking data for Balajee Traders shop...\n');

    const shopId = 10; // Balajee Traders

    // Check all data types
    const checks = [
      { name: 'Sales', query: prisma.sale.count({ where: { shopId: BigInt(shopId) } }) },
      { name: 'Payments', query: prisma.payment.count({ where: { shopId: BigInt(shopId) } }) },
      { name: 'Products', query: prisma.product.count({ where: { shopId: BigInt(shopId) } }) },
      { name: 'Customers', query: prisma.customer.count({ where: { shopId: BigInt(shopId) } }) },
      { name: 'Employees', query: prisma.employee.count({ where: { shopId: BigInt(shopId) } }) },
      { name: 'Suppliers', query: prisma.supplier.count({ where: { shopId: BigInt(shopId) } }) },
      { name: 'Expenses', query: prisma.expense.count({ where: { shopId: BigInt(shopId) } }) },
      { name: 'Stock Entries', query: prisma.stockEntry.count({ where: { shopId: BigInt(shopId) } }) },
      { name: 'Customer Ledger', query: prisma.customerLedgerEntry.count({ where: { shopId: BigInt(shopId) } }) }
    ];

    console.log('📊 Data counts for Balajee Traders:');
    for (const check of checks) {
      try {
        const count = await check.query;
        console.log(`  - ${check.name}: ${count}`);
      } catch (error) {
        console.log(`  - ${check.name}: ERROR - ${error.message}`);
      }
    }

    // Check if there are any shops with data
    console.log('\n🔍 Checking other shops for comparison...');
    const allShops = await prisma.shop.findMany({
      where: { isActive: true },
      select: { id: true, name: true, createdBy: true }
    });

    for (const shop of allShops) {
      const salesCount = await prisma.sale.count({ where: { shopId: shop.id } });
      const paymentsCount = await prisma.payment.count({ where: { shopId: shop.id } });
      
      console.log(`  - ${shop.name} (ID: ${shop.id}): ${salesCount} sales, ${paymentsCount} payments`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkShopData();
