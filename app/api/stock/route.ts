import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateToken } from '@/app/lib/tokenUtils';
import { getShopFilter } from '@/app/lib/shopAccessUtils';
import { serializeBigInt } from '@/app/lib/serializationUtils';

// GET — stock entries list  OR  price-history for a product
// ?priceHistory=true&productId=X&shopId=Y  → returns all stock arrivals for that product ordered by date
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, message: 'Access token required' }, { status: 401 });
    }
    const token = authHeader.substring(7);
    const decoded = await validateToken(token);
    if (!decoded) {
      return NextResponse.json({ success: false, message: 'Invalid or expired token' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);

    // ── Price-history mode ────────────────────────────────────────────────────
    // GET /api/stock?priceHistory=true&productId=123&shopId=1
    // Returns all stock batches for a product with their price and arrival date
    if (searchParams.get('priceHistory') === 'true') {
      const productId = searchParams.get('productId');
      const shopId    = searchParams.get('shopId');

      if (!productId || !shopId) {
        return NextResponse.json(
          { success: false, message: 'productId and shopId are required for price history' },
          { status: 400 },
        );
      }

      const entries = await prisma.stockEntry.findMany({
        where: {
          productId: BigInt(productId),
          shopId:    BigInt(shopId),
          isActive:  true,
        },
        select: {
          id:        true,
          entryDate: true,
          unitPrice: true,
          quantity:  true,
          unitName:  true,
          notes:     true,
          paymentStatus: true,
          supplier: { select: { name: true } },
        },
        orderBy: { entryDate: 'desc' },
      });

      return NextResponse.json({ success: true, data: { priceHistory: entries.map(serializeBigInt) } });
    }

    // ── Normal stock-entries list mode ────────────────────────────────────────
    const shopFilter = await getShopFilter(token);
    const requestedShopId = searchParams.get('shopId');
    const whereClause: any = { isActive: true };

    if (requestedShopId) {
      const shopIdNum = parseInt(requestedShopId);
      const hasAccess =
        shopFilter.shopId?.in?.includes(shopIdNum) ||
        (shopFilter.shopId && shopFilter.shopId === shopIdNum) ||
        Object.keys(shopFilter).length === 0;   // global-access roles

      if (hasAccess) {
        whereClause.shopId = shopIdNum;
      } else {
        whereClause.shopId = -1; // deny — return empty
      }
    } else if (Object.keys(shopFilter).length > 0) {
      Object.assign(whereClause, shopFilter);
    }

    const stockEntries = await prisma.stockEntry.findMany({
      where: whereClause,
      include: {
        product:  { select: { name: true, category: { select: { name: true } } } },
        supplier: { select: { name: true } },
        shop:     { select: { name: true } },
      },
      orderBy: { entryDate: 'desc' },
    });

    const safeStockEntries = stockEntries.map(entry => ({
      ...entry,
      id:         entry.id.toString(),
      productId:  entry.productId?.toString?.() ?? entry.productId,
      supplierId: entry.supplierId?.toString?.() ?? entry.supplierId,
      shopId:     entry.shopId?.toString?.() ?? entry.shopId,
    }));

    return NextResponse.json({ success: true, data: { stockEntries: safeStockEntries } });
  } catch (error) {
    console.error('Get stock entries error:', error);
    return NextResponse.json({ success: false, message: 'Failed to fetch stock entries' }, { status: 500 });
  }
}

// POST — Create a new stock entry
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, message: 'Access token required' }, { status: 401 });
    }
    const token = authHeader.substring(7);
    const decoded = await validateToken(token);
    if (!decoded) {
      return NextResponse.json({ success: false, message: 'Invalid or expired token' }, { status: 401 });
    }

    const body = await req.json();
    const {
      productName, categoryId, typeId,
      supplierName, supplierPhone,
      quantity, unitPrice,
      unit, entryDate, notes,
      sku, price, costPrice,
      minStockLevel, maxStockLevel,
      paymentStatus, unitName,
      conversionCft, sellingPrice,
    } = body;

    if (!productName || !categoryId || !typeId || !supplierName || !quantity || !unitPrice) {
      return NextResponse.json({
        success: false,
        message: 'Missing required fields: productName, categoryId, typeId, supplierName, quantity, unitPrice',
      }, { status: 400 });
    }

    const shopFilter = await getShopFilter(token);
    if (Object.keys(shopFilter).length === 0) {
      return NextResponse.json({ success: false, message: 'No shop access found' }, { status: 403 });
    }

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

    const convFactor = conversionCft ? parseFloat(conversionCft) : 1;
    const totalCft   = Number(quantity || 0) * convFactor;
    const newUnitPrice    = parseFloat(unitPrice);
    const newSellingPrice = sellingPrice ? parseFloat(sellingPrice) : (price ? parseFloat(price) : newUnitPrice);

    const result = await prisma.$transaction(async (tx) => {
      // 1. Find or create supplier
      let supplier = await tx.supplier.findFirst({
        where: { name: supplierName, shopId, isActive: true },
      });
      if (!supplier) {
        supplier = await tx.supplier.create({
          data: { name: supplierName, phone: supplierPhone, shopId, isActive: true },
        });
      }

      // 2. Find or create product
      let product = await tx.product.findFirst({
        where: { name: productName, categoryId: parseInt(categoryId), shopId, isActive: true },
        include: { category: { select: { name: true } } },
      });

      if (!product) {
        // New product — create it
        product = await tx.product.create({
          data: {
            name: productName,
            categoryId: parseInt(categoryId),
            typeId: parseInt(typeId),
            shopId,
            unit: unit || 'unit',
            price:     newSellingPrice,
            costPrice: costPrice ? parseFloat(costPrice) : newUnitPrice,
            sku,
            stockQuantity: 0,
            minStockLevel: minStockLevel ?? 0,
            maxStockLevel: maxStockLevel ?? null,
            isActive: true,
          },
          include: { category: { select: { name: true } } },
        });
      } else {
        // ── Existing product re-stocked at a (possibly new) price ─────────────
        // Update costPrice and selling price so Add Sale always shows the latest price
        await tx.product.update({
          where: { id: product.id },
          data: {
            costPrice: costPrice ? parseFloat(costPrice) : newUnitPrice,
            // Only overwrite selling price if explicitly provided
            ...(newSellingPrice !== newUnitPrice ? { price: newSellingPrice } : {}),
            // Ensure SKU stays up-to-date if provided
            ...(sku ? { sku } : {}),
          },
        });
        // Reload with updated values
        product = await tx.product.findUnique({
          where: { id: product.id },
          include: { category: { select: { name: true } } },
        }) as typeof product;
      }

      if (!product) throw new Error('Failed to find or create product');

      const categoryName = (product as any)?.category?.name?.toLowerCase()?.trim() || '';
      const isCement = categoryName.includes('cement');
      const isLoose  = unit === 'kg' || unitName === 'kg' || notes?.toLowerCase().includes('loose');

      // 3. Create stock entry — records the exact price and date of THIS batch
      const stockEntry = await tx.stockEntry.create({
        data: {
          productId:     product.id,
          supplierId:    supplier.id,
          quantity:      parseInt(quantity),
          unitName:      unitName || null,
          conversionCft: conversionCft ? parseFloat(conversionCft) : null,
          unitPrice:     newUnitPrice,
          totalAmount:   newUnitPrice * parseInt(quantity),
          entryDate:     new Date(entryDate),
          notes,
          shopId,
          isActive:      true,
          paymentStatus: paymentStatus && ['PENDING','COMPLETED','FAILED','CANCELLED'].includes(paymentStatus)
            ? paymentStatus
            : 'PENDING',
        },
      });

      // 4. Increment product stock quantity
      await tx.product.update({
        where: { id: product.id },
        data: {
          stockQuantity: {
            increment: (isCement && !isLoose) ? Number(quantity) : totalCft,
          },
        },
      });

      // 5. Create stock ledger entry
      await tx.stockLedger.create({
        data: {
          productId:       product.id,
          shopId,
          transactionType: 'PURCHASE',
          unitName:        unitName || unit || 'unit',
          unitQuantity:    Number(quantity),
          cftQuantity:     (isCement && !isLoose) ? Number(quantity) : totalCft,
          referenceId:     stockEntry.id,
          notes:           notes || `Purchase from ${supplierName} @ ₹${newUnitPrice}/unit`,
        },
      });

      // 6. Update supplier outstanding balance (if not already paid)
      if (stockEntry.paymentStatus === 'PENDING') {
        await tx.supplier.update({
          where: { id: supplier.id },
          data: { outstandingPayment: { increment: Number(stockEntry.totalAmount) } },
        });
      }

      return { stockEntry, product, supplier };
    });

    return NextResponse.json({
      success: true,
      data: serializeBigInt(result),
      message: 'Stock entry created successfully',
    });
  } catch (error) {
    console.error('Create stock entry error:', error);
    return NextResponse.json({ success: false, message: 'Failed to create stock entry' }, { status: 500 });
  }
}

// PATCH — Update paymentStatus for a stock entry
export async function PATCH(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, message: 'Access token required' }, { status: 401 });
    }
    const token = authHeader.substring(7);
    const decoded = await validateToken(token);
    if (!decoded) {
      return NextResponse.json({ success: false, message: 'Invalid or expired token' }, { status: 401 });
    }

    const { id, paymentStatus } = await req.json();
    if (!id || !paymentStatus || !['PENDING','COMPLETED','FAILED','CANCELLED'].includes(paymentStatus)) {
      return NextResponse.json({ success: false, message: 'Missing or invalid id/paymentStatus' }, { status: 400 });
    }

    const updated = await prisma.stockEntry.update({
      where: { id: BigInt(id) },
      data: { paymentStatus },
    });

    return NextResponse.json({ success: true, data: serializeBigInt(updated) });
  } catch (error) {
    console.error('Update stock entry paymentStatus error:', error);
    return NextResponse.json({ success: false, message: 'Failed to update payment status' }, { status: 500 });
  }
}