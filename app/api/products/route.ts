import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateToken } from '@/app/lib/tokenUtils';
import { getShopFilter } from '@/app/lib/shopAccessUtils';
import { serializeBigInt } from '@/app/lib/serializationUtils';


// GET - List all products (filtered by user's shop access)
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
    
    // Check for shopId query parameter
    const { searchParams } = new URL(req.url);
    const shopIdParam = searchParams.get('shopId');
    let whereClause: any = { isActive: true };
    
    if (shopIdParam) {
      const shopId = parseInt(shopIdParam);
      if (!isNaN(shopId)) {
        console.log('🔍 Products API - Parsed shopId:', shopId);
        console.log('🔍 Products API - Shop filter has shopId:', 'shopId' in shopFilter);
        console.log('🔍 Products API - Shop filter shopId.in:', (shopFilter as any).shopId?.in);
        console.log('🔍 Products API - ShopId in filter:', (shopFilter as any).shopId?.in?.includes(shopId));
        
        // Check if user can access this shop
        let hasAccess = false;
        
        if (Object.keys(shopFilter).length === 0) {
          // No shop filter means access to all shops
          hasAccess = true;
        } else if (shopFilter.createdBy) {
          // For SUPER_DUPER_ADMIN, check if they created this shop
          const shop = await prisma.shop.findUnique({
            where: { id: BigInt(shopId) },
            select: { createdBy: true, isActive: true }
          });
          hasAccess = !!(shop && Number(shop.createdBy) === Number(shopFilter.createdBy) && shop.isActive);
          console.log('🔍 Products API - SUPER_DUPER_ADMIN shop check:', {
            shopId,
            shopCreatedBy: shop?.createdBy,
            userCreatedBy: shopFilter.createdBy,
            isActive: shop?.isActive,
            hasAccess
          });
        } else if ('shopId' in shopFilter && Array.isArray((shopFilter as any).shopId?.in)) {
          // For other roles, check if shopId is in their allowed shops
          hasAccess = (shopFilter as any).shopId.in.includes(shopId);
        }
        
        if (hasAccess) {
          whereClause.shopId = shopId;
        } else {
          return NextResponse.json({ success: false, message: 'You do not have access to this shop' }, { status: 403 });
        }
      }
    } else if (Object.keys(shopFilter).length > 0) {
      // Convert shop filter to product filter
      if (shopFilter.createdBy) {
        // For SUPER_DUPER_ADMIN, get shops they created and filter by shopId
        const createdShops = await prisma.shop.findMany({
          where: {
            createdBy: shopFilter.createdBy,
            isActive: shopFilter.isActive
          },
          select: { id: true }
        });
        const shopIds = createdShops.map(shop => Number(shop.id));
        whereClause.shopId = { in: shopIds };
      } else if (shopFilter.shopId) {
        whereClause.shopId = shopFilter.shopId;
      }
    }

    const products = await prisma.product.findMany({ 
      where: whereClause,
      select: {
        id: true,
        name: true,
        description: true,
        unit: true,
        price: true,
        costPrice: true,
        stockQuantity: true,
        minStockLevel: true,
        maxStockLevel: true,
        sku: true,
        updatedAt: true,
        damagedQuantity: true, // <-- Added this line
        category: { select: { id: true, name: true } },
        type: { select: { id: true, name: true, bundleSize: true } } as any,
        shop: { select: { name: true, location: true } },
        stockEntries: {
          select: { conversionCft: true },
          where: { conversionCft: { not: null } },
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });

    // Fetch today's daily rates for all products
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const productIds = products.map(p => p.id);
    const dailyRates = await prisma.dailyProductPrice.findMany({
      where: {
        productId: { in: productIds },
        date: today
      },
      select: {
        productId: true,
        price: true
      }
    });
    const dailyRateMap = new Map(dailyRates.map(dr => [dr.productId, dr.price]));

    // For products with no DailyProductPrice today, fall back to the latest StockEntry unitPrice.
    // This ensures Add Sale always shows the price from the most recently arrived stock batch.
    const productsWithoutDailyRate = productIds.filter(id => !dailyRateMap.has(id));
    let latestStockPriceMap = new Map<bigint, any>();

    if (productsWithoutDailyRate.length > 0) {
      // One query: latest stock entry per product using groupBy is not supported in Prisma CockroachDB
      // so we fetch latest entry per product in a single findMany + group in JS
      const latestStockEntries = await prisma.stockEntry.findMany({
        where: {
          productId: { in: productsWithoutDailyRate },
          isActive: true,
        },
        select: { productId: true, unitPrice: true, entryDate: true },
        orderBy: { entryDate: 'desc' },
      });
      // Keep only the most-recent entry per product
      for (const entry of latestStockEntries) {
        if (!latestStockPriceMap.has(entry.productId)) {
          latestStockPriceMap.set(entry.productId, entry.unitPrice);
        }
      }
    }

    // Attach dailyRate, latestCostPrice, and conversion CFT to each product
    const productsWithDailyRate = products.map(product => {
      const latestStockEntry = product.stockEntries?.[0];
      const dailyRate = dailyRateMap.has(product.id) ? dailyRateMap.get(product.id) : null;
      // If no daily rate is set today, use the price from the latest stock arrival
      const latestCostPrice = dailyRate
        ? null
        : (latestStockPriceMap.get(product.id) ?? null);
      return {
        ...product,
        dailyRate,
        latestCostPrice,          // ← new: frontend should prefer this over product.price
        latestConversionCft: latestStockEntry?.conversionCft ? Number(latestStockEntry.conversionCft) : 1,
      };
    });

    // Serialize all BigInt fields in the response
    const serializedProducts = productsWithDailyRate.map(serializeBigInt);

    return NextResponse.json({ success: true, data: { products: serializedProducts } });
  } catch (error) {
    console.error('Get products error:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined
    });
    return NextResponse.json({ 
      success: false, 
      message: 'Failed to fetch products',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// POST - Create a new product
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
    const { name, categoryId, typeId, shopId, unit, price, costPrice, description, sku, barcode, stockQuantity, minStockLevel, maxStockLevel } = body;
    if (!name || !categoryId || !typeId || !shopId || !unit || !price || !costPrice) {
      return NextResponse.json({ success: false, message: 'Missing required fields: name, categoryId, typeId, shopId, unit, price, costPrice' }, { status: 400 });
    }
    const product = await prisma.product.create({
      data: {
        name,
        categoryId,
        typeId,
        shopId,
        unit,
        price,
        costPrice,
        description,
        sku,
        barcode,
        stockQuantity,
        minStockLevel,
        maxStockLevel,
        isActive: true
      }
    });
    
    // Convert BigInt fields to numbers for JSON serialization
    const serializedProduct = {
      id: Number(product.id),
      name: product.name,
      description: product.description,
      sku: product.sku,
      barcode: product.barcode,
      categoryId: product.categoryId ? Number(product.categoryId) : null,
      typeId: product.typeId ? Number(product.typeId) : null,
      shopId: product.shopId ? Number(product.shopId) : null,
      unit: product.unit,
      price: product.price,
      costPrice: product.costPrice,
      stockQuantity: product.stockQuantity,
      minStockLevel: product.minStockLevel,
      maxStockLevel: product.maxStockLevel,
      isActive: product.isActive,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt
    };
    
    return NextResponse.json({ success: true, data: { product: serializedProduct } });
  } catch (error) {
    console.error('Create product error:', error);
    return NextResponse.json({ success: false, message: 'Failed to create product' }, { status: 500 });
  }
}

// PATCH - Update product fields (min/max stock, price, costPrice, sku)
export async function PATCH(req: NextRequest) {
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
    const { productId, minStockLevel, maxStockLevel, price, costPrice, sku, damagedQuantity, stockQuantity } = body;
    if (!productId) {
      return NextResponse.json({ success: false, message: 'Missing required field: productId' }, { status: 400 });
    }
    // Fetch current product to check category and values
    const currentProduct = await prisma.product.findUnique({ 
      where: { id: productId },
      include: {
        category: {
          select: { id: true, name: true }
        }
      }
    });
    if (!currentProduct) {
      return NextResponse.json({ success: false, message: 'Product not found' }, { status: 404 });
    }
    const updateData: any = {};
    if (minStockLevel !== undefined) updateData.minStockLevel = minStockLevel;
    if (maxStockLevel !== undefined) updateData.maxStockLevel = maxStockLevel;
    if (price !== undefined) updateData.price = price;
    if (costPrice !== undefined) updateData.costPrice = costPrice;
    if (sku !== undefined) updateData.sku = sku;
    if (damagedQuantity !== undefined) updateData.damagedQuantity = damagedQuantity;
    // Safeguard for cement: if damagedQuantity increases by 50, only allow stockQuantity to decrease by 1
    const isCementCategory = currentProduct.category?.name?.toLowerCase()?.trim() === 'cement';
    if (isCementCategory && damagedQuantity !== undefined && stockQuantity !== undefined) {
      const prevDamaged = Number(currentProduct.damagedQuantity || 0);
      const prevStock = Number(currentProduct.stockQuantity || 0);
      const damagedDiff = Number(damagedQuantity) - prevDamaged;
      const stockDiff = Number(stockQuantity) - prevStock;
      if (damagedDiff === 50 && stockDiff === -1) {
        // Adding damaged bag: increase damaged by 50, decrease stock by 1
        updateData.stockQuantity = stockQuantity;
      } else if (damagedDiff === -50 && stockDiff === 1) {
        // Removing damaged bag: decrease damaged by 50, increase stock by 1
        updateData.stockQuantity = stockQuantity;
      } else if (damagedDiff === 50 && stockDiff !== -1) {
        // Prevent accidental large reduction when adding damage
        updateData.stockQuantity = prevStock - 1;
      } else if (damagedDiff === -50 && stockDiff !== 1) {
        // Prevent accidental large increase when removing damage
        updateData.stockQuantity = prevStock + 1;
      } else if (stockQuantity !== undefined) {
        updateData.stockQuantity = stockQuantity;
      }
    } else if (stockQuantity !== undefined) {
      updateData.stockQuantity = stockQuantity;
    }
    const updated = await prisma.product.update({
      where: { id: productId },
      data: updateData
    });
    
    // Convert BigInt fields to numbers for JSON serialization
    const serializedProduct = {
      id: Number(updated.id),
      name: updated.name,
      description: updated.description,
      sku: updated.sku,
      barcode: updated.barcode,
      categoryId: updated.categoryId ? Number(updated.categoryId) : null,
      typeId: updated.typeId ? Number(updated.typeId) : null,
      shopId: updated.shopId ? Number(updated.shopId) : null,
      unit: updated.unit,
      price: updated.price,
      costPrice: updated.costPrice,
      stockQuantity: updated.stockQuantity,
      minStockLevel: updated.minStockLevel,
      maxStockLevel: updated.maxStockLevel,
      damagedQuantity: updated.damagedQuantity,
      isActive: updated.isActive,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt
    };
    
    return NextResponse.json({ success: true, data: { product: serializedProduct } });
  } catch (error) {
    console.error('Update product error:', error);
    return NextResponse.json({ success: false, message: 'Failed to update product' }, { status: 500 });
  }
} 