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

    // Validate supplier exists
    const supplier = await prisma.supplier.findUnique({ where: { id: BigInt(supplierId) } });
    if (!supplier) {
      return NextResponse.json({ success: false, message: 'Supplier not found' }, { status: 404 });
    }

    // Create payment
    const payment = await prisma.supplierPayment.create({
      data: {
        supplierId: BigInt(supplierId),
        amount,
        paymentMethod: paymentMethod as PaymentMethod,
        paymentDate: new Date(paymentDate),
        shopId: BigInt(shopId),
        notes: notes || null,
        isActive: true
      }
    });

    // If week is provided, mark stock entries for that supplier, shop, and week as paid
    if (week) {
      // Helper function to get week string from date
      function getWeekString(date: Date): string {
        const d = new Date(date);
        const year = d.getFullYear();
        const onejan = new Date(d.getFullYear(), 0, 1);
        const weekNum = Math.ceil((((d.getTime() - onejan.getTime()) / 86400000) + onejan.getDay() + 1) / 7);
        return `${year}-W${weekNum}`;
      }

      // Find all stock entries for this supplier and shop
      const stockEntries = await prisma.stockEntry.findMany({
        where: {
          supplierId: BigInt(supplierId),
          shopId: BigInt(shopId),
          isActive: true,
          paymentStatus: 'PENDING'
        },
        orderBy: { entryDate: 'asc' }
      });

      // Filter entries matching the specified week
      const entriesToUpdate = stockEntries.filter(e => getWeekString(e.entryDate) === week);

      // Update payment status for matching entries
      if (entriesToUpdate.length > 0) {
        await prisma.stockEntry.updateMany({
          where: {
            id: { in: entriesToUpdate.map(e => BigInt(e.id)) }
          },
          data: {
            paymentStatus: 'COMPLETED'
          }
        });
      }
    }

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

    return NextResponse.json({ success: true, data: { payment: safeBigInt(payment) }, message: 'Payment recorded successfully' });
  } catch (error) {
    console.error('Supplier payment error:', error);
    return NextResponse.json({ success: false, message: 'Failed to record payment' }, { status: 500 });
  }
} 