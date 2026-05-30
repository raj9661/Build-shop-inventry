import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { validateToken } from '@/app/lib/tokenUtils';
import { getShopFilter } from '@/app/lib/shopAccessUtils';


function serializeBigInt(obj: any): string {
  return JSON.stringify(obj, (_, value) =>
    typeof value === 'bigint' ? value.toString() : value
  );
}

function getLast12Months(): { label: string; start: Date; end: Date }[] {
  const months = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const year = now.getFullYear();
    const month = now.getMonth() - i;
    const start = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
    const end = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));
    const label = start.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
    months.push({ label, start, end });
  }
  return months;
}

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

    // Only SUPER_DUPER_ADMIN can access cement analytics
    if (decoded.role !== 'SUPER_DUPER_ADMIN') {
      return NextResponse.json({ success: false, message: 'Access denied' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const shopIdParam = searchParams.get('shopId');

    // Build shop where clause
    const shopFilter = await getShopFilter(token);
    let shopWhereClause: any = {};

    if (shopIdParam) {
      const shopId = parseInt(shopIdParam);
      if (!isNaN(shopId) && shopId > 0) {
        // Enforce that the requested shopId is actually within the user's allowed shops
        if ((shopFilter as any).shopId?.in?.includes(shopId)) {
          shopWhereClause = { shopId: BigInt(shopId) };
        } else {
          return NextResponse.json({ success: false, message: 'Unauthorized shop access' }, { status: 403 });
        }
      }
    } else if (Object.keys(shopFilter).length > 0) {
      Object.assign(shopWhereClause, shopFilter);
    }

    // Fail closed: if we somehow ended up with no shop filter (e.g. error in getShopFilter),
    // force an invalid shop ID so we don't accidentally query all shops.
    if (Object.keys(shopWhereClause).length === 0) {
      return NextResponse.json({ success: false, message: 'Unable to determine shop access' }, { status: 403 });
    }

    const months = getLast12Months();
    const rangeStart = months[0].start;
    const rangeEnd = months[months.length - 1].end;

    // ── Step 1: Find all cement products (category name contains 'cement') ──
    const cementProducts = await prisma.product.findMany({
      where: {
        ...shopWhereClause,
        isActive: true,
        category: { name: { contains: 'cement', mode: 'insensitive' } }
      },
      select: {
        id: true,
        name: true,
        type: { select: { name: true } },  // brand name
        category: { select: { name: true } }
      }
    });

    if (cementProducts.length === 0) {
      return new NextResponse(serializeBigInt({
        success: true,
        data: { salesByMonth: [], purchasesByMonth: [], allBrands: [] }
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    const cementProductIds = cementProducts.map(p => p.id);
    // Brand lookup: productId → brand name (from ProductType.name)
    const brandByProductId = new Map<string, string>(
      cementProducts.map(p => [p.id.toString(), p.type?.name || p.name || 'Unknown'])
    );

    // Collect all unique brands
    const allBrandsSet = new Set<string>(
      cementProducts.map(p => p.type?.name || p.name || 'Unknown')
    );
    const allBrands = Array.from(allBrandsSet).sort();

    // ── Step 2: Fetch all cement sale items in last 12 months ──
    const cementSaleItems = await prisma.saleItem.findMany({
      where: {
        productId: { in: cementProductIds },
        isActive: true,
        sale: {
          isActive: true,
          saleDate: { gte: rangeStart, lte: rangeEnd },
          ...shopWhereClause
        }
      },
      select: {
        productId: true,
        quantity: true,
        totalPrice: true,
        sale: { select: { saleDate: true } }
      }
    });

    // ── Step 3: Fetch all cement stock entries (purchases) in last 12 months ──
    const cementStockEntries = await prisma.stockEntry.findMany({
      where: {
        productId: { in: cementProductIds },
        isActive: true,
        entryDate: { gte: rangeStart, lte: rangeEnd },
        ...shopWhereClause
      },
      select: {
        productId: true,
        quantity: true,
        unitPrice: true,
        totalAmount: true,
        entryDate: true
      }
    });

    // ── Step 4: Aggregate by month ──
    const salesByMonth = months.map(({ label, start, end }) => {
      // Sales for this month
      const monthSaleItems = cementSaleItems.filter(item => {
        const d = new Date(item.sale.saleDate);
        return d >= start && d <= end;
      });

      // Group by brand
      const brands: Record<string, { quantity: number; revenue: number }> = {};
      for (const brand of allBrands) brands[brand] = { quantity: 0, revenue: 0 };

      let totalQuantity = 0;
      let totalRevenue = 0;

      for (const item of monthSaleItems) {
        const brand = brandByProductId.get(item.productId.toString()) || 'Unknown';
        const qty = Number(item.quantity);
        const rev = Number(item.totalPrice);
        if (!brands[brand]) brands[brand] = { quantity: 0, revenue: 0 };
        brands[brand].quantity += qty;
        brands[brand].revenue += rev;
        totalQuantity += qty;
        totalRevenue += rev;
      }

      return { month: label, brands, totalQuantity, totalRevenue };
    });

    const purchasesByMonth = months.map(({ label, start, end }) => {
      const monthEntries = cementStockEntries.filter(entry => {
        const d = new Date(entry.entryDate);
        return d >= start && d <= end;
      });

      const brands: Record<string, { quantity: number; totalCost: number; avgBuyingPrice: number; entryCount: number }> = {};
      for (const brand of allBrands) brands[brand] = { quantity: 0, totalCost: 0, avgBuyingPrice: 0, entryCount: 0 };

      let totalQuantity = 0;
      let totalCost = 0;

      for (const entry of monthEntries) {
        const brand = brandByProductId.get(entry.productId.toString()) || 'Unknown';
        const qty = Number(entry.quantity);
        const cost = Number(entry.totalAmount);
        const unitPrice = Number(entry.unitPrice);
        if (!brands[brand]) brands[brand] = { quantity: 0, totalCost: 0, avgBuyingPrice: 0, entryCount: 0 };
        brands[brand].quantity += qty;
        brands[brand].totalCost += cost;
        brands[brand].entryCount += 1;
        // Running weighted average
        brands[brand].avgBuyingPrice = brands[brand].quantity > 0
          ? brands[brand].totalCost / brands[brand].quantity
          : unitPrice;
        totalQuantity += qty;
        totalCost += cost;
      }

      return { month: label, brands, totalQuantity, totalCost };
    });

    return new NextResponse(serializeBigInt({
      success: true,
      data: { salesByMonth, purchasesByMonth, allBrands }
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });

  } catch (error: any) {
    console.error('Cement analytics error:', error);
    return NextResponse.json({ success: false, message: 'Failed to fetch cement analytics', error: error.message }, { status: 500 });
  } finally {
  }
}
