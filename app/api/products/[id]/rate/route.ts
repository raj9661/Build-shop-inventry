import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { validateToken } from '@/app/lib/tokenUtils';
import { getShopFilter } from '@/app/lib/shopAccessUtils';
import ultraFastDashboard from '@/app/lib/ultra-fast-dashboard';

const prisma = new PrismaClient();

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const productId = parseInt(id);
    if (isNaN(productId)) {
      return NextResponse.json({ success: false, message: 'Invalid product ID' }, { status: 400 });
    }

    const body = await req.json();
    const { rate } = body;

    if (!rate || isNaN(parseFloat(rate))) {
      return NextResponse.json({ success: false, message: 'Valid rate is required' }, { status: 400 });
    }

    // Get shop filter based on user's access
    const shopFilter = await getShopFilter(token);
    
    // Check if user can access this product's shop
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { shopId: true }
    });

    if (!product) {
      return NextResponse.json({ success: false, message: 'Product not found' }, { status: 404 });
    }

    // Check if user has access to this shop
    if (Object.keys(shopFilter).length > 0) {
      let hasAccess = false;
      
      if ('shopId' in shopFilter && Array.isArray((shopFilter as any).shopId?.in)) {
        // For regular users with shopId filter
        hasAccess = (shopFilter as any).shopId.in.includes(Number(product.shopId));
      } else if ('createdBy' in shopFilter) {
        // For SUPER_DUPER_ADMIN with createdBy filter
        const shop = await prisma.shop.findUnique({
          where: { id: product.shopId },
          select: { createdBy: true, isActive: true }
        });
        hasAccess = !!(shop && Number(shop.createdBy) === Number(shopFilter.createdBy) && shop.isActive);
      }
      
      if (!hasAccess) {
        return NextResponse.json({ success: false, message: 'You do not have access to this product' }, { status: 403 });
      }
    }

    // Create or update daily price for today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await prisma.dailyProductPrice.upsert({
      where: {
        productId_date: {
          productId: productId,
          date: today
        }
      },
      update: {
        price: parseFloat(rate)
      },
      create: {
        productId: productId,
        date: today,
        price: parseFloat(rate)
      }
    });

    // Clear dashboard cache for all users of this shop
    await ultraFastDashboard.clearAllShopDashboardCaches(product.shopId);

    return NextResponse.json({
      success: true,
      message: 'Daily rate updated successfully'
    });

  } catch (error) {
    console.error('Update daily rate error:', error);
    return NextResponse.json({ success: false, message: 'Failed to update daily rate' }, { status: 500 });
  }
} 