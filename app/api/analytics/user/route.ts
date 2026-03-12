import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { validateToken } from '@/app/lib/tokenUtils';
import { getShopFilter } from '@/app/lib/shopAccessUtils';

const prisma = new PrismaClient();

// GET - Get comprehensive analytics for user's assigned shops
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, message: 'Access token required' }, { status: 401 });
    }
    const token = authHeader.substring(7);
    const decoded = await validateToken(token);
    if (!decoded) {
      return NextResponse.json({ success: false, message: 'Invalid or expired token' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const days = parseInt(searchParams.get('days') || '30');
    const shopIdParam = searchParams.get('shopId');

    console.log('🔍 User analytics API called:', { userId: decoded.userId, days, shopIdParam });

    // Get shop filter based on user's access
    const shopFilter = await getShopFilter(token);
    console.log('🏪 User shop filter:', shopFilter);
    console.log('🏪 Shop filter type:', typeof shopFilter);
    console.log('🏪 Shop filter keys:', Object.keys(shopFilter));

    // Determine which shops the user can access
    let whereClause: any = {};
    if (shopIdParam) {
      const shopId = parseInt(shopIdParam);
      if (!isNaN(shopId) && shopId > 0) { // Only process valid shop IDs (> 0)
        // Check if user can access this specific shop
        if (Object.keys(shopFilter).length === 0 || ((shopFilter as any).shopId && (shopFilter as any).shopId.in.includes(shopId))) {
          whereClause.shopId = shopId;
        } else {
          return NextResponse.json({ success: false, message: 'You do not have access to this shop' }, { status: 403 });
        }
      }
    } else {
      // No specific shopId provided, use user's assigned shops
      if (Object.keys(shopFilter).length > 0) {
        // Check if user has any valid shop assignments
        if ((shopFilter as any).shopId && (shopFilter as any).shopId.in && (shopFilter as any).shopId.in.length > 0) {
          Object.assign(whereClause, shopFilter);
        } else {
          // User has no shop assignments
          return NextResponse.json({
            success: false,
            message: 'You do not have access to any shops. Please contact your administrator.'
          }, { status: 403 });
        }
      }
      // If no shop filter (SUPER_DUPER_ADMIN), allow access to all shops
    }

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);

    console.log('📅 Date range:', { startDate, endDate, days });
    console.log('🔍 Final whereClause for queries:', whereClause);

    // Get sales data
    const totalSales = await prisma.sale.count({
      where: {
        ...whereClause,
        saleDate: {
          gte: startDate,
          lte: endDate
        },
        isActive: true
      }
    });

    const totalRevenue = await prisma.sale.aggregate({
      where: {
        ...whereClause,
        saleDate: {
          gte: startDate,
          lte: endDate
        },
        isActive: true
      },
      _sum: {
        finalAmount: true
      }
    });

    // Get product data
    const totalProducts = await prisma.product.count({
      where: {
        ...whereClause,
        isActive: true
      }
    });

    // Get customer data
    const totalCustomers = await prisma.customer.count({
      where: {
        ...whereClause,
        isActive: true
      }
    });

    // Get employee data
    const totalEmployees = await prisma.employee.count({
      where: {
        ...whereClause,
        isActive: true
      }
    });

    // Get supplier data
    const totalSuppliers = await prisma.supplier.count({
      where: {
        ...whereClause,
        isActive: true
      }
    });

    // Get expense data
    const totalExpenses = await prisma.expense.aggregate({
      where: {
        ...whereClause,
        date: {
          gte: startDate,
          lte: endDate
        },
        isActive: true
      },
      _sum: {
        amount: true
      }
    });

    // Get supplier payments data
    const totalSupplierPayments = await prisma.supplierPayment.aggregate({
      where: {
        ...whereClause,
        paymentDate: {
          gte: startDate,
          lte: endDate
        },
        isActive: true
      },
      _sum: {
        amount: true
      }
    });

    // Get employee payments data
    const totalEmployeePayments = await prisma.employeePayment.aggregate({
      where: {
        ...whereClause,
        paymentDate: {
          gte: startDate,
          lte: endDate
        },
        isActive: true
      },
      _sum: {
        amount: true
      }
    });

    // Get shops data - create separate filter for Shop model
    let shopWhereClause: any = { isActive: true };
    if (whereClause.shopId && whereClause.shopId.in) {
      // Convert shopId filter to id filter for Shop model
      shopWhereClause.id = { in: whereClause.shopId.in };
    } else if (whereClause.createdBy) {
      // For SUPER_DUPER_ADMIN, use createdBy filter
      shopWhereClause.createdBy = whereClause.createdBy;
    }

    const shops = await prisma.shop.findMany({
      where: shopWhereClause,
      select: {
        id: true,
        name: true,
        location: true
      }
    });

    // Get sales by month - dynamically calculate number of months based on days parameter
    const salesByMonth = [];
    const numMonths = Math.max(1, Math.ceil(days / 30));
    const monthsToShow = Math.min(numMonths, 12); // Cap at 12 months

    for (let i = monthsToShow - 1; i >= 0; i--) {
      const now = new Date();
      // Calculate the target month by subtracting i months from now (using UTC)
      const targetYear = now.getUTCFullYear();
      const targetMonth = now.getUTCMonth() - i;

      // Create month start (first day of month, 00:00:00 UTC)
      const monthStart = new Date(Date.UTC(targetYear, targetMonth, 1, 0, 0, 0, 0));

      // Create month end (last day of month, 23:59:59.999 UTC)
      const monthEnd = new Date(Date.UTC(targetYear, targetMonth + 1, 0, 23, 59, 59, 999));

      const monthSales = await prisma.sale.aggregate({
        where: {
          isActive: true,
          saleDate: {
            gte: monthStart,
            lte: monthEnd
          },
          ...whereClause
        },
        _sum: { finalAmount: true },
        _count: { id: true }
      });

      // Format month as "MMM YYYY"
      const monthLabel = monthStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

      salesByMonth.push({
        month: monthLabel,
        sales: monthSales._count.id || 0,
        revenue: Number(monthSales._sum.finalAmount || 0)
      });
    }

    // Get expenses by month - same logic as sales by month
    const expensesByMonth = [];
    for (let i = monthsToShow - 1; i >= 0; i--) {
      const now = new Date();
      const targetYear = now.getUTCFullYear();
      const targetMonth = now.getUTCMonth() - i;

      const monthStart = new Date(Date.UTC(targetYear, targetMonth, 1, 0, 0, 0, 0));
      const monthEnd = new Date(Date.UTC(targetYear, targetMonth + 1, 0, 23, 59, 59, 999));

      const monthExpenses = await prisma.expense.aggregate({
        where: {
          isActive: true,
          date: {
            gte: monthStart,
            lte: monthEnd
          },
          ...whereClause
        },
        _sum: { amount: true }
      });

      const monthLabel = monthStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

      expensesByMonth.push({
        month: monthLabel,
        expenses: Number(monthExpenses._sum.amount || 0)
      });
    }

    // Get expenses by category
    const expensesByCategory = await prisma.expense.groupBy({
      by: ['category'],
      where: {
        ...whereClause,
        date: {
          gte: startDate,
          lte: endDate
        },
        isActive: true
      },
      _sum: { amount: true },
      orderBy: {
        _sum: {
          amount: 'desc'
        }
      }
    });

    // Get top products
    const topProducts = await prisma.saleItem.groupBy({
      by: ['productId'],
      where: {
        sale: {
          ...whereClause,
          saleDate: {
            gte: startDate,
            lte: endDate
          },
          isActive: true
        }
      },
      _sum: {
        quantity: true,
        totalPrice: true
      },
      orderBy: {
        _sum: {
          totalPrice: 'desc'
        }
      },
      take: 10
    });

    // Get top shops (if user has access to multiple shops)
    const topShops = await prisma.sale.groupBy({
      by: ['shopId'],
      where: {
        ...whereClause,
        saleDate: {
          gte: startDate,
          lte: endDate
        },
        isActive: true
      },
      _sum: {
        finalAmount: true
      },
      _count: {
        id: true
      },
      orderBy: {
        _sum: {
          finalAmount: 'desc'
        }
      },
      take: 10
    });

    // Get revenue by shop
    const revenueByShop = await prisma.sale.groupBy({
      by: ['shopId'],
      where: {
        ...whereClause,
        saleDate: {
          gte: startDate,
          lte: endDate
        },
        isActive: true
      },
      _sum: {
        finalAmount: true
      },
      _count: {
        id: true
      }
    });

    // Get sales by payment method
    const salesByPaymentMethod = await prisma.sale.groupBy({
      by: ['paymentMethod'],
      where: {
        ...whereClause,
        saleDate: {
          gte: startDate,
          lte: endDate
        },
        isActive: true
      },
      _sum: {
        finalAmount: true
      },
      _count: {
        id: true
      }
    });

    // Get recent activity logs (ActivityLog doesn't have shopId field)
    const recentActivity = await prisma.activityLog.findMany({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 20,
      include: {
        user: {
          select: {
            name: true,
            email: true
          }
        }
      }
    });

    // Highest Balance Customers
    const customers = await prisma.customer.findMany({
      where: {
        isActive: true,
        currentBalance: { gt: 0 },
        ...whereClause
      },
      orderBy: { currentBalance: 'desc' },
      include: {
        shop: { select: { name: true } }
      }
    });

    const highestBalanceCustomersData = customers.map(c => ({
      id: Number(c.id),
      name: c.name,
      phone: c.phone,
      balance: Number(c.currentBalance),
      shopName: c.shop.name
    }));

    const totalCustomerBalance = highestBalanceCustomersData.reduce((sum, c) => sum + c.balance, 0);


    // Format the response data
    const analyticsData = {
      totalRevenue: Number(totalRevenue._sum.finalAmount || 0),
      totalSales,
      totalProducts,
      totalCustomers,
      totalEmployees,
      totalSuppliers,
      totalExpenses: Number(totalExpenses._sum.amount || 0),
      totalSupplierPayments: Number(totalSupplierPayments._sum.amount || 0),
      totalEmployeePayments: Number(totalEmployeePayments._sum.amount || 0),
      shops: shops.map(shop => ({
        id: Number(shop.id),
        name: shop.name,
        location: shop.location
      })),
      salesByMonth: salesByMonth, // Already formatted in the loop above
      expensesByMonth: expensesByMonth, // Already formatted in the loop above
      expensesByCategory: expensesByCategory.map(exp => ({
        category: exp.category,
        amount: Number(exp._sum.amount || 0)
      })),
      topProducts: await Promise.all(topProducts.map(async (product) => {
        const productDetails = await prisma.product.findUnique({
          where: { id: product.productId },
          select: { name: true, sku: true }
        });
        return {
          id: Number(product.productId),
          name: productDetails?.name || 'Unknown Product',
          sku: productDetails?.sku || 'N/A',
          quantity: Number(product._sum.quantity || 0),
          revenue: Number(product._sum.totalPrice || 0)
        };
      })),
      topShops: await Promise.all(topShops.map(async (shop) => {
        const shopDetails = await prisma.shop.findUnique({
          where: { id: shop.shopId },
          select: { name: true, location: true }
        });
        return {
          id: Number(shop.shopId),
          name: shopDetails?.name || 'Unknown Shop',
          location: shopDetails?.location || 'N/A',
          revenue: Number(shop._sum.finalAmount || 0),
          sales: shop._count.id
        };
      })),
      revenueByShop: await Promise.all(revenueByShop.map(async (shop) => {
        const shopDetails = await prisma.shop.findUnique({
          where: { id: shop.shopId },
          select: { name: true, location: true }
        });
        return {
          id: Number(shop.shopId),
          name: shopDetails?.name || 'Unknown Shop',
          location: shopDetails?.location || 'N/A',
          revenue: Number(shop._sum.finalAmount || 0),
          sales: shop._count.id
        };
      })),
      salesByPaymentMethod: salesByPaymentMethod.map(payment => ({
        method: payment.paymentMethod,
        amount: Number(payment._sum.finalAmount || 0),
        count: payment._count.id
      })),
      highestBalanceCustomers: highestBalanceCustomersData,
      totalCustomerBalance: totalCustomerBalance,

      recentActivity: recentActivity.map(log => ({
        id: Number(log.id),
        action: log.action,
        resource: log.resource,
        resourceId: log.resourceId ? Number(log.resourceId) : null,
        details: log.details,
        createdAt: log.createdAt,
        user: log.user
      }))
    };

    console.log('✅ User analytics data sent successfully');
    console.log('📊 User analytics data prepared:', {
      totalRevenue: Number(totalRevenue._sum.finalAmount || 0),
      totalSales,
      totalProducts,
      totalCustomers,
      totalEmployees,
      totalExpenses: Number(totalExpenses._sum.amount || 0),
      shopFilter: shopIdParam ? `Shop ${shopIdParam}` : 'User assigned shops'
    });

    return NextResponse.json({
      success: true,
      data: analyticsData
    });

  } catch (error) {
    console.error('User analytics error:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to fetch analytics data'
    }, { status: 500 });
  }
}
