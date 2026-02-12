const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixWalkInCustomers() {
  try {
    console.log('🔧 Fixing walk-in customers in database...\n');
    
    // Find all customers with "Walk-in" in their name
    const walkInCustomers = await prisma.customer.findMany({
      where: {
        OR: [
          { name: { contains: 'Walk-in', mode: 'insensitive' } },
          { name: { contains: 'walkin', mode: 'insensitive' } },
          { name: { contains: 'walk in', mode: 'insensitive' } }
        ]
      },
      select: {
        id: true,
        name: true,
        phone: true,
        isWalkIn: true,
        shopId: true
      }
    });

    console.log(`📊 Found ${walkInCustomers.length} potential walk-in customers:`);
    
    if (walkInCustomers.length > 0) {
      walkInCustomers.forEach(customer => {
        console.log(`  - ID: ${customer.id}, Name: "${customer.name}", Phone: "${customer.phone}", isWalkIn: ${customer.isWalkIn}`);
      });

      // Update all walk-in customers to have isWalkIn = true
      const updateResult = await prisma.customer.updateMany({
        where: {
          OR: [
            { name: { contains: 'Walk-in', mode: 'insensitive' } },
            { name: { contains: 'walkin', mode: 'insensitive' } },
            { name: { contains: 'walk in', mode: 'insensitive' } }
          ]
        },
        data: {
          isWalkIn: true
        }
      });

      console.log(`\n✅ Updated ${updateResult.count} walk-in customers to have isWalkIn = true`);
    } else {
      console.log('✅ No walk-in customers found that need fixing');
    }

    // Also check for customers with empty phone numbers (another indicator of walk-in customers)
    const emptyPhoneCustomers = await prisma.customer.findMany({
      where: {
        OR: [
          { phone: null },
          { phone: '' },
          { phone: ' ' }
        ],
        isWalkIn: false
      },
      select: {
        id: true,
        name: true,
        phone: true,
        isWalkIn: true,
        shopId: true
      }
    });

    console.log(`\n📊 Found ${emptyPhoneCustomers.length} customers with empty phone numbers:`);
    
    if (emptyPhoneCustomers.length > 0) {
      emptyPhoneCustomers.forEach(customer => {
        console.log(`  - ID: ${customer.id}, Name: "${customer.name}", Phone: "${customer.phone}", isWalkIn: ${customer.isWalkIn}`);
      });

      // Update customers with empty phone numbers to be walk-in customers
      const updateEmptyPhoneResult = await prisma.customer.updateMany({
        where: {
          OR: [
            { phone: null },
            { phone: '' },
            { phone: ' ' }
          ],
          isWalkIn: false
        },
        data: {
          isWalkIn: true
        }
      });

      console.log(`\n✅ Updated ${updateEmptyPhoneResult.count} customers with empty phone numbers to have isWalkIn = true`);
    }

    // Final verification
    const finalWalkInCount = await prisma.customer.count({
      where: { isWalkIn: true }
    });

    const totalCustomers = await prisma.customer.count();

    console.log(`\n📊 Final database state:`);
    console.log(`  - Total customers: ${totalCustomers}`);
    console.log(`  - Walk-in customers: ${finalWalkInCount}`);
    console.log(`  - Regular customers: ${totalCustomers - finalWalkInCount}`);

    console.log('\n✅ Walk-in customer fix completed successfully!');

  } catch (error) {
    console.error('❌ Error fixing walk-in customers:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
fixWalkInCustomers(); 