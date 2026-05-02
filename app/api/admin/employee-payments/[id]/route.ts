import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { validateToken } from '@/app/lib/tokenUtils';
import { getShopFilter } from '@/app/lib/shopAccessUtils';

const prisma = new PrismaClient();

// PATCH - Edit employee payment
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    if (decoded.role !== 'SUPER_DUPER_ADMIN') {
      return NextResponse.json({ success: false, message: 'Forbidden: SUPER_DUPER_ADMIN only' }, { status: 403 });
    }

    const { id } = await params;
    const paymentId = BigInt(id);
    const body = await req.json();
    const { amount, paymentDate, paymentMethod, notes } = body;

    const existingPayment = await prisma.employeePayment.findFirst({
      where: { id: paymentId, isActive: true },
      include: { employee: true }
    });

    if (!existingPayment) {
      return NextResponse.json({ success: false, message: 'Payment not found' }, { status: 404 });
    }

    const updatedPayment = await prisma.employeePayment.update({
      where: { id: paymentId },
      data: {
        ...(amount !== undefined && { amount }),
        ...(paymentDate && { paymentDate: new Date(paymentDate) }),
        ...(paymentMethod && { paymentMethod }),
        ...(notes !== undefined && { notes })
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Payment updated successfully',
      data: {
        id: Number(updatedPayment.id),
        amount: Number(updatedPayment.amount)
      }
    });
  } catch (error) {
    console.error('Update payment error:', error);
    return NextResponse.json({ success: false, message: 'Failed to update payment' }, { status: 500 });
  }
}

// DELETE - Soft delete employee payment
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    if (decoded.role !== 'SUPER_DUPER_ADMIN') {
      return NextResponse.json({ success: false, message: 'Forbidden: SUPER_DUPER_ADMIN only' }, { status: 403 });
    }

    const { id } = await params;
    const paymentId = BigInt(id);

    const existingPayment = await prisma.employeePayment.findFirst({
      where: { id: paymentId, isActive: true }
    });

    if (!existingPayment) {
      return NextResponse.json({ success: false, message: 'Payment not found' }, { status: 404 });
    }

    await prisma.employeePayment.update({
      where: { id: paymentId },
      data: { isActive: false }
    });

    return NextResponse.json({ success: true, message: 'Payment deleted successfully' });
  } catch (error) {
    console.error('Delete payment error:', error);
    return NextResponse.json({ success: false, message: 'Failed to delete payment' }, { status: 500 });
  }
}
