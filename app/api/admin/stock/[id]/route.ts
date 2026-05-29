import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateToken } from '@/app/lib/tokenUtils';

import { writeAuditLog } from '../../_auditLogHelper';



// PATCH /api/admin/stock/[id] — edit a StockEntry
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
    const entryId = BigInt(id);
    const body = await req.json();
    const { quantity, unitPrice, entryDate, notes, paymentStatus, reason } = body;

    if (!reason || reason.trim() === '')
      return NextResponse.json({ success: false, message: 'Reason is required' }, { status: 400 });

    const entry = await prisma.stockEntry.findUnique({ where: { id: entryId } });
    if (!entry || !entry.isActive)
      return NextResponse.json({ success: false, message: 'Stock entry not found' }, { status: 404 });

    const oldQty = Number(entry.quantity);
    const oldUnitPrice = Number(entry.unitPrice);
    const oldTotalAmount = Number(entry.totalAmount);
    const newQty = quantity !== undefined ? parseFloat(quantity) : oldQty;
    const newUnitPrice = unitPrice !== undefined ? parseFloat(unitPrice) : oldUnitPrice;
    const newTotalAmount = newQty * newUnitPrice;
    const qtyDelta = newQty - oldQty;
    const totalAmountDelta = newTotalAmount - oldTotalAmount;

    const updatedEntry = await prisma.$transaction(async (tx) => {
      const before = { ...entry };

      const updated = await tx.stockEntry.update({
        where: { id: entryId },
        data: {
          ...(quantity !== undefined && { quantity: newQty, totalAmount: newTotalAmount }),
          ...(unitPrice !== undefined && { unitPrice: newUnitPrice, totalAmount: newTotalAmount }),
          ...(entryDate && { entryDate: new Date(entryDate) }),
          ...(notes !== undefined && { notes }),
          ...(paymentStatus && { paymentStatus }),
          updatedAt: new Date(),
        }
      });

      // Adjust product stockQuantity by delta
      if (qtyDelta !== 0) {
        await tx.product.update({
          where: { id: entry.productId },
          data: { stockQuantity: { increment: qtyDelta } }
        });
      }

      // Adjust supplier outstanding balance
      const wasPending = entry.paymentStatus === 'PENDING';
      const willBePending = (paymentStatus || entry.paymentStatus) === 'PENDING';

      if (wasPending && willBePending && totalAmountDelta !== 0) {
        // Still pending: adjust by amount delta
        await tx.supplier.update({
          where: { id: entry.supplierId },
          data: { outstandingPayment: { increment: totalAmountDelta } }
        });
      } else if (wasPending && !willBePending) {
        // Marked as paid: clear old outstanding
        await tx.supplier.update({
          where: { id: entry.supplierId },
          data: { outstandingPayment: { decrement: oldTotalAmount } }
        });
      } else if (!wasPending && willBePending) {
        // Reverted to pending: add new amount
        await tx.supplier.update({
          where: { id: entry.supplierId },
          data: { outstandingPayment: { increment: newTotalAmount } }
        });
      }

      await writeAuditLog(tx, {
        adminId: BigInt(decoded.userId),
        action: 'EDIT',
        tableName: 'StockEntry',
        recordId: entryId,
        beforeData: before,
        afterData: updated,
        reason,
        shopId: entry.shopId,
      });

      return updated;
    });

    return NextResponse.json({
      success: true,
      message: 'Stock entry updated',
      data: { id: Number(updatedEntry.id) }
    });

  } catch (error) {
    console.error('[Admin Stock PATCH]', error);
    return NextResponse.json({ success: false, message: 'Failed to update stock entry' }, { status: 500 });
  }
}

// DELETE /api/admin/stock/[id]
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
    const entryId = BigInt(id);
    const { reason } = await req.json();

    if (!reason || reason.trim() === '')
      return NextResponse.json({ success: false, message: 'Reason is required' }, { status: 400 });

    const entry = await prisma.stockEntry.findUnique({ where: { id: entryId } });
    if (!entry || !entry.isActive)
      return NextResponse.json({ success: false, message: 'Stock entry not found' }, { status: 404 });

    await prisma.$transaction(async (tx) => {
      await tx.stockEntry.update({ where: { id: entryId }, data: { isActive: false } });

      // Reverse product stock
      await tx.product.update({
        where: { id: entry.productId },
        data: { stockQuantity: { decrement: Number(entry.quantity) } }
      });

      // Reverse supplier outstanding if was pending
      if (entry.paymentStatus === 'PENDING') {
        await tx.supplier.update({
          where: { id: entry.supplierId },
          data: { outstandingPayment: { decrement: Number(entry.totalAmount) } }
        });
      }

      await writeAuditLog(tx, {
        adminId: BigInt(decoded.userId),
        action: 'DELETE',
        tableName: 'StockEntry',
        recordId: entryId,
        beforeData: entry,
        afterData: null,
        reason,
        shopId: entry.shopId,
      });
    });

    return NextResponse.json({ success: true, message: 'Stock entry deleted' });

  } catch (error) {
    console.error('[Admin Stock DELETE]', error);
    return NextResponse.json({ success: false, message: 'Failed to delete stock entry' }, { status: 500 });
  }
}
