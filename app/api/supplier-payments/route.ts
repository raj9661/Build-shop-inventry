import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient, PaymentMethod } from '@prisma/client';
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
      return NextResponse.json({ success: false, message: 'Invalid or expired token' }, { status: 401 });
    }

    const body = await req.json();
    const { supplierId, amount, paymentMethod, paymentDate, shopId, notes, week } = body;

    if (!supplierId || !amount || !paymentMethod || !paymentDate || !shopId) {
      return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      // Validate supplier exists
      const supplier = await tx.supplier.findUnique({ where: { id: BigInt(supplierId) } });
      if (!supplier) {
        throw new Error('Supplier not found');
      }

      // Create a single consolidated payment record
      const payment = await tx.supplierPayment.create({
        data: {
          supplierId: BigInt(supplierId),
          amount: Number(amount),
          paymentMethod: paymentMethod as PaymentMethod,
          paymentDate: new Date(paymentDate),
          shopId: BigInt(shopId),
          notes: notes || null,
          isActive: true
        }
      });

      // Distribution Logic
      let remainingAmount = Number(amount);

      if (week) {
        // Specific week payment logic
        function getWeekString(date: Date): string {
          const d = new Date(date);
          const year = d.getFullYear();
          const onejan = new Date(d.getFullYear(), 0, 1);
          const weekNum = Math.ceil((((d.getTime() - onejan.getTime()) / 86400000) + onejan.getDay() + 1) / 7);
          return `${year}-W${weekNum}`;
        }

        const stockEntries = await tx.stockEntry.findMany({
          where: {
            supplierId: BigInt(supplierId),
            shopId: BigInt(shopId),
            isActive: true,
            paymentStatus: 'PENDING'
          },
          orderBy: { entryDate: 'asc' }
        });

        const entriesToUpdate = stockEntries.filter(e => getWeekString(e.entryDate) === week);

        if (entriesToUpdate.length > 0) {
          await tx.stockEntry.updateMany({
            where: { id: { in: entriesToUpdate.map(e => e.id) } },
            data: { paymentStatus: 'COMPLETED' }
          });
        }
      } else {
        // Automatic distribution logic (Oldest first)
        const pendingEntries = await tx.stockEntry.findMany({
          where: {
            supplierId: BigInt(supplierId),
            shopId: BigInt(shopId),
            isActive: true,
            paymentStatus: 'PENDING'
          },
          orderBy: { entryDate: 'asc' }
        });

        for (const entry of pendingEntries) {
          if (remainingAmount <= 0) break;
          const entryAmount = Number(entry.totalAmount);
          
          if (remainingAmount >= entryAmount) {
            await tx.stockEntry.update({
              where: { id: entry.id },
              data: { paymentStatus: 'COMPLETED' }
            });
            remainingAmount -= entryAmount;
          } else {
            // Partial payment for a single entry? 
            // In the current schema, we don't have partial payment status per entry.
            // For now, we only mark as COMPLETED if fully paid, or we could just leave it PENDING.
            // Decision: If we can't fully cover the entry, we stop distribution. 
            // The balance will still be deducted from the supplier's total outstanding.
            break;
          }
        }
      }

      // Deduct paid amount from supplier's outstandingPayment (floor at 0)
      const freshSupplier = await tx.supplier.findUnique({ where: { id: BigInt(supplierId) } });
      const currentOutstanding = Number(freshSupplier?.outstandingPayment ?? 0);
      const newOutstanding = Math.max(0, currentOutstanding - Number(amount));
      
      await tx.supplier.update({
        where: { id: BigInt(supplierId) },
        data: { outstandingPayment: newOutstanding }
      });

      return payment;
    });

    // Fix BigInt serialization
    function safeBigInt(obj: any): any {
      if (Array.isArray(obj)) return obj.map(safeBigInt);
      if (obj && typeof obj === 'object') {
        const out: any = {};
        for (const k in obj) {
          if (typeof obj[k] === 'bigint') out[k] = obj[k].toString();
          else out[k] = safeBigInt(obj[k]);
        }
        return out;
      }
      return obj;
    }

    return NextResponse.json({ success: true, data: { payment: safeBigInt(result) }, message: 'Payment recorded successfully' });
  } catch (error: any) {
    console.error('Supplier payment error:', error);
    return NextResponse.json({ success: false, message: error.message || 'Failed to record payment' }, { status: 500 });
  }
}
 