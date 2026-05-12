import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { validateToken } from '@/app/lib/tokenUtils';

const prisma = new PrismaClient();

// POST - Add an extra charge (e.g. vehicle fare) to a supplier's balance
// Only SUPER_DUPER_ADMIN can use this endpoint
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

    // 🔒 SUPER_DUPER_ADMIN only
    if (decoded.role !== 'SUPER_DUPER_ADMIN') {
      return NextResponse.json({ 
        success: false, 
        message: 'Only Super Admin can add extra charges to suppliers' 
      }, { status: 403 });
    }

    const body = await req.json();
    const { supplierId, amount, description, date, shopId } = body;

    if (!supplierId || !amount || !description || !shopId) {
      return NextResponse.json({ 
        success: false, 
        message: 'supplierId, amount, description and shopId are required' 
      }, { status: 400 });
    }

    const amountNum = Number(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return NextResponse.json({ success: false, message: 'Amount must be a positive number' }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      // Validate supplier exists
      const supplier = await tx.supplier.findUnique({ where: { id: BigInt(supplierId) } });
      if (!supplier) throw new Error('Supplier not found');

      // Record charge as a SupplierPayment with negative amount so it shows in history
      // Notes prefix "EXTRA_CHARGE:" distinguishes it from regular payments in the UI
      const charge = await tx.supplierPayment.create({
        data: {
          supplierId: BigInt(supplierId),
          amount: -amountNum, // negative = charge added to balance
          paymentMethod: 'OTHER',
          paymentDate: date ? new Date(date) : new Date(),
          shopId: BigInt(shopId),
          notes: `EXTRA_CHARGE: ${description}`,
          isActive: true
        }
      });

      // Increment outstanding payment by the charge amount
      const currentOutstanding = Number(supplier.outstandingPayment ?? 0);
      await tx.supplier.update({
        where: { id: BigInt(supplierId) },
        data: { outstandingPayment: currentOutstanding + amountNum }
      });

      return charge;
    });

    // Serialize BigInt
    const serialized = {
      ...result,
      id: result.id.toString(),
      supplierId: result.supplierId.toString(),
      shopId: result.shopId.toString(),
      amount: Number(result.amount)
    };

    return NextResponse.json({ 
      success: true, 
      data: { charge: serialized }, 
      message: 'Extra charge added successfully' 
    });

  } catch (error: any) {
    console.error('Supplier charge error:', error);
    return NextResponse.json({ 
      success: false, 
      message: error.message || 'Failed to add charge' 
    }, { status: 500 });
  }
}
