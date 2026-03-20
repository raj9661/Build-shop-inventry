import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { validateToken } from '@/app/lib/tokenUtils';

const prisma = new PrismaClient();

interface SyncResult {
  id: string;
  name: string;
  oldBalance: number;
  newBalance: number;
  openingBalance: number;
  totalStock: number;
  totalPaid: number;
}

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

    const results: SyncResult[] = [];

    // Use a transaction to ensure atomicity for balance updates
    await prisma.$transaction(async (tx) => {
      for (const supplier of suppliers) {
        // Calculate real outstanding balance: Opening Balance + Total Stock - Total Payments
        
        const stockAggregate = await tx.stockEntry.aggregate({
          where: {
            supplierId: supplier.id,
            isActive: true
          },
          _sum: {
            totalAmount: true
          }
        });

        const paymentAggregate = await tx.supplierPayment.aggregate({
          where: {
            supplierId: supplier.id,
            isActive: true
          },
          _sum: {
            amount: true
          }
        });

        const tmtStockAggregate = await tx.tmtInventory.aggregate({
          where: {
            supplierId: supplier.id,
            isActive: true
          },
          _sum: {
            totalAmount: true
          }
        });

        const openingBalance = Number(supplier.openingBalance || 0);
        const totalStock = Number(stockAggregate._sum.totalAmount || 0) + Number(tmtStockAggregate._sum.totalAmount || 0);
        const totalPaid = Number(paymentAggregate._sum.amount || 0);
        
        const realBalance = openingBalance + totalStock - totalPaid;

        // Update the supplier's outstandingPayment field (floor at 0)
        const finalBalance = Math.max(0, realBalance);

        await tx.supplier.update({
          where: { id: supplier.id },
          data: { outstandingPayment: finalBalance }
        });

        results.push({
          id: supplier.id.toString(),
          name: supplier.name,
          oldBalance: Number(supplier.outstandingPayment),
          newBalance: finalBalance,
          openingBalance,
          totalStock,
          totalPaid
        });
      }
    });

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
