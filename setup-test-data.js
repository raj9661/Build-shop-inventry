const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function setupTestData() {
  try {
    console.log('=== Setting up Test Data ===');
    
    // Create a test shop
    const shop = await prisma.shop.create({
      data: {
        name: 'Branch Store - North',
        location: 'North Location',
        phone: '1234567890',
        email: 'north@store.com',
        address: 'North Address',
        gstNo: 'GST123456789'
      }
    });
    console.log(`Created shop: ${shop.name} (ID: ${shop.id})`);
    
    // Create TMT companies
    const tataCompany = await prisma.tmtCompany.create({
      data: {
        name: 'TATA Tiscon',
        shopId: shop.id
      }
    });
    
    const rungtaCompany = await prisma.tmtCompany.create({
      data: {
        name: 'Rungta Steel',
        shopId: shop.id
      }
    });
    console.log(`Created companies: ${tataCompany.name}, ${rungtaCompany.name}`);
    
    // Create TMT sizes
    const sizes = [6, 8, 10, 12];
    const createdSizes = [];
    
    for (const size of sizes) {
      const tmtSize = await prisma.tmtSize.create({
        data: {
          sizeMm: size,
          shopId: shop.id
        }
      });
      createdSizes.push(tmtSize);
    }
    console.log(`Created sizes: ${sizes.join('mm, ')}mm`);
    
    // Create TMT products
    const products = [];
    
    // TATA Tiscon products
    for (const size of createdSizes) {
      const product = await prisma.tmtProduct.create({
        data: {
          productName: `TATA Tiscon ${size.sizeMm}mm TMT Bar`,
          companyId: tataCompany.id,
          sizeId: size.id,
          weightPerRodKg: 4.5,
          rodsPerBundle: 20,
          weightPerBundleKg: 90,
          shopId: shop.id
        }
      });
      products.push(product);
    }
    
    // Rungta Steel products
    for (const size of createdSizes) {
      const product = await prisma.tmtProduct.create({
        data: {
          productName: `Rungta Steel ${size.sizeMm}mm TMT Bar`,
          companyId: rungtaCompany.id,
          sizeId: size.id,
          weightPerRodKg: 4.5,
          rodsPerBundle: 20,
          weightPerBundleKg: 90,
          shopId: shop.id
        }
      });
      products.push(product);
    }
    console.log(`Created ${products.length} TMT products`);
    
    // Create initial inventory entries (simulating the old system with separate entries)
    const rungta6mm = products.find(p => p.productName.includes('Rungta Steel 6mm'));
    
    // First inventory entry (1000kg)
    await prisma.tmtInventory.create({
      data: {
        productId: rungta6mm.id,
        shopId: shop.id,
        availableQtyKg: 1000,
        lastUpdated: new Date('2025-10-12T01:07:21Z')
      }
    });
    
    // Second inventory entry (10000kg from inv999)
    await prisma.tmtInventory.create({
      data: {
        productId: rungta6mm.id,
        shopId: shop.id,
        availableQtyKg: 10000,
        lastUpdated: new Date('2025-10-12T11:13:36Z')
      }
    });
    
    console.log(`Created duplicate inventory entries for Rungta Steel 6mm:`);
    console.log(`- Entry 1: 1000kg (old)`);
    console.log(`- Entry 2: 10000kg (from inv999)`);
    console.log(`- Total should be: 11000kg`);
    
    // Create other inventory entries
    for (const product of products.filter(p => p.id !== rungta6mm.id)) {
      await prisma.tmtInventory.create({
        data: {
          productId: product.id,
          shopId: shop.id,
          availableQtyKg: product.productName.includes('8mm') ? 20000 : 1000,
          lastUpdated: new Date()
        }
      });
    }
    
    console.log(`Created inventory entries for all products`);
    
    // Create a test purchase (inv999)
    const purchase = await prisma.tmtPurchase.create({
      data: {
        invoiceNumber: 'inv999',
        supplierName: 'TMT Supplier',
        totalWeightTon: 10,
        dateReceived: new Date('2025-10-12T11:13:36Z'),
        remarks: 'Test purchase for aggregation fix',
        shopId: shop.id
      }
    });
    
    await prisma.tmtPurchaseItem.create({
      data: {
        purchaseId: purchase.id,
        productId: rungta6mm.id,
        quantity: 10,
        unitType: 'TON',
        weightPerRodKg: 4.5,
        rodsPerBundle: 20,
        weightPerBundleKg: 90,
        totalBundles: 111.11,
        totalPieces: 2222.22,
        equivalentKg: 10000,
        remarks: '10 tons of Rungta Steel 6mm'
      }
    });
    
    console.log(`Created test purchase: ${purchase.invoiceNumber}`);
    
    console.log('\n=== Test Data Setup Complete ===');
    console.log(`Shop ID: ${shop.id}`);
    console.log(`Total Products: ${products.length}`);
    console.log(`Rungta Steel 6mm Product ID: ${rungta6mm.id}`);
    console.log(`Expected Total Inventory: 28 tons (27 + 1 from inv999)`);
    
  } catch (error) {
    console.error('Error setting up test data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

setupTestData();
