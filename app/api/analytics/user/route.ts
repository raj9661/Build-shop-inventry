import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { validateToken } from '@/app/lib/tokenUtils';
import { getShopFilter } from '@/app/lib/shopAccessUtils';

const prisma = new PrismaClient();

// Helper function to safely serialize BigInt values for JSON response
function serializeBigInt(obj: any): string {
  return JSON.stringify(obj, (key, value) =>
    typeof value === 'bigint' ? value.toString() : value
  );
}

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
    
    // Determine which shops the user can access
    let whereClause: any = {};
    if (shopIdParam) {
      const shopId = parseInt(shopIdParam);
      if (!isNaN(shopId) && shopId > 0) {
        if (Object.keys(shopFilter).length === 0 || ((shopFilter as any).shopId && (shopFilter as any).shopId.in.includes(shopId))) {
          whereClause.shopId = BigInt(shopId);
        } else {
          return NextResponse.json({ success: false, message: 'You do not have access to this shop' }, { status: 403 });
        }
      }
    } else {
      if (Object.keys(shopFilter).length > 0) {
        if ((shopFilter as any).shopId && (shopFilter as any).shopId.in && (shopFilter as any).shopId.in.length > 0) {
          Object.assign(whereClause, shopFilter);
        } else {
          return NextResponse.json({
            success: false,
            message: 'You do not have access to any shops. Please contact your administrator.'
          }, { status: 403 });
        }
      }
    }

    // Calculate date range
    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    // Get sales data
    const [
      totalSales,
      totalRevenue,
      totalProducts,
      totalCustomers,
      totalEmployees,
      totalSuppliers,
      totalExpenses,
      totalSupplierPayments,
      totalEmployeePayments,
      shops
    ] = await Promise.all([
      prisma.sale.count({
        where: {
          ...whereClause,
          saleDate: { gte: startDate, lte: endDate },
          isActive: true
        }
      }),
      prisma.sale.aggregate({
        where: {
          ...whereClause,
          saleDate: { gte: startDate, lte: endDate },
          isActive: true
        },
        _sum: { finalAmount: true }
      }),
      prisma.product.count({
        where: { ...whereClause, isActive: true }
      }),
      prisma.customer.count({
        where: { ...whereClause, isActive: true }
      }),
      prisma.employee.count({
        where: { ...whereClause, isActive: true }
      }),
      prisma.supplier.count({
        where: { ...whereClause, isActive: true }
      }),
      prisma.expense.aggregate({
        where: {
          ...whereClause,
          date: { gte: startDate, lte: endDate },
          isActive: true
        },
        _sum: { amount: true }
      }),
      prisma.supplierPayment.aggregate({
        where: {
          ...whereClause,
          paymentDate: { gte: startDate, lte: endDate },
          isActive: true
        },
        _sum: { amount: true }
      }),
      prisma.employeePayment.aggregate({
        where: {
          ...whereClause,
          paymentDate: { gte: startDate, lte: endDate },
          isActive: true
        },
        _sum: { amount: true }
      }),
      prisma.shop.findMany({
        where: {
          isActive: true,
          ...(whereClause.shopId ? { id: whereClause.shopId } : 
             whereClause.createdBy ? { createdBy: whereClause.createdBy } : {})
        },
        select: { id: true, name: true, location: true }
      })
    ]);

    // Get sales by month
    const salesByMonth = [];
    const numMonths = Math.max(1, Math.ceil(days / 30));
    const monthsToShow = Math.min(numMonths, 12);

    for (let i = monthsToShow - 1; i >= 0; i--) {
      const now = new Date();
      const targetYear = now.getUTCFullYear();
      const targetMonth = now.getUTCMonth() - i;
      const monthStart = new Date(Date.UTC(targetYear, targetMonth, 1, 0, 0, 0, 0));
      const monthEnd = new Date(Date.UTC(targetYear, targetMonth + 1, 0, 23, 59, 59, 999));

      const monthSales = await prisma.sale.aggregate({
        where: {
          isActive: true,
          saleDate: { gte: monthStart, lte: monthEnd },
          ...whereClause
        },
        _sum: { finalAmount: true },
        _count: { id: true }
      });

      const monthLabel = monthStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      salesByMonth.push({
        month: monthLabel,
        sales: monthSales._count.id || 0,
        revenue: Number(monthSales._sum.finalAmount || 0)
      });
    }

    // Get expenses by month
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
          date: { gte: monthStart, lte: monthEnd },
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
        date: { gte: startDate, lte: endDate },
        isActive: true
      },
      _sum: { amount: true },
      orderBy: { _sum: { amount: 'desc' } }
    });

    // Get top products
    const topProducts = await prisma.saleItem.groupBy({
      by: ['productId'],
      where: {
        sale: {
          ...whereClause,
          saleDate: { gte: startDate, lte: endDate },
          isActive: true
        }
      },
      _sum: { quantity: true, totalPrice: true },
      orderBy: { _sum: { totalPrice: 'desc' } },
      take: 10
    });

    // Get top shops
    const topShops = await prisma.sale.groupBy({
      by: ['shopId'],
      where: {
        ...whereClause,
        saleDate: { gte: startDate, lte: endDate },
        isActive: true
      },
      _sum: { finalAmount: true },
      _count: { id: true },
      orderBy: { _sum: { finalAmount: 'desc' } },
      take: 10
    });

    // Get sales by payment method
    const salesForPaymentMethod = await prisma.sale.findMany({
      where: {
        ...whereClause,
        saleDate: { gte: startDate, lte: endDate },
        isActive: true
      },
      select: { finalAmount: true, paymentMethod: true, paymentStatus: true, notes: true }
    });

    const paymentBreakdownMap = new Map<string, { amount: number, count: number }>();
    salesForPaymentMethod.forEach(sale => {
      const amount = Number(sale.finalAmount || 0);
      let method = (sale.paymentMethod || 'CASH') as string;
      
      const partialMatch = sale.notes?.match(/Partial Payment: ₹(\d+(?:\.\d+)?) via (\w+), Due: ₹(\d+(?:\.\d+)?)/);
      const isLoan = sale.notes?.includes('Loan/Credit Sale') || (sale.paymentStatus === 'PENDING' && !partialMatch && amount > 0);

      if (partialMatch) {
        const paid = parseFloat(partialMatch[1]);
        const due = parseFloat(partialMatch[3]);
        const partialMethod = partialMatch[2].toUpperCase();
        const pMethod = paymentBreakdownMap.get(partialMethod) || { amount: 0, count: 0 };
        pMethod.amount += paid; pMethod.count += 1;
        paymentBreakdownMap.set(partialMethod, pMethod);
        const loanMethod = paymentBreakdownMap.get('LOAN') || { amount: 0, count: 0 };
        loanMethod.amount += due; loanMethod.count += 1;
        paymentBreakdownMap.set('LOAN', loanMethod);
      } else if (isLoan) {
        const m = paymentBreakdownMap.get('LOAN') || { amount: 0, count: 0 };
        m.amount += amount; m.count += 1;
        paymentBreakdownMap.set('LOAN', m);
      } else {
        const m = paymentBreakdownMap.get(method) || { amount: 0, count: 0 };
        m.amount += amount; m.count += 1;
        paymentBreakdownMap.set(method, m);
      }
    });

    const salesByPaymentMethod = Array.from(paymentBreakdownMap.entries()).map(([method, data]) => ({
      method, amount: data.amount, count: data.count
    }));

    // Highest Balance Customers
    const customers = await prisma.customer.findMany({
      where: { isActive: true, currentBalance: { gt: 0 }, ...whereClause },
      orderBy: { currentBalance: 'desc' },
      include: { shop: { select: { name: true } } }
    });

    const highestBalanceCustomersData = customers.map(c => ({
      id: Number(c.id), name: c.name, phone: c.phone, balance: Number(c.currentBalance), shopName: c.shop.name
    }));

    // Get recent activity logs
    const recentActivity = await prisma.activityLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { user: { select: { name: true, email: true } } }
    });

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
      shops: shops.map(shop => ({ id: Number(shop.id), name: shop.name, location: shop.location })),
      salesByMonth,
      expensesByMonth,
      expensesByCategory: expensesByCategory.map(exp => ({
        category: exp.category, amount: Number(exp._sum.amount || 0)
      })),
      topProducts: await Promise.all(topProducts.map(async (product) => {
        const p = await prisma.product.findUnique({
          where: { id: product.productId }, select: { name: true, sku: true }
        });
        return {
          id: Number(product.productId), name: p?.name || 'Unknown', sku: p?.sku || 'N/A',
          quantity: Number(product._sum.quantity || 0), revenue: Number(product._sum.totalPrice || 0)
        };
      })),
      topShops: await Promise.all(topShops.map(async (shop) => {
        const s = await prisma.shop.findUnique({ where: { id: shop.shopId }, select: { name: true, location: true } });
        return { id: Number(shop.shopId), name: s?.name || 'Unknown', location: s?.location || 'N/A', revenue: Number(shop._sum.finalAmount || 0), sales: shop._count.id };
      })),
      revenueByShop: shops.map(shop => {
        const rev = totalRevenue._sum.finalAmount ? Number(totalRevenue._sum.finalAmount) : 0; // Simplified for user analytics
        return { id: Number(shop.id), name: shop.name, location: shop.location, revenue: rev, sales: totalSales };
      }),
      salesByPaymentMethod,
      highestBalanceCustomers: highestBalanceCustomersData,
      totalCustomerBalance: highestBalanceCustomersData.reduce((sum, c) => sum + c.balance, 0),
      recentActivity: recentActivity.map(log => ({
        id: Number(log.id), action: log.action, resource: log.resource, details: log.details, createdAt: log.createdAt, user: log.user
      }))
    };

    return new NextResponse(serializeBigInt({ success: true, data: analyticsData }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('User analytics error:', error);
    return NextResponse.json({ success: false, message: 'Failed to fetch analytics data' }, { status: 500 });
  }
}
