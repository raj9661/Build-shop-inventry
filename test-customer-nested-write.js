// Script to quickly test API logic speed.
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testCustomerCreation() {
    const startTime = performance.now();
    try {
        const testName = "Performance Test Customer " + Math.floor(Math.random() * 1000);
        const testPhone = "999" + Math.floor(Math.random() * 9000000).toString().padStart(7, '0');
        const shopId = 1; // Assuming shop ID 1 exists
        const openingBalance = 500;

        console.log(`Creating customer: ${testName} with phone ${testPhone}`);

        // Nested write structure exactly like the API route
        const customer = await prisma.customer.create({
            data: {
                name: testName,
                phone: testPhone,
                shopId: shopId,
                isActive: true,
                currentBalance: openingBalance,
                ...(openingBalance > 0 && {
                ledgerEntries: {
                    create: {
                        date: new Date(),
                        description: 'Opening Balance',
                        amount: openingBalance,
                        type: 'opening_balance',
                        method: 'CASH',
                        shopId: shopId,
                        isActive: true
                    }
                }
                })
            },
            include: {
                shop: {
                    select: { id: true, name: true }
                }
            }
        });

        const endTime = performance.now();
        console.log('Customer created successfully:', customer.id);
        console.log(`Time taken: ${(endTime - startTime).toFixed(2)}ms`);

        // Clean up the test customer
        console.log('Cleaning up test customer...');
        await prisma.customerLedgerEntry.deleteMany({ where: { customerId: customer.id } });
        await prisma.customer.delete({ where: { id: customer.id } });
        console.log('Cleanup complete.');

    } catch (error) {
        console.error('Test failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

testCustomerCreation();
