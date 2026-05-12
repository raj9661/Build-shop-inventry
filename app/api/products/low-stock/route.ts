import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { validateToken } from '@/app/lib/tokenUtils'
import { getShopFilter } from '@/app/lib/shopAccessUtils'

const prisma = new PrismaClient()

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

    // Get shop filter based on user's access
    const shopFilter = await getShopFilter(token);
    
    // Get query parameters
    const { searchParams } = new URL(req.url);
    const shopId = searchParams.get('shopId');
    const threshold = searchParams.get('threshold') ? parseInt(searchParams.get('threshold')!) : 10; // Default threshold of 10

    // Build where clause
    const whereClause: any = {
      isActive: true,
      stockQuantity: {
        lte: threshold
      }
    };

    // Add shop filter
    if (Object.keys(shopFilter).length > 0) {
      Object.assign(whereClause, shopFilter);
    }

    // If specific shopId is provided, override shop filter
    if (shopId) {
      whereClause.shopId = parseInt(shopId);
    }

    const products = await prisma.product.findMany({
      where: whereClause,
      include: {
        category: {
          select: {
            name: true
          }
        },
        shop: {
          select: {
            name: true
          }
        }
      },
      orderBy: [
        { stockQuantity: 'asc' },
        { name: 'asc' }
      ]
    });

    // Transform the data and add stock status
    const transformedProducts = products.map((product: any) => {
      let stockStatus: 'critical' | 'low' | 'normal' = 'normal';
      
      if (product.stockQuantity === 0) {
        stockStatus = 'critical';
      } else if (product.stockQuantity <= Math.floor(threshold * 0.3)) {
        stockStatus = 'critical';
      } else if (product.stockQuantity <= threshold) {
        stockStatus = 'low';
      }

      return {
        id: Number(product.id),
        name: product.name,
        sku: product.sku,
        category: product.category?.name || 'Uncategorized',
        stockQuantity: Number(product.stockQuantity),
        minStockLevel: Number(product.minStockLevel || 0),
        unit: product.unit,
        price: Number(product.price),
        isActive: product.isActive,
        stockStatus,
        shopName: product.shop?.name || '',
        createdAt: product.createdAt.toISOString(),
        updatedAt: product.updatedAt.toISOString()
      };
    });

    return NextResponse.json({ 
      success: true, 
      data: { 
        products: transformedProducts,
        total: transformedProducts.length,
        threshold
      } 
    });
  } catch (error) {
    console.error('Get low stock products error:', error);
    return NextResponse.json({ success: false, message: 'Failed to fetch low stock products' }, { status: 500 });
  }
} 