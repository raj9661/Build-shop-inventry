import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { validateToken } from '@/app/lib/tokenUtils';
import { getShopFilter } from '@/app/lib/shopAccessUtils';
import { serializeBigInt } from '@/app/lib/serializationUtils';

const prisma = new PrismaClient();

// GET - List all stock entries (filtered by user's shop access)
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
    console.log('🔍 [Stock API] Shop filter for user:', decoded.userId, 'role:', decoded.role, 'filter:', shopFilter);

    // Check if specific shopId is requested in query params
    const { searchParams } = new URL(req.url);
    const requestedShopId = searchParams.get('shopId');
    console.log('🔍 [Stock API] Requested shopId from query params:', requestedShopId);

    // Build where clause with shop filter
    const whereClause: any = { isActive: true };

    // If specific shopId is requested, use it (but still respect user access)
    if (requestedShopId) {
      const shopIdNum = parseInt(requestedShopId);
      console.log('🔍 [Stock API] Using requested shopId:', shopIdNum);

      // Check if user has access to this specific shop
      const hasAccess = shopFilter.shopId?.in?.includes(shopIdNum) ||
        (shopFilter.shopId && shopFilter.shopId === shopIdNum);

      if (hasAccess) {
        whereClause.shopId = shopIdNum;
        console.log('🔍 [Stock API] User has access to requested shop, filtering by shopId:', shopIdNum);
      } else {
        console.log('🔍 [Stock API] User does not have access to requested shop:', shopIdNum);
        // Return empty result if user doesn't have access
        whereClause.shopId = -1; // Invalid shop ID to ensure no results
      }
    } else if (Object.keys(shopFilter).length > 0) {
      // Use the general shop filter if no specific shopId requested
      Object.assign(whereClause, shopFilter);
    }

    console.log('🔍 [Stock API] Final where clause:', whereClause);

    const stockEntries = await prisma.stockEntry.findMany({
      where: whereClause,
      include: {
        product: { select: { name: true, category: { select: { name: true } } } },
        supplier: { select: { name: true } },
        shop: { select: { name: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    console.log('🔍 [Stock API] Found stock entries:', stockEntries.length);
    console.log('🔍 [Stock API] Sample stock entry:', stockEntries[0]);

    // Convert BigInt fields to string for JSON serialization
    const safeStockEntries = stockEntries.map(entry => ({
      ...entry,
      id: entry.id.toString(),
      productId: entry.productId?.toString?.() ?? entry.productId,
      supplierId: entry.supplierId?.toString?.() ?? entry.supplierId,
      shopId: entry.shopId?.toString?.() ?? entry.shopId,
      paymentStatus: entry.paymentStatus, // Only access on entry, not on included relations
      // If you have other BigInt fields, add them here
    }));

    return NextResponse.json({ success: true, data: { stockEntries: safeStockEntries } });
  } catch (error) {
    console.error('Get stock entries error:', error);
    return NextResponse.json({ success: false, message: 'Failed to fetch stock entries' }, { status: 500 });
  }
}

// POST - Create a new stock entry
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
    const {
      productName,
      categoryId,
      typeId,
      supplierName,
      supplierPhone,
      quantity,
      unitPrice,
      unit,
      entryDate,
      notes,
      sku,
      price,
      costPrice,
      minStockLevel,
      maxStockLevel,
      paymentStatus, // Accept paymentStatus
      unitName,
      conversionCft,
      sellingPrice
    } = body;

    if (!productName || !categoryId || !typeId || !supplierName || !quantity || !unitPrice) {
      return NextResponse.json({
        success: false,
        message: 'Missing required fields: productName, categoryId, typeId, supplierName, quantity, unitPrice'
      }, { status: 400 });
    }


    // Get user's shop access
    const shopFilter = await getShopFilter(token);
    if (Object.keys(shopFilter).length === 0) {
      return NextResponse.json({ success: false, message: 'No shop access found' }, { status: 403 });
    }

    // For now, assume single shop access (can be enhanced for multi-shop users)
    let shopId: number | undefined;
    if ('shopId' in shopFilter) {
      if (shopFilter.shopId && typeof shopFilter.shopId === 'object' && 'in' in shopFilter.shopId) {
        shopId = shopFilter.shopId.in?.[0];
      } else if (typeof shopFilter.shopId === 'number') {
        shopId = shopFilter.shopId;
      }
    }

    if (!shopId) {
      return NextResponse.json({ success: false, message: 'No valid shop found' }, { status: 403 });
    }

    // Calculate normalized quantity in CFT
    const convFactor = conversionCft ? parseFloat(conversionCft) : 1;
    const totalCft = Number(quantity || 0) * convFactor;

    // Start a transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Find or create supplier
      let supplier = await tx.supplier.findFirst({
        where: {
          name: supplierName,
          shopId: shopId,
          isActive: true
        }
      });

      if (!supplier) {
        supplier = await tx.supplier.create({
          data: {
            name: supplierName,
            phone: supplierPhone,
            shopId: shopId,
            isActive: true
          }
        });
      }

      // 2. Find or create product
      let product = await tx.product.findFirst({
        where: {
          name: productName,
          categoryId: parseInt(categoryId),
          shopId: shopId,
          isActive: true
        }
      });

      if (!product) {
        product = await tx.product.create({
          data: {
            name: productName,
            categoryId: parseInt(categoryId),
            typeId: parseInt(typeId),
            shopId: shopId,
            unit: unit || 'unit',
            price: price ?? (sellingPrice || unitPrice),
            costPrice: costPrice ?? unitPrice,
            sku: sku,
            stockQuantity: 0, // Will be updated after stock entry
            minStockLevel: minStockLevel ?? 0,
            maxStockLevel: maxStockLevel ?? null,
            isActive: true
          }
        });
      }

      // 3. Create stock entry
      const stockEntry = await tx.stockEntry.create({
        data: {
          productId: product.id,
          supplierId: supplier.id,
          quantity: parseInt(quantity),
          unitName: unitName || null,
          conversionCft: conversionCft ? parseFloat(conversionCft) : null,
          unitPrice: parseFloat(unitPrice),
          totalAmount: parseFloat(unitPrice) * parseInt(quantity),
          entryDate: new Date(entryDate),
          notes: notes,
          shopId: shopId,
          isActive: true,
          paymentStatus: paymentStatus && ["PENDING", "COMPLETED", "FAILED", "CANCELLED"].includes(paymentStatus) ? paymentStatus : 'PENDING'
        }
      });

      // 4. Handle Stock Update and Ledger
      // Normal Purchase - Update stock and create ledger
      await tx.product.update({
        where: { id: product.id },
        data: {
          stockQuantity: {
            increment: totalCft
          }
        }
      });

      await tx.stockLedger.create({
        data: {
          productId: product.id,
          shopId: shopId,
          transactionType: 'PURCHASE',
          unitName: unitName || unit || 'unit',
          unitQuantity: Number(quantity),
          cftQuantity: totalCft,
          referenceId: stockEntry.id,
          notes: notes || `Purchase from ${supplierName}`,
        }
      });

      // 5. Update supplier outstanding payment if not paid
      if (stockEntry.paymentStatus === 'PENDING') {
        await tx.supplier.update({
          where: { id: supplier.id },
          data: { 
            outstandingPayment: {
              increment: Number(stockEntry.totalAmount)
            }
          }
        });
      }

      return { stockEntry, product, supplier };
    });

    return NextResponse.json({
      success: true,
      data: serializeBigInt(result),
      message: 'Stock entry created successfully'
    });
  } catch (error) {
    console.error('Create stock entry error:', error);
    return NextResponse.json({ success: false, message: 'Failed to create stock entry' }, { status: 500 });
  }
}

// PATCH - Update paymentStatus for a stock entry
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
    const { id, paymentStatus } = body;
    if (!id || !paymentStatus || !["PENDING", "COMPLETED", "FAILED", "CANCELLED"].includes(paymentStatus)) {
      return NextResponse.json({ success: false, message: 'Missing or invalid id/paymentStatus' }, { status: 400 });
    }
    const updated = await prisma.stockEntry.update({
      where: { id: BigInt(id) },
      data: { paymentStatus },
    });
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('Update stock entry paymentStatus error:', error);
    return NextResponse.json({ success: false, message: 'Failed to update payment status' }, { status: 500 });
  }
} 