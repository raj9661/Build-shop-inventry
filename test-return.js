const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { calculateRunningBalance } = require('./app/lib/ledgerUtils');

async function testReturn() {
  console.log('🔄 Starting Return & Restock Test...');

  // 1. Fetch a customer and a product to use for testing
  const customer = await prisma.customer.findFirst({
    where: { isActive: true, name: { not: { startsWith: 'Walk-in' } } }
  });

  const product = await prisma.product.findFirst({
    where: { isActive: true }
  });

  if (!customer || !product) {
    console.error('❌ Failed to find active customer or product for testing.');
    return;
  }

  const customerId = customer.id;
  const productId = product.id;
  const shopId = customer.shopId;

  console.log(`👤 Testing with Customer: ${customer.name} (ID: ${customerId})`);
  console.log(`📦 Testing with Product: ${product.name} (ID: ${productId})`);

  const initialBalance = Number(customer.currentBalance);
  const initialStock = Number(product.stockQuantity);

  console.log(`📊 Initial Customer Balance: ₹${initialBalance}`);
  console.log(`📊 Initial Product Stock: ${initialStock} ${product.unit}`);

  const returnQuantity = 10;
  const creditAmount = 500; // ₹500 refund/credit

  let createdEntryId = null;

  try {
    // 2. Perform the return transaction
    await prisma.$transaction(async (tx) => {
      // Increment product stock
      await tx.product.update({
        where: { id: productId },
        data: { stockQuantity: { increment: returnQuantity } }
      });

      // Log in StockLedger
      await tx.stockLedger.create({
        data: {
          productId,
          shopId,
          transactionType: 'ADJUSTMENT',
          unitName: product.unit,
          unitQuantity: returnQuantity,
          cftQuantity: returnQuantity,
          notes: `TEST Customer Return - Restocked`
        }
      });

      // Create CustomerLedgerEntry
      const returnEntry = await tx.customerLedgerEntry.create({
        data: {
          customerId,
          amount: creditAmount,
          type: 'item_return',
          method: 'CASH',
          date: new Date(),
          description: `TEST Returned: ${product.name} x ${returnQuantity}`,
          shopId,
          isActive: true
        }
      });

      createdEntryId = returnEntry.id;

      // Recalculate running balance
      await calculateRunningBalance(tx, customerId, [returnEntry]);
    });

    // 3. Verify results
    const updatedCustomer = await prisma.customer.findUnique({
      where: { id: customerId }
    });
    const updatedProduct = await prisma.product.findUnique({
      where: { id: productId }
    });

    const finalBalance = Number(updatedCustomer.currentBalance);
    const finalStock = Number(updatedProduct.stockQuantity);

    console.log(`\n✅ Transaction executed. Checking results:`);
    console.log(`📊 Final Customer Balance: ₹${finalBalance}`);
    console.log(`📊 Final Product Stock: ${finalStock} ${product.unit}`);

    const expectedBalance = Math.max(0, initialBalance - creditAmount);
    const expectedStock = initialStock + returnQuantity;

    let success = true;

    if (finalStock !== expectedStock) {
      console.error(`❌ Stock mismatch! Expected: ${expectedStock}, Got: ${finalStock}`);
      success = false;
    } else {
      console.log(`   Stock matches! (+${returnQuantity})`);
    }

    if (finalBalance !== expectedBalance) {
      console.error(`❌ Balance mismatch! Expected: ${expectedBalance}, Got: ${finalBalance}`);
      success = false;
    } else {
      console.log(`   Balance matches! (-₹${creditAmount})`);
    }

    if (success) {
      console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY! 🎉');
    } else {
      console.log('\n❌ SOME TESTS FAILED! ❌');
    }

  } catch (error) {
    console.error('❌ Test failed with error:', error);
  } finally {
    // 4. CLEANUP: Revert everything to prevent dirtying the DB
    if (createdEntryId) {
      console.log('\n🧹 Cleaning up test data...');
      try {
        await prisma.$transaction(async (tx) => {
          // Decrement product stock
          await tx.product.update({
            where: { id: productId },
            data: { stockQuantity: { decrement: returnQuantity } }
          });

          // Delete test stock ledger entries
          await tx.stockLedger.deleteMany({
            where: { productId, notes: 'TEST Customer Return - Restocked' }
          });

          // Delete test customer ledger entry
          await tx.customerLedgerEntry.delete({
            where: { id: createdEntryId }
          });

          // Recalculate running balance again
          await calculateRunningBalance(tx, customerId, []);
        });
        console.log('🧹 Cleanup completed successfully.');
      } catch (cleanupError) {
        console.error('❌ Cleanup failed:', cleanupError);
      }
    }
    await prisma.$disconnect();
  }
}

testReturn();
