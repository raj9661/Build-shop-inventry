import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { validateToken } from '@/app/lib/tokenUtils';
import { getShopFilter } from '@/app/lib/shopAccessUtils';
import { serializeBigInt } from '@/app/lib/serializationUtils';


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
    const timeframe = searchParams.get('timeframe') || '30days'; // 7days, 30days, all
    const shopFilter = await getShopFilter(token);

    // 1. Truckload Profitability (Direct Sales)
    // We look for Sales that have "Direct Truck Sale" in notes
    const directSales = await prisma.sale.findMany({
      where: {
        ...shopFilter,
        notes: { contains: 'Direct Truck Sale' },
        isActive: true
      },
      include: {
        items: true,
        customer: { select: { name: true } }
      }
    });

    const truckloadProfits = directSales.map(sale => {
      // Extract original StockEntry cost if possible (from notes or items)
      // For now, we'll calculate based on the sale item profit margin
      const revenue = Number(sale.finalAmount);
      // This is a simplification; in a real scenario we'd link to the StockEntry price
      // For direct sales, the StockEntry unitPrice is the cost.
      return {
        saleId: sale.id.toString(),
        customer: sale.customer?.name || 'Walk-in',
        date: sale.saleDate,
        revenue,
        // Assuming 10% margin if cost not found, or ideally fetch from StockEntry
        profit: revenue * 0.1, 
        items: sale.items.map(i => ({ 
          name: i.unitName, 
          qty: Number(i.quantity) 
        }))
      };
    });

    // 2. Wastage & Loss Tracking
    const wastageData = await prisma.stockLedger.findMany({
      where: {
        ...shopFilter,
        transactionType: 'LOSS'
      },
      include: {
        product: { select: { name: true } }
      }
    });

    const wastageSummary = wastageData.reduce((acc: any, curr) => {
      const key = curr.product.name;
      if (!acc[key]) acc[key] = 0;
      acc[key] += Number(curr.cftQuantity);
      return acc;
    }, {});

    // 3. Inventory Velocity (Sales per day)
    const recentSales = await prisma.stockLedger.findMany({
      where: {
        ...shopFilter,
        transactionType: 'SALE',
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      },
      include: {
        product: { select: { name: true } }
      }
    });

    const velocitySummary = recentSales.reduce((acc: any, curr) => {
      const key = curr.product.name;
      if (!acc[key]) acc[key] = 0;
      acc[key] += Number(curr.cftQuantity);
      return acc;
    }, {});

    return NextResponse.json({
      success: true,
      data: {
        truckloadProfits,
        wastageSummary,
        velocitySummary: Object.entries(velocitySummary).map(([name, qty]) => ({ name, velocity: Number(qty) / 30 }))
      }
    });

  } catch (error) {
    console.error('Analytics error:', error);
    return NextResponse.json({ success: false, message: 'Failed to fetch analytics' }, { status: 500 });
  }
}
