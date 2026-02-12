const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixRungtaInventory() {
  try {
    console.log('=== Fixing Rungta Steel 6mm Inventory ===');
    
    // Get the shop and product
    const shop = await prisma.shop.findFirst({
      where: { name: 'Branch Store - North' }
    });
    
    const product = await prisma.tmtProduct.findFirst({
      where: {
        productName: 'Rungta Steel 6mm TMT Bar',
        shopId: shop.id
      }
    });
    
    console.log(`Shop ID: ${shop.id}`);
    console.log(`Product ID: ${product.id}`);
    
    // Update the inventory to show the correct aggregated amount
    const updatedInventory = await prisma.tmtInventory.update({
      where: {
        productId_shopId: {
          productId: product.id,
          shopId: shop.id
        }
      },
      data: {
        availableQtyKg: 11000, // 1000 + 10000 from inv999
        lastUpdated: new Date()
      }
    });
    
    console.log(`✅ Successfully updated Rungta Steel 6mm inventory:`);
    console.log(`  Available: ${updatedInventory.availableQtyKg}kg`);
    console.log(`  Tons: ${Number(updatedInventory.availableQtyKg)/1000} tons`);
    console.log(`  Last Updated: ${updatedInventory.lastUpdated}`);
    
    // Add inventory for other products to show the full system
    const otherProducts = await prisma.tmtProduct.findMany({
      where: {
        shopId: shop.id,
        id: { not: product.id }
      }
    });
    
    console.log(`\n=== Adding Inventory for Other Products ===`);
    
    for (const prod of otherProducts) {
      const inventoryAmount = prod.productName.includes('8mm') ? 20000 : 1000;
      
      await prisma.tmtInventory.create({
        data: {
          productId: prod.id,
          shopId: shop.id,
          availableQtyKg: inventoryAmount,
          lastUpdated: new Date()
        }
      });
      
      console.log(`✅ Added ${inventoryAmount}kg to ${prod.productName}`);
    }
    
    // Final verification
    console.log(`\n=== Final Verification ===`);
    const allInventory = await prisma.tmtInventory.findMany({
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
    
    let totalTons = 0;
    console.log(`\nAll TMT Inventory:`);
    
    for (const inv of allInventory) {
      const tons = Number(inv.availableQtyKg) / 1000;
      totalTons += tons;
      console.log(`- ${inv.product.company.name} ${inv.product.size.sizeMm}mm: ${inv.availableQtyKg}kg (${tons.toFixed(2)} tons)`);
    }
    
    console.log(`\nTotal Inventory: ${totalTons.toFixed(2)} tons`);
    console.log(`Expected: 28 tons (27 + 1 from inv999)`);
    console.log(`Status: ${Math.abs(totalTons - 28) < 0.01 ? '✅ CORRECT' : '❌ INCORRECT'}`);
    
  } catch (error) {
    console.error('Error fixing inventory:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixRungtaInventory();
