import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { validateToken } from '@/app/lib/tokenUtils';

const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, message: 'Access token required' }, { status: 401 });
    }
    
    const token = authHeader.substring(7);
    const decoded = await validateToken(token);
    if (!decoded) {
      return NextResponse.json({ success: false, message: 'Invalid token' }, { status: 401 });
    }

    const { shopId } = await req.json();
    if (!shopId) {
      return NextResponse.json({ success: false, message: 'Shop ID required' }, { status: 400 });
    }

    // Find all active suppliers for this shop
    const suppliers = await prisma.supplier.findMany({
      where: { shopId: BigInt(shopId), isActive: true }
    });

    const results = [];

    for (const supplier of suppliers) {
      // Calculate real outstanding balance from StockEntries
      const stockAggregate = await prisma.stockEntry.aggregate({
        where: {
          supplierId: supplier.id,
          paymentStatus: 'PENDING',
          isActive: true
        },
        _sum: {
          totalAmount: true
        }
      });

      const realBalance = Number(stockAggregate._sum.totalAmount || 0);

      // Update the supplier's outstandingPayment field
      await prisma.supplier.update({
        where: { id: supplier.id },
        data: { outstandingPayment: realBalance }
      });

      results.push({
        id: supplier.id.toString(),
        name: supplier.name,
        oldBalance: Number(supplier.outstandingPayment),
        newBalance: realBalance
      });
    }

    return NextResponse.json({ 
      success: true, 
      message: `Synced balances for ${results.length} suppliers`,
      data: { results }
    });
  } catch (error) {
    console.error('Sync balances error:', error);
    return NextResponse.json({ success: false, message: 'Failed to sync balances' }, { status: 500 });
  }
}
