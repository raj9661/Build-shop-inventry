const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testTmtInventory() {
  try {
    console.log('=== Testing TMT Inventory System ===');
    
    // Get the shop
    const shop = await prisma.shop.findFirst({
      where: { name: 'Branch Store - North' }
    });
    
    if (!shop) {
      console.log('❌ Shop not found');
      return;
    }
    
    console.log(`✅ Shop found: ${shop.name} (ID: ${shop.id})`);
    
    // Get TMT products for this shop
    const products = await prisma.tmtProduct.findMany({
      where: { shopId: shop.id },
      include: {
        company: true,
        size: true,
        inventory: {
          where: { shopId: shop.id }
        }
      }
    });
    
    console.log(`\n=== TMT Products and Inventory ===`);
    console.log(`Found ${products.length} products:`);
    
    let totalTons = 0;
    
    for (const product of products) {
      const inventory = product.inventory[0]; // Should only be one entry due to unique constraint
      const tons = inventory ? Number(inventory.availableQtyKg) / 1000 : 0;
      totalTons += tons;
      
      console.log(`\n- ${product.company.name} ${product.size.sizeMm}mm`);
      console.log(`  Product ID: ${product.id}`);
      console.log(`  Inventory entries: ${product.inventory.length}`);
      if (inventory) {
        console.log(`  Available: ${inventory.availableQtyKg}kg (${tons.toFixed(2)} tons)`);
        console.log(`  Last Updated: ${inventory.lastUpdated}`);
      } else {
        console.log(`  Available: 0kg (0.00 tons)`);
      }
    }
    
    console.log(`\n=== Summary ===`);
    console.log(`Total Products: ${products.length}`);
    console.log(`Total Tons Available: ${totalTons.toFixed(2)}`);
    
    // Test adding inventory (this should work)
    const rungta6mm = products.find(p => 
      p.company.name === 'Rungta Steel' && p.size.sizeMm === 6
    );
    
    if (rungta6mm) {
      console.log(`\n=== Testing Inventory Addition ===`);
      console.log(`Rungta Steel 6mm Product ID: ${rungta6mm.id}`);
      
      // Try to add more inventory (this should update the existing entry)
      try {
        const updatedInventory = await prisma.tmtInventory.update({
          where: {
            productId_shopId: {
              productId: rungta6mm.id,
              shopId: shop.id
            }
          },
          data: {
            availableQtyKg: 11000, // 1000 + 10000 from inv999
            lastUpdated: new Date()
          }
        });
        
        console.log(`✅ Successfully updated inventory:`);
        console.log(`  Available: ${updatedInventory.availableQtyKg}kg (${Number(updatedInventory.availableQtyKg)/1000} tons)`);
        console.log(`  Last Updated: ${updatedInventory.lastUpdated}`);
        
      } catch (error) {
        console.log(`❌ Error updating inventory: ${error.message}`);
      }
      
      // Try to create a duplicate entry (this should fail)
      try {
        await prisma.tmtInventory.create({
          data: {
            productId: rungta6mm.id,
            shopId: shop.id,
            availableQtyKg: 5000,
            lastUpdated: new Date()
          }
        });
        console.log(`❌ ERROR: Duplicate entry was created (this should not happen!)`);
      } catch (error) {
        console.log(`✅ Correctly prevented duplicate entry: ${error.code}`);
      }
    }
    
    console.log(`\n=== Final Verification ===`);
    const finalInventory = await prisma.tmtInventory.findMany({
      where: { shopId: shop.id },
      include: {
        product: {
          include: {
            company: true,
            size: true
          }
        }
      }
    });
    
    console.log(`Total inventory entries: ${finalInventory.length}`);
    console.log(`Expected: ${products.length} (one per product)`);
    
    const rungta6mmFinal = finalInventory.find(inv => 
      inv.product.company.name === 'Rungta Steel' && inv.product.size.sizeMm === 6
    );
    
    if (rungta6mmFinal) {
      console.log(`\nRungta Steel 6mm Final Status:`);
      console.log(`  Available: ${rungta6mmFinal.availableQtyKg}kg`);
      console.log(`  Expected: 11000kg (1000 + 10000 from inv999)`);
      console.log(`  Status: ${Number(rungta6mmFinal.availableQtyKg) === 11000 ? '✅ CORRECT' : '❌ INCORRECT'}`);
    }
    
  } catch (error) {
    console.error('Error testing TMT inventory:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testTmtInventory();
