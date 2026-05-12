import { NextRequest, NextResponse } from 'next/server';
import { validateToken } from '@/app/lib/tokenUtils';
import { getShopFilter } from '@/app/lib/shopAccessUtils';
import ultraFastDashboard from '@/app/lib/ultra-fast-dashboard';
import { performance } from 'perf_hooks';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Helper function to safely serialize BigInt values for JSON response
function serializeBigInt(obj: any): any {
  return JSON.parse(JSON.stringify(obj, (key, value) =>
    typeof value === 'bigint' ? value.toString() : value
  ));
}

// Ultra-fast dashboard endpoint
export async function GET(req: NextRequest) {
  const startTime = performance.now();
  const requestId = Math.random().toString(36).substring(7);

  try {
    console.log(`⚡ [${requestId}] Ultra-fast dashboard called`);

    // Auth check
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
    const shopIdParam = searchParams.get('shopId');
    const clearCache = searchParams.get('clearCache') === 'true';

    // Get shop filter based on user's access
    const shopFilter = await getShopFilter(token);

    let targetShopId: number;

    if (shopIdParam) {
      const shopId = parseInt(shopIdParam);
      if (!isNaN(shopId)) {
        // Check if user can access this shop
        let hasAccess = false;

        if (Object.keys(shopFilter).length === 0) {
          // No restrictions, allow access
          hasAccess = true;
        } else if ('shopId' in shopFilter && Array.isArray((shopFilter as any).shopId?.in)) {
          // Check if shopId is in the allowed list
          hasAccess = (shopFilter as any).shopId.in.includes(shopId);
        } else if ('createdBy' in shopFilter) {
          // For SUPER_DUPER_ADMIN, check if the shop was created by them
          try {
            const shop = await prisma.shop.findUnique({
              where: { id: BigInt(shopId) },
              select: { createdBy: true, isActive: true }
            });
            hasAccess = !!(shop && shop.createdBy === BigInt(shopFilter.createdBy) && shop.isActive);
          } catch (error) {
            console.error('Error checking shop access:', error);
            hasAccess = false;
          }
        }

        if (hasAccess) {
          targetShopId = shopId;
        } else {
          return NextResponse.json({ success: false, message: 'You do not have access to this shop' }, { status: 403 });
        }
      } else {
        return NextResponse.json({ success: false, message: 'Invalid shop ID' }, { status: 400 });
      }
    } else {
      // Use first available shop for user
      let availableShops = [];

      if (Object.keys(shopFilter).length > 0) {
        if ('shopId' in shopFilter && Array.isArray((shopFilter as any).shopId?.in)) {
          availableShops = (shopFilter as any).shopId.in;
        } else if ('createdBy' in shopFilter) {
          // For SUPER_DUPER_ADMIN, get shops they created
          try {
            const shops = await prisma.shop.findMany({
              where: {
                createdBy: BigInt(shopFilter.createdBy),
                isActive: true
              },
              select: { id: true }
            });
            availableShops = shops.map(shop => Number(shop.id));
          } catch (error) {
            console.error('Error fetching shops for SUPER_DUPER_ADMIN:', error);
            availableShops = [];
          }
        }
      }

      if (availableShops.length > 0) {
        targetShopId = availableShops[0];
      } else {
        return NextResponse.json({ success: false, message: 'No accessible shops found' }, { status: 403 });
      }
    }

    // Debug: Log which shop is being used
    console.log(`🔍 [${requestId}] Using shop ID: ${targetShopId} for user: ${decoded.userId} (role: ${decoded.role})`);
    console.log(`🔍 [${requestId}] Shop filter:`, shopFilter);
    console.log(`🔍 [${requestId}] Shop ID param:`, shopIdParam);

    // Clear cache if requested
    if (clearCache) {
      await ultraFastDashboard.clearDashboardCache(targetShopId, decoded.userId);
      console.log(`🧹 [${requestId}] Dashboard cache cleared for shop ${targetShopId}`);
    }

    // Get ultra-fast dashboard data
    const dashboardData = await ultraFastDashboard.getDashboardData(targetShopId, decoded.userId);

    const totalTime = performance.now() - startTime;
    console.log(`⚡ [${requestId}] Dashboard loaded in ${totalTime.toFixed(2)}ms`);
    console.log(`🔍 [${requestId}] Dashboard data keys:`, Object.keys(dashboardData));
    console.log(`🔍 [${requestId}] productsInStock count:`, dashboardData.productsInStock?.length || 0);

    return NextResponse.json({
      success: true,
      data: serializeBigInt(dashboardData),
      performance: {
        totalTime: totalTime.toFixed(2),
        requestId
      }
    });

  } catch (error: any) {
    console.error('Ultra-fast dashboard error:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to load dashboard data',
      error: error.message,
      stack: error.stack,
      code: 'DASHBOARD_ERROR'
    }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

// Get dashboard performance statistics
export async function POST(req: NextRequest) {
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

    const body = await req.json();
    const { action, shopId } = body;

    if (action === 'clearCache' && shopId) {
      await ultraFastDashboard.clearDashboardCache(shopId, decoded.userId);
      return NextResponse.json({
        success: true,
        message: 'Dashboard cache cleared successfully'
      });
    }

    if (action === 'getStats') {
      const stats = ultraFastDashboard.getCacheStats();
      return NextResponse.json({
        success: true,
        data: stats
      });
    }

    return NextResponse.json({
      success: false,
      message: 'Invalid action'
    }, { status: 400 });

  } catch (error) {
    console.error('Dashboard action error:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to perform dashboard action'
    }, { status: 500 });
  }
} 