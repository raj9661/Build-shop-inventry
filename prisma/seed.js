process.on('uncaughtException', err => { console.error(err); process.exit(1); });
const dotenv = require('dotenv');
// Try loading .env first
let result = dotenv.config({ path: '.env' });
if (!process.env.DATABASE_URL) {
  // If not found, try .env.local
  result = dotenv.config({ path: '.env.local' });
}
console.log('Loaded DATABASE_URL:', process.env.DATABASE_URL);
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  try {
    // Create initial SUPER_DUPER_ADMIN user
    const superDuperAdminPassword = await bcrypt.hash('SuperDuperAdmin@123', 12);
    
    const superDuperAdmin = await prisma.user.upsert({
      where: { email: 'superduperadmin@example.com' },
      update: {},
      create: {
        name: 'Super Duper Admin',
        username: 'superduperadmin',
        email: 'superduperadmin@example.com',
        phone: '+1234567890',
        password: superDuperAdminPassword,
        role: 'SUPER_DUPER_ADMIN',
        isActive: true
      }
    });

    console.log('✅ Created SUPER_DUPER_ADMIN user:', superDuperAdmin.email);

    // Create initial SUPER_ADMIN user
    const superAdminPassword = await bcrypt.hash('SuperAdmin@123', 12);
    
    const superAdmin = await prisma.user.upsert({
      where: { email: 'superadmin@example.com' },
      update: {},
      create: {
        name: 'Super Admin',
        username: 'superadmin',
        email: 'superadmin@example.com',
        phone: '+1234567891',
        password: superAdminPassword,
        role: 'SUPER_ADMIN',
        isActive: true,
        createdBy: superDuperAdmin.id,
        updatedBy: superDuperAdmin.id
      }
    });

    console.log('✅ Created SUPER_ADMIN user:', superAdmin.email);

    // Create initial ADMIN user
    const adminPassword = await bcrypt.hash('Admin@123', 12);
    
    const admin = await prisma.user.upsert({
      where: { email: 'admin@example.com' },
      update: {},
      create: {
        name: 'Admin User',
        username: 'admin',
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

    // Create initial STAFF user
    const staffPassword = await bcrypt.hash('Staff@123', 12);
    
    const staff = await prisma.user.upsert({
      where: { email: 'staff@example.com' },
      update: {},
      create: {
        name: 'Staff User',
        username: 'staff',
        email: 'staff@example.com',
        phone: '+1234567893',
        password: staffPassword,
        role: 'STAFF',
        isActive: true,
        createdBy: superDuperAdmin.id,
        updatedBy: superDuperAdmin.id
      }
    });

    console.log('✅ Created STAFF user:', staff.email);

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
        isActive: true,
        createdBy: superDuperAdmin.id,
        updatedBy: superDuperAdmin.id
      }
    });

    console.log('✅ Created sample shops');

    // Note: Product categories are now created by seed-categories.js
    // This ensures global categories are available to all shops
    console.log('ℹ️ Product categories are managed by seed-categories.js');

    // Note: Product types are now created by seed-categories.js
    // This ensures global types are available to all shops
    console.log('ℹ️ Product types are managed by seed-categories.js');

    // Note: TMT bar types are now managed by TMT-specific seed scripts
    console.log('ℹ️ TMT bar types are managed by TMT-specific seed scripts');

    // Note: Sample products are not created by default
    // Users can create their own products through the UI
    console.log('ℹ️ Sample products are not created by default - users can create their own');

    // Create sample customers
    const customer1 = await prisma.customer.create({
      data: {
        name: 'Ramesh Kumar',
        phone: '9876543210',
        email: 'ramesh@example.com',
        address: 'Sector 15, Delhi',
        customerType: 'REGULAR',
        creditLimit: 50000.00,
        currentBalance: 0.00,
        shopId: mainShop.id,
        isActive: true,
        createdBy: superDuperAdmin.id,
        updatedBy: superDuperAdmin.id
      }
    });

    const customer2 = await prisma.customer.create({
      data: {
        name: 'Suresh Singh',
        phone: '9876543211',
        email: 'suresh@example.com',
        address: 'Model Town, Punjab',
        customerType: 'WHOLESALE',
        creditLimit: 100000.00,
        currentBalance: 0.00,
        shopId: mainShop.id,
        isActive: true,
        createdBy: superDuperAdmin.id,
        updatedBy: superDuperAdmin.id
      }
    });

    console.log('✅ Created sample customers');

    // Create sample suppliers
    const supplier1 = await prisma.supplier.create({
      data: {
        name: 'ABC Cement Suppliers',
        contactPerson: 'Mr. Amit Kumar',
        phone: '9876543220',
        email: 'abc@supplier.com',
        address: 'Industrial Area, Delhi',
        shopId: mainShop.id,
        isActive: true,
        createdBy: superDuperAdmin.id,
        updatedBy: superDuperAdmin.id
      }
    });

    const supplier2 = await prisma.supplier.create({
      data: {
        name: 'XYZ Steel Corporation',
        contactPerson: 'Ms. Priya Sharma',
        phone: '9876543221',
        email: 'xyz@supplier.com',
        address: 'Steel Market, Mumbai',
        shopId: mainShop.id,
        isActive: true,
        createdBy: superDuperAdmin.id,
        updatedBy: superDuperAdmin.id
      }
    });

    console.log('✅ Created sample suppliers');

    // Create sample employees
    const employee1 = await prisma.employee.create({
      data: {
        name: 'Alex Manager',
        phone: '+1234567898',
        email: 'employee1@shop.com',
        position: 'Store Manager',
        salary: 45000.00,
        shopId: mainShop.id,
        isActive: true,
        createdBy: superDuperAdmin.id,
        updatedBy: superDuperAdmin.id
      }
    });

    const employee2 = await prisma.employee.create({
      data: {
        name: 'Sam Sales',
        phone: '+1234567899',
        email: 'employee2@shop.com',
        position: 'Sales Representative',
        salary: 35000.00,
        shopId: mainShop.id,
        isActive: true,
        createdBy: superDuperAdmin.id,
        updatedBy: superDuperAdmin.id
      }
    });

    console.log('✅ Created sample employees');

    // Create sample stock entries
    const stockEntry1 = await prisma.stockEntry.create({
      data: {
        productId: cementProduct.id,
        supplierId: supplier1.id,
        shopId: mainShop.id,
        quantity: 100,
        unitPrice: 320.00,
        totalAmount: 32000.00,
        entryDate: new Date(),
        notes: 'Initial stock entry',
        isActive: true,
        createdBy: admin.id,
        updatedBy: admin.id
      }
    });

    const stockEntry2 = await prisma.stockEntry.create({
      data: {
        productId: steelProduct.id,
        supplierId: supplier2.id,
        shopId: mainShop.id,
        quantity: 5000,
        unitPrice: 60.00,
        totalAmount: 300000.00,
        entryDate: new Date(),
        notes: 'Steel stock entry',
        isActive: true,
        createdBy: admin.id,
        updatedBy: admin.id
      }
    });

    console.log('✅ Created sample stock entries');

    // Create sample sales
    const sale1 = await prisma.sale.create({
      data: {
        customerId: customer1.id,
        shopId: mainShop.id,
        saleDate: new Date(),
        totalAmount: 1750.00,
        discount: 0.00,
        taxAmount: 0.00,
        finalAmount: 1750.00,
        paymentStatus: 'COMPLETED',
        notes: 'Sample sale',
        isActive: true,
        createdBy: staff.id,
        updatedBy: staff.id
      }
    });

    // Create sale items
    await prisma.saleItem.create({
      data: {
        saleId: sale1.id,
        productId: cementProduct.id,
        quantity: 5,
        unitPrice: 350.00,
        totalPrice: 1750.00,
        discount: 0.00,
        createdBy: staff.id,
        updatedBy: staff.id
      }
    });

    console.log('✅ Created sample sales');

    // Create sample expenses
    const expense1 = await prisma.expense.create({
      data: {
        description: 'Electricity Bill - January',
        amount: 2500.00,
        category: 'utility',
        date: new Date(),
        shopId: mainShop.id,
        isActive: true,
        createdBy: admin.id,
        updatedBy: admin.id
      }
    });

    const expense2 = await prisma.expense.create({
      data: {
        description: 'Rent Payment',
        amount: 15000.00,
        category: 'rent',
        date: new Date(),
        shopId: mainShop.id,
        isActive: true,
        createdBy: admin.id,
        updatedBy: admin.id
      }
    });

    console.log('✅ Created sample expenses');

    // Create sample payments
    const payment1 = await prisma.payment.create({
      data: {
        saleId: sale1.id,
        amount: 1750.00,
        paymentMethod: 'CASH',
        paymentStatus: 'COMPLETED',
        paymentDate: new Date(),
        reference: 'PAY-001',
        notes: 'Payment for sale',
        shopId: mainShop.id,
        isActive: true,
        createdBy: staff.id,
        updatedBy: staff.id
      }
    });

    console.log('✅ Created sample payments');

    // Create sample activity logs
    await prisma.activityLog.createMany({
      data: [
        {
          userId: superDuperAdmin.id,
          action: 'user_login',
          resource: 'auth',
          resourceId: superDuperAdmin.id,
          details: 'User logged in successfully',
          ipAddress: '127.0.0.1',
          userAgent: 'Chrome/Windows'
        },
        {
          userId: admin.id,
          action: 'sale_create',
          resource: 'sales',
          resourceId: Number(sale1.id),
          details: 'Created new sale',
          ipAddress: '127.0.0.1',
          userAgent: 'Chrome/Windows'
        },
        {
          userId: staff.id,
          action: 'stock_entry_create',
          resource: 'stock',
          resourceId: Number(stockEntry1.id),
          details: 'Created stock entry',
          ipAddress: '127.0.0.1',
          userAgent: 'Chrome/Windows'
        }
      ],
      skipDuplicates: true
    });

    console.log('✅ Created sample activity logs');

    console.log('\n🎉 Database seeding completed successfully!');
    console.log('\n📋 Default Login Credentials:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔐 SUPER_DUPER_ADMIN:');
    console.log('   Email: superduperadmin@example.com');
    console.log('   Username: superduperadmin');
    console.log('   Password: SuperDuperAdmin@123');
    console.log('');
    console.log('🔐 SUPER_ADMIN:');
    console.log('   Email: superadmin@example.com');
    console.log('   Username: superadmin');
    console.log('   Password: SuperAdmin@123');
    console.log('');
    console.log('🔐 ADMIN:');
    console.log('   Email: admin@example.com');
    console.log('   Username: admin');
    console.log('   Password: Admin@123');
    console.log('');
    console.log('🔐 STAFF:');
    console.log('   Email: staff@example.com');
    console.log('   Username: staff');
    console.log('   Password: Staff@123');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n⚠️  IMPORTANT: Change these passwords in production!');

  } catch (error) {
    console.error('❌ Seeding error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  }); 