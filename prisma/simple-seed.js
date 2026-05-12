const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting clean database seeding...');

  try {
    // Clear existing users
    await prisma.user.deleteMany({});
    console.log('✅ Cleared existing users');

    // Hash passwords
    const superDuperAdminPassword = await bcrypt.hash('admin123', 10);
    const superAdminPassword = await bcrypt.hash('super123', 10);
    const adminPassword = await bcrypt.hash('admin123', 10);
    const userPassword = await bcrypt.hash('user123', 10);

    // Create SUPER_DUPER_ADMIN user
    const superDuperAdmin = await prisma.user.create({
      data: {
        name: 'Super Duper Admin',
        username: 'superduperadmin',
        email: 'superduper@admin.com',
        phone: '+1234567890',
        password: superDuperAdminPassword,
        role: 'SUPER_DUPER_ADMIN',
        isActive: true
      }
    });

    console.log('✅ Created SUPER_DUPER_ADMIN user:', superDuperAdmin.email);

    // Create SUPER_ADMIN user
    const superAdmin = await prisma.user.create({
      data: {
        name: 'Super Admin',
        username: 'superadmin',
        email: 'super@admin.com',
        phone: '+1234567891',
        password: superAdminPassword,
        role: 'SUPER_ADMIN',
        isActive: true,
        createdBy: superDuperAdmin.id,
        updatedBy: superDuperAdmin.id
      }
    });

    console.log('✅ Created SUPER_ADMIN user:', superAdmin.email);

    // Create ADMIN user
    const admin = await prisma.user.create({
      data: {
        name: 'Admin User',
        username: 'adminuser',
        email: 'admin@example.com',
        phone: '+1234567892',
        password: adminPassword,
        role: 'ADMIN',
        isActive: true,
        createdBy: superDuperAdmin.id,
        updatedBy: superDuperAdmin.id
      }
    });

    console.log('✅ Created ADMIN user:', admin.email);

    // Create regular user
    const user = await prisma.user.create({
      data: {
        name: 'Regular User',
        username: 'regularuser',
        email: 'user@example.com',
        phone: '+1234567893',
        password: userPassword,
        role: 'STAFF',
        isActive: true,
        createdBy: superDuperAdmin.id,
        updatedBy: superDuperAdmin.id
      }
    });

    console.log('✅ Created USER:', user.email);

    // Create sample shops
    const mainShop = await prisma.shop.upsert({
      where: { id: 1 },
      update: {},
      create: {
        id: 1,
        name: 'Main Building Materials Store',
        location: '123 Main Street, City Center',
        phone: '+1234567890',
        email: 'main@shop.com',
        address: '123 Main Street, City Center, State 12345',
        gstNo: '22AAAAA0000A1Z5',
        isActive: true,
        createdBy: superDuperAdmin.id,
        updatedBy: superDuperAdmin.id
      }
    });

    const branchShop = await prisma.shop.upsert({
      where: { id: 2 },
      update: {},
      create: {
        id: 2,
        name: 'Branch Store - North',
        location: '456 North Avenue, Suburb',
        phone: '+1234567891',
        email: 'north@shop.com',
        address: '456 North Avenue, Suburb, State 12345',
        gstNo: '22BBBBB0000B2Z6',
        isActive: true,
        createdBy: superDuperAdmin.id,
        updatedBy: superDuperAdmin.id
      }
    });

    console.log('✅ Created sample shops');

    // Create a sample customer
    const customer = await prisma.customer.create({
      data: {
        name: 'Sample Customer',
        phone: '+1234567899',
        address: '789 Customer Lane, City',
        isActive: true,
        shopId: mainShop.id,
        createdBy: superDuperAdmin.id,
        updatedBy: superDuperAdmin.id
      }
    });

    // Create a sample sale with partial payment
    await prisma.sale.create({
      data: {
        customerId: customer.id,
        shopId: mainShop.id,
        saleDate: new Date(),
        totalAmount: 5000,
        discount: 500,
        taxAmount: 250,
        finalAmount: 4750,
        paidAmount: 2000,
        dueAmount: 2750,
        paymentStatus: 'PENDING',
        isActive: true,
        createdBy: superDuperAdmin.id,
        updatedBy: superDuperAdmin.id
      }
    });

    // Create Steel & Iron category
    const steelCategory = await prisma.productCategory.upsert({
      where: { name: 'Steel & Iron' },
      update: {},
      create: {
        name: 'Steel & Iron',
        description: 'All types of steel and iron products',
        isActive: true,
        createdBy: superDuperAdmin.id,
        updatedBy: superDuperAdmin.id
      }
    });

    // Seed TMT bar types with bundle sizes
    const tmtDiameters = [
      { name: '6mm', bundleSize: 16 },
      { name: '8mm', bundleSize: 12 },
      { name: '10mm', bundleSize: 8 },
      { name: '12mm', bundleSize: 5 },
      { name: '16mm', bundleSize: 3 },
      { name: '20mm', bundleSize: 2 }
    ];
    for (const dia of tmtDiameters) {
      await prisma.productType.upsert({
        where: { name: `TMT Bar ${dia.name}` },
        update: { bundleSize: dia.bundleSize, categoryId: steelCategory.id },
        create: {
          name: `TMT Bar ${dia.name}`,
          description: `${dia.name} TMT bar`,
          bundleSize: dia.bundleSize,
          isActive: true,
          category: { connect: { id: steelCategory.id } },
          createdBy: superDuperAdmin.id,
          updatedBy: superDuperAdmin.id,
          shop: { connect: { id: mainShop.id } }
        }
      });
    }

    console.log('🎉 Database seeding completed successfully!');
    console.log('\n Login Credentials:');
    console.log('SUPER_DUPER_ADMIN: superduper@admin.com / admin123');
    console.log('SUPER_ADMIN: super@admin.com / super123');
    console.log('ADMIN: admin@example.com / admin123');
    console.log('USER: user@example.com / user123');

  } catch (error) {
    console.error('❌ Error during seeding:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  }); 