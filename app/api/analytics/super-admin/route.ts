import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { validateToken } from '@/app/lib/tokenUtils';
import { getUserShopAccess } from '@/app/lib/shopAccessUtils';


// Helper: Check for SUPER_DUPER_ADMIN role
function requireSuperDuperAdmin(user: any) {
  return user && user.role === 'SUPER_DUPER_ADMIN';
}

export async function GET(req: NextRequest) {
  try {
    let decoded: any = null;
    
    // Check if this is a NextAuth.js request (has cookies)
    const cookies = req.headers.get('cookie');
    if (cookies && cookies.includes('next-auth.session-token')) {
      // Handle NextAuth.js session
      const { getServerSession } = await import('next-auth');
      const { authOptions } = await import('@/lib/auth');
      const session = await getServerSession(authOptions);

      if (!session) {
        return NextResponse.json({ success: false, message: 'No active session' }, { status: 401 });
      }

      // Get user from database
      const user = await prisma.user.findUnique({
        where: { email: session.user?.email || '' },
        select: { id: true, role: true }
      });

      if (!user) {
        return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
      }

      decoded = {
        userId: user.id,
        role: user.role,
        email: session.user?.email
      };
    } else {
      // Handle custom JWT Bearer token
      const authHeader = req.headers.get('authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return NextResponse.json({ success: false, message: 'Access token required', code: 'TOKEN_MISSING' }, { status: 401 });
      }
      const token = authHeader.substring(7);
      decoded = await validateToken(token);
      if (!decoded) {
        return NextResponse.json({ success: false, message: 'Invalid or expired token', code: 'TOKEN_INVALID' }, { status: 401 });
      }
    }
    
    // Role check - Only SUPER_DUPER_ADMIN can access this
    if (!requireSuperDuperAdmin(decoded)) {
      return NextResponse.json({ success: false, message: 'Insufficient permissions', code: 'INSUFFICIENT_PERMISSIONS' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const days = parseInt(searchParams.get('days') || '30');
    const shopIdParam = searchParams.get('shopId');
    const shopId = shopIdParam ? parseInt(shopIdParam) : null;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get user's assigned shops
    let shopIds: number[] = [];
    if (decoded.userId) {
      // For NextAuth.js sessions, we need to get shop access differently
      if (cookies && cookies.includes('next-auth.session-token')) {
        // SUPER_DUPER_ADMIN gets access to all shops
        if (decoded.role === 'SUPER_DUPER_ADMIN') {
          const allShops = await prisma.shop.findMany({
            where: { isActive: true },
            select: { id: true }
          });
          shopIds = allShops.map(shop => Number(shop.id));
        } else {
          // Get user's assigned shops directly
          const assignments = await prisma.userShopAssignment.findMany({
            where: {
              userId: decoded.userId,
              active: true
            },
            select: { shopId: true }
          });
          shopIds = assignments.map(a => Number(a.shopId));
        }
      } else {
        // For custom JWT tokens, use the existing function
        const authHeader = req.headers.get('authorization');
        const token = authHeader?.substring(7) || '';
        const accessInfo = await getUserShopAccess(token);
        shopIds = accessInfo?.assignedShopIds || [];
      }
    }
    
    if (shopId && shopIds.includes(shopId)) {
      shopIds = [shopId];
    }
    if (shopIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          totalRevenue: 0,
          totalSales: 0,
          totalProducts: 0,
          totalCustomers: 0,
          totalEmployees: 0,
          totalExpenses: 0,
          revenueByShop: [],
          salesByMonth: [],
          topProducts: [],
          paymentMethodBreakdown: []
        }
      });
    }

    // Get total counts for assigned shops only
    const [
      totalSales,
      totalRevenue,
      totalProducts,
      totalCustomers,
      totalEmployees,
      totalExpenses
    ] = await Promise.all([
      prisma.sale.count({
        where: {
          shopId: { in: shopIds },
          createdAt: { gte: startDate },
          customer: { isActive: true }
        }
      }),
      prisma.sale.aggregate({
        where: {
          shopId: { in: shopIds },
          createdAt: { gte: startDate },
          customer: { isActive: true }
        },
        _sum: { totalAmount: true }
      }),
      prisma.product.count({
        where: {
          shopId: { in: shopIds },
          isActive: true
        }
      }),
      prisma.customer.count({
        where: {
          shopId: { in: shopIds },
          isActive: true
        }
      }),
      prisma.employee.count({
        where: {
          shopId: { in: shopIds },
          isActive: true
        }
      }),
      prisma.expense.aggregate({
        where: {
          shopId: { in: shopIds },
          isActive: true
        },
        _sum: { amount: true }
      })
    ]);

    // Revenue by shop (only assigned shops)
    const revenueByShop = await prisma.sale.groupBy({
      by: ['shopId'],
      where: {
        shopId: { in: shopIds },
        createdAt: { gte: startDate },
        customer: { isActive: true }
      },
      _sum: { totalAmount: true },
      _count: { id: true }
    });

    const shopsWithRevenue = await Promise.all(
      revenueByShop.map(async (item) => {
        const shop = await prisma.shop.findUnique({ where: { id: item.shopId } });
        return {
          shopName: shop?.name || 'Unknown Shop',
          revenue: Number(item._sum?.totalAmount || 0),
          sales: Number(item._count?.id || 0)
        };
      })
    );

    // Sales by month (last 6 months) for assigned shops only
    const salesByMonth = [];
    for (let i = 5; i >= 0; i--) {
      const monthStart = new Date();
      monthStart.setMonth(monthStart.getMonth() - i, 1);
      monthStart.setHours(0, 0, 0, 0);
      const monthEnd = new Date(monthStart);
      monthEnd.setMonth(monthEnd.getMonth() + 1, 0);
      monthEnd.setHours(23, 59, 59, 999);
      
      const monthData = await prisma.sale.aggregate({
        where: {
          shopId: { in: shopIds },
          createdAt: { gte: monthStart, lte: monthEnd },
          customer: { isActive: true }
        },
        _sum: { totalAmount: true },
        _count: { id: true }
      });
      
      salesByMonth.push({
        month: monthStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        sales: Number(monthData._count?.id || 0),
        revenue: Number(monthData._sum?.totalAmount || 0)
      });
    }

    // Top products from assigned shops only
    const topProducts = await prisma.saleItem.groupBy({
      by: ['productId'],
      where: {
        sale: {
          shopId: { in: shopIds },
          createdAt: { gte: startDate },
          customer: { isActive: true }
        }
      },
      _sum: { quantity: true, totalPrice: true },
      orderBy: { _sum: { totalPrice: 'desc' } },
      take: 10
    });

    const productsWithSales = await Promise.all(
      topProducts.map(async (item) => {
        const product = await prisma.product.findUnique({ where: { id: item.productId } });
        return {
          name: product?.name || 'Unknown Product',
          sales: Number(item._sum?.quantity || 0),
          revenue: Number(item._sum?.totalPrice || 0)
        };
      })
    );

    // Payment method breakdown (for pie chart)
    const paymentByMethod = await prisma.payment.groupBy({
      by: ['method'],
      where: {
        shopId: { in: shopIds },
        isActive: true,
        date: { gte: startDate }
      },
      _sum: { amount: true }
    });
    const paymentMethodBreakdown = paymentByMethod.map(item => ({
      method: item.method,
      amount: Number(item._sum?.amount || 0)
    }));

    return NextResponse.json({
      success: true,
      data: {
        totalRevenue: Number(totalRevenue._sum?.totalAmount || 0),
        totalSales: Number(totalSales),
        totalProducts: Number(totalProducts),
        totalCustomers: Number(totalCustomers),
        totalEmployees: Number(totalEmployees),
        totalExpenses: Number(totalExpenses._sum?.amount || 0),
        revenueByShop: shopsWithRevenue,
        salesByMonth,
        topProducts: productsWithSales,
        paymentMethodBreakdown
      }
    });
  } catch (error) {
    console.error('Super Admin Analytics error:', error);
    return NextResponse.json({ success: false, message: 'Failed to load analytics data', code: 'ANALYTICS_ERROR' }, { status: 500 });
  }
} 