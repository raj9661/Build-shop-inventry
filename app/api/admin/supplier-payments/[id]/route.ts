import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateToken } from '@/app/lib/tokenUtils';

async function writeAuditLog(tx: any, {
  adminId, action, tableName, recordId, beforeData, afterData, reason, shopId
}: {
  adminId: bigint; action: string; tableName: string; recordId: bigint;
  beforeData: object; afterData?: object | null; reason?: string; shopId: bigint;
}) {
  await tx.adminAuditLog.create({
    data: {
      adminId,
      action,
      tableName,
      recordId,
      beforeData: JSON.stringify(beforeData, (_, v) => typeof v === 'bigint' ? v.toString() : v),
      afterData: afterData ? JSON.stringify(afterData, (_, v) => typeof v === 'bigint' ? v.toString() : v) : null,
      reason: reason || null,
      shopId,
    }
  });
}

// PATCH /api/admin/supplier-payments/[id]
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer '))
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

    const token = authHeader.substring(7);
    const decoded = await validateToken(token);
    if (!decoded)
      return NextResponse.json({ success: false, message: 'Invalid token' }, { status: 401 });
    if (decoded.role !== 'SUPER_DUPER_ADMIN')
      return NextResponse.json({ success: false, message: 'Forbidden: SUPER_DUPER_ADMIN only' }, { status: 403 });

    const { id } = await params;
    const paymentId = BigInt(id);
    const body = await req.json();
    const { amount, paymentDate, paymentMethod, notes, reason } = body;

    if (!reason || reason.trim() === '')
      return NextResponse.json({ success: false, message: 'Reason is required' }, { status: 400 });

    const payment = await prisma.supplierPayment.findUnique({ where: { id: paymentId } });
    if (!payment || !payment.isActive)
      return NextResponse.json({ success: false, message: 'Supplier payment not found' }, { status: 404 });

    const oldAmount = Number(payment.amount);
    const newAmount = amount !== undefined ? parseFloat(amount) : oldAmount;
    const delta = newAmount - oldAmount; // increase in payment = decrease in outstanding

    const updated = await prisma.$transaction(async (tx) => {
      const before = { ...payment };

      const up = await tx.supplierPayment.update({
        where: { id: paymentId },
        data: {
          ...(amount !== undefined && { amount: newAmount }),
          ...(paymentDate && { paymentDate: new Date(paymentDate) }),
          ...(paymentMethod && { paymentMethod }),
          ...(notes !== undefined && { notes }),
          updatedAt: new Date(),
        }
      });

      // Adjust supplier outstanding: payment reduces outstanding
      // If payment increased by delta, outstanding decreases by delta more
      if (delta !== 0) {
        await tx.supplier.update({
          where: { id: payment.supplierId },
          data: { outstandingPayment: { decrement: delta } }
        });
      }

      await writeAuditLog(tx, {
        adminId: BigInt(decoded.userId),
        action: 'EDIT',
        tableName: 'SupplierPayment',
        recordId: paymentId,
        beforeData: before,
        afterData: up,
        reason,
        shopId: payment.shopId,
      });

      return up;
    });

    return NextResponse.json({
      success: true,
      message: 'Supplier payment updated',
      data: { id: Number(updated.id) }
    });

  } catch (error) {
    console.error('[Admin SupplierPayment PATCH]', error);
    return NextResponse.json({ success: false, message: 'Failed to update supplier payment' }, { status: 500 });
  }
}

// DELETE /api/admin/supplier-payments/[id]
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer '))
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

    const token = authHeader.substring(7);
    const decoded = await validateToken(token);
    if (!decoded)
      return NextResponse.json({ success: false, message: 'Invalid token' }, { status: 401 });
    if (decoded.role !== 'SUPER_DUPER_ADMIN')
      return NextResponse.json({ success: false, message: 'Forbidden: SUPER_DUPER_ADMIN only' }, { status: 403 });

    const { id } = await params;
    const paymentId = BigInt(id);
    const { reason } = await req.json();

    if (!reason || reason.trim() === '')
      return NextResponse.json({ success: false, message: 'Reason is required' }, { status: 400 });

    const payment = await prisma.supplierPayment.findUnique({ where: { id: paymentId } });
    if (!payment || !payment.isActive)
      return NextResponse.json({ success: false, message: 'Supplier payment not found' }, { status: 404 });

    await prisma.$transaction(async (tx) => {
      await tx.supplierPayment.update({ where: { id: paymentId }, data: { isActive: false } });

      // Restoring outstanding: deleting a payment means the supplier is now owed more
      await tx.supplier.update({
        where: { id: payment.supplierId },
        data: { outstandingPayment: { increment: Number(payment.amount) } }
      });

      await writeAuditLog(tx, {
        adminId: BigInt(decoded.userId),
        action: 'DELETE',
        tableName: 'SupplierPayment',
        recordId: paymentId,
        beforeData: payment,
        afterData: null,
        reason,
        shopId: payment.shopId,
      });
    });

    return NextResponse.json({ success: true, message: 'Supplier payment deleted' });

  } catch (error) {
    console.error('[Admin SupplierPayment DELETE]', error);
    return NextResponse.json({ success: false, message: 'Failed to delete supplier payment' }, { status: 500 });
  }
}
