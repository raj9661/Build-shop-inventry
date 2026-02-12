const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkMultipleInventoryEntries() {
  try {
    console.log('=== Checking for Multiple Inventory Entries ===');
    
    const shopId = 2;
    
    // Get all inventory entries grouped by product
    const allInventory = await prisma.tmtInventory.findMany({
      where: { shopId: shopId },
      orderBy: [{ productId: 'asc' }, { createdAt: 'asc' }]
    });
    
    console.log(`\nAll inventory entries for shop ${shopId}:`);
    
    const groupedByProduct = {};
    allInventory.forEach(inv => {
      const productId = Number(inv.productId);
      if (!groupedByProduct[productId]) {
        groupedByProduct[productId] = [];
      }
      groupedByProduct[productId].push(inv);
    });
    
    Object.keys(groupedByProduct).forEach(productId => {
      const entries = groupedByProduct[productId];
      console.log(`\nProduct ID ${productId}: ${entries.length} entries`);
      
      let totalKg = 0;
      entries.forEach((entry, index) => {
        console.log(`  ${index + 1}. ${entry.availableQtyKg}kg (Created: ${entry.createdAt})`);
        totalKg += Number(entry.availableQtyKg);
      });
      
      console.log(`  Total: ${totalKg}kg`);
      
      if (entries.length > 1) {
        console.log(`  ❌ MULTIPLE ENTRIES FOUND! Should be aggregated to ${totalKg}kg`);
      }
    });
    
    // Check specifically for Rungta Steel 6mm (Product ID: 1114263753378463700)
    console.log('\n=== Checking Rungta Steel 6mm specifically ===');
    const rungta6mmEntries = await prisma.tmtInventory.findMany({
      where: {
        productId: 1114263753378463700,
        shopId: shopId
      },
      orderBy: { createdAt: 'asc' }
    });
    
    console.log(`Found ${rungta6mmEntries.length} entries for Rungta Steel 6mm:`);
    let totalRungta6mm = 0;
    rungta6mmEntries.forEach((entry, index) => {
      console.log(`  ${index + 1}. ${entry.availableQtyKg}kg (Created: ${entry.createdAt})`);
      totalRungta6mm += Number(entry.availableQtyKg);
    });
    console.log(`Total should be: ${totalRungta6mm}kg`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkMultipleInventoryEntries();
