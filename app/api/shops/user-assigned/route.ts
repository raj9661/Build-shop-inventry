import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { validateToken } from '@/app/lib/tokenUtils';
import { getUserAssignedShops } from '@/app/lib/shopAccessUtils';


// GET - Get shops assigned to the current user
export async function GET(req: NextRequest) {
  try {
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

      // Get user's assigned shops using NextAuth session
      const user = await prisma.user.findUnique({
        where: { email: session.user?.email || '' },
        select: { id: true, role: true }
      });

      if (!user) {
        return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
      }

      // Get shops based on user role
      let shops: any[] = [];
      if (user.role === 'PLATFORM_OWNER' || user.role === 'MODERATOR') {
        // Platform owners and moderators can access all shops
        console.log('🔍 User-assigned API: Fetching all active shops for role:', user.role);
        shops = await prisma.shop.findMany({
          where: { isActive: true },
          select: { id: true, name: true, location: true, createdAt: true, address: true, phone: true, gstNo: true }
        });
        console.log('🔍 User-assigned API: Found', shops.length, 'active shops');
      } else if (user.role === 'SUPER_DUPER_ADMIN') {
        // SUPER_DUPER_ADMIN can access all shops they created
        console.log('🔍 User-assigned API: Fetching all shops created by SUPER_DUPER_ADMIN:', user.id);
        shops = await prisma.shop.findMany({
          where: { 
            createdBy: user.id,
            isActive: true 
          },
          select: { id: true, name: true, location: true, createdAt: true, address: true, phone: true, gstNo: true }
        });
        console.log('🔍 User-assigned API: Found', shops.length, 'shops created by user');
      } else {
        // Get user's assigned shops
        const assignments = await prisma.userShopAssignment.findMany({
          where: {
            userId: user.id,
            active: true
          },
          include: {
            shop: {
              select: { id: true, name: true, location: true, createdAt: true, address: true, phone: true, gstNo: true }
            }
          }
        });
        shops = assignments.map(assignment => assignment.shop);
      }

      // For each shop, fetch stats
      const shopsWithStats = await Promise.all(
        shops.map(async (shop) => {
          const [
            stats,
            productCount,
            expenseStats,
            assignedUsers
          ] = await Promise.all([
            prisma.sale.aggregate({
              where: { shopId: shop.id },
              _sum: { totalAmount: true },
              _count: { id: true }
            }),
            prisma.product.count({
              where: { shopId: shop.id }
            }),
            prisma.expense.aggregate({
              where: { shopId: shop.id },
              _sum: { amount: true },
              _count: { id: true }
            }),
            prisma.userShopAssignment.count({
              where: { shopId: BigInt(shop.id), active: true }
            })
          ]);

          return {
            ...shop,
            id: Number(shop.id),
            totalSales: stats._count?.id || 0,
            totalAmount: Number(stats._sum?.totalAmount || 0),
            totalPaid: 0, // No paidAmount field in Sale model
            totalDue: Number(stats._sum?.totalAmount || 0),
            totalProducts: productCount,
            totalExpenses: Number(expenseStats._sum?.amount || 0),
            expenseCount: expenseStats._count?.id || 0,
            assignedUsers: assignedUsers
          };
        })
      );

      return NextResponse.json({
        success: true,
        data: { shops: shopsWithStats }
      });
    }

    // Handle custom JWT Bearer token
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, message: 'Access token required' }, { status: 401 });
    }
    
    const token = authHeader.substring(7);
    console.log('🔍 User-assigned API: Validating token...');
    const decoded = await validateToken(token);
    if (!decoded) {
      console.log('❌ User-assigned API: Token validation failed');
      return NextResponse.json({ success: false, message: 'Invalid or expired token' }, { status: 401 });
    }

    console.log('✅ User-assigned API: Token validated for user:', decoded.userId, 'role:', decoded.role);

    // Get user's assigned shops
    console.log('🔍 User-assigned API: Getting assigned shops...');
    const assignedShops = await getUserAssignedShops(token);
    console.log('🔍 User-assigned API: Found', assignedShops.length, 'assigned shops');
    console.log('🔍 User-assigned API: Shop details:', assignedShops);

    // For each shop, fetch stats
    const shopsWithStats = await Promise.all(assignedShops.map(async (shop) => {
      const [
        totalSales,
        totalProducts,
        totalCustomers,
        totalEmployees,
        assignedUsers,
        recentSales
      ] = await Promise.all([
        prisma.sale.count({ where: { shopId: BigInt(shop.id) } }),
        prisma.product.count({ where: { shopId: BigInt(shop.id) } }),
        prisma.customer.count({ where: { shopId: BigInt(shop.id) } }),
        prisma.employee.count({ where: { shopId: BigInt(shop.id) } }),
        prisma.userShopAssignment.count({ where: { shopId: BigInt(shop.id), active: true } }),
        prisma.sale.count({ where: { shopId: BigInt(shop.id), createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } })
      ]);
      
      return {
        id: Number(shop.id),
        name: shop.name,
        location: shop.location,
        address: shop.address || '',
        phone: shop.phone || '',
        gstNo: shop.gstNo || '',
        createdAt: new Date().toISOString(),
        totalSales,
        totalProducts,
        totalCustomers,
        totalEmployees,
        assignedUsers,
        recentSales
      };
    }));

    console.log('🔍 User-assigned API: Final response with', shopsWithStats.length, 'shops');
    console.log('🔍 User-assigned API: Final shop data:', shopsWithStats);
    
    return NextResponse.json({ 
      success: true, 
      data: { shops: shopsWithStats } 
    });
  } catch (error) {
    console.error('Get user assigned shops error:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined
    });
    return NextResponse.json({ 
      success: false, 
      message: 'Failed to fetch user assigned shops',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 