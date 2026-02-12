const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function addTestData() {
  try {
    console.log('🔍 Adding test data to the database...');

    // Create a test shop
    const shop = await prisma.shop.create({
      data: {
        name: "Main Building Materials Store",
        location: "123 Main Street, City Center",
        phone: "+91-9876543210",
        email: "main@buildingmaterials.com",
        address: "123 Main Street, City Center, State - 123456",
        gstNo: "GST123456789",
        isActive: true
      }
    });
    console.log('✅ Shop created:', shop.name);

    // Create a test user (if not exists)
    const existingUser = await prisma.user.findFirst({
      where: { email: 'admin@test.com' }
    });

    let user;
    if (!existingUser) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      user = await prisma.user.create({
        data: {
          name: "Test Admin",
          username: "testadmin",
          email: "admin@test.com",
          password: hashedPassword,
          role: "SUPER_DUPER_ADMIN",
          phone: "+91-9876543210",
          isActive: true
        }
      });
      console.log('✅ User created:', user.name);
    } else {
      user = existingUser;
      console.log('✅ User already exists:', user.name);
    }

    // Create some test customers
    const customers = await Promise.all([
      prisma.customer.create({
        data: {
          name: "John Doe",
          phone: "+91-9876543211",
          email: "john@example.com",
          address: "456 Oak Street, City",
          customerType: "REGULAR",
          creditLimit: 10000,
          currentBalance: 0,
          shopId: shop.id,
          isActive: true
        }
      }),
      prisma.customer.create({
        data: {
          name: "Jane Smith",
          phone: "+91-9876543212",
          email: "jane@example.com",
          address: "789 Pine Street, City",
          customerType: "WHOLESALE",
          creditLimit: 50000,
          currentBalance: 0,
          shopId: shop.id,
          isActive: true
        }
      })
    ]);
    console.log('✅ Customers created:', customers.length);

    // Create some test products
    const products = await Promise.all([
      prisma.product.create({
        data: {
          name: "Cement Bag",
          description: "Portland cement 50kg bag",
          categoryId: 1, // You might need to create categories first
          typeId: 1,     // You might need to create types first
          shopId: shop.id,
          sku: "CEMENT-001",
          barcode: "1234567890123",
          unit: "Bag",
          price: 350.00,
          costPrice: 300.00,
          stockQuantity: 100,
          minStockLevel: 20,
          maxStockLevel: 200,
          isActive: true
        }
      }),
      prisma.product.create({
        data: {
          name: "Steel Rods",
          description: "TMT steel rods 12mm",
          categoryId: 1,
          typeId: 1,
          shopId: shop.id,
          sku: "STEEL-001",
          barcode: "1234567890124",
          unit: "Ton",
          price: 45000.00,
          costPrice: 42000.00,
          stockQuantity: 5,
          minStockLevel: 2,
          maxStockLevel: 10,
          isActive: true
        }
      })
    ]);
    console.log('✅ Products created:', products.length);

    // Create some test employees
    const employees = await Promise.all([
      prisma.employee.create({
        data: {
          name: "Manager One",
          phone: "+91-9876543213",
          email: "manager@shop.com",
          position: "Store Manager",
          salary: 25000.00,
          shopId: shop.id,
          isActive: true
        }
      }),
      prisma.employee.create({
        data: {
          name: "Sales Person",
          phone: "+91-9876543214",
          email: "sales@shop.com",
          position: "Sales Representative",
          salary: 15000.00,
          shopId: shop.id,
          isActive: true
        }
      })
    ]);
    console.log('✅ Employees created:', employees.length);

    // Create some test suppliers
    const suppliers = await Promise.all([
      prisma.supplier.create({
        data: {
          name: "Cement Supplier Co.",
          contactPerson: "Mr. Supplier",
          phone: "+91-9876543215",
          email: "supplier@cement.com",
          address: "Supplier Address, City",
          shopId: shop.id,
          isActive: true
        }
      })
    ]);
    console.log('✅ Suppliers created:', suppliers.length);

    // Create some test sales
    const sales = await Promise.all([
      prisma.sale.create({
        data: {
          customerId: customers[0].id,
          shopId: shop.id,
          saleDate: new Date(),
          totalAmount: 700.00,
          discount: 0.00,
          taxAmount: 0.00,
          finalAmount: 700.00,
          paidAmount: 700.00,
          dueAmount: 0.00,
          paymentStatus: "COMPLETED",
          notes: "Test sale",
          isActive: true
        }
      }),
      prisma.sale.create({
        data: {
          customerId: customers[1].id,
          shopId: shop.id,
          saleDate: new Date(),
          totalAmount: 45000.00,
          discount: 1000.00,
          taxAmount: 0.00,
          finalAmount: 44000.00,
          paidAmount: 22000.00,
          dueAmount: 22000.00,
          paymentStatus: "PENDING",
          notes: "Partial payment sale",
          isActive: true
        }
      })
    ]);
    console.log('✅ Sales created:', sales.length);

    // Create some test expenses
    const expenses = await Promise.all([
      prisma.expense.create({
        data: {
          description: "Electricity Bill",
          amount: 5000.00,
          category: "Utilities",
          date: new Date(),
          shopId: shop.id,
          isActive: true
        }
      }),
      prisma.expense.create({
        data: {
          description: "Rent Payment",
          amount: 15000.00,
          category: "Rent",
          date: new Date(),
          shopId: shop.id,
          isActive: true
        }
      })
    ]);
    console.log('✅ Expenses created:', expenses.length);

    // Create some activity logs
    const activityLogs = await Promise.all([
      prisma.activityLog.create({
        data: {
          userId: user.id,
          action: "LOGIN",
          resource: "SYSTEM",
          details: "User logged in successfully",
          ipAddress: "127.0.0.1",
          userAgent: "Test Browser"
        }
      }),
      prisma.activityLog.create({
        data: {
          userId: user.id,
          action: "CREATE",
          resource: "SHOP",
          details: "Created new shop: " + shop.name,
          ipAddress: "127.0.0.1",
          userAgent: "Test Browser"
        }
      })
    ]);
    console.log('✅ Activity logs created:', activityLogs.length);

    // Create some login logs
    const loginLogs = await Promise.all([
      prisma.loginLog.create({
        data: {
          userId: user.id,
          ipAddress: "127.0.0.1",
          userAgent: "Test Browser",
          success: true
        }
      }),
      prisma.loginLog.create({
        data: {
          userId: user.id,
          ipAddress: "127.0.0.1",
          userAgent: "Test Browser",
          success: true
        }
      })
    ]);
    console.log('✅ Login logs created:', loginLogs.length);

    console.log('\n🎉 Test data added successfully!');
    console.log('📊 You should now see data in your SUPER_DUPER_ADMIN dashboard.');
    console.log('🏪 Shop:', shop.name);
    console.log('👤 User:', user.name, `(${user.email})`);
    console.log('🔑 Login with: admin@test.com / admin123');

  } catch (error) {
    console.error('❌ Error adding test data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

addTestData(); 