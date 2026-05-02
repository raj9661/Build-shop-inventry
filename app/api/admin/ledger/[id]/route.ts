import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateToken } from '@/app/lib/tokenUtils';

// Helper to write audit log
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

// PATCH /api/admin/ledger/[id] — edit a CustomerLedgerEntry
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
    const { amount, date, description, method, reason } = body;

    if (!reason || reason.trim() === '') {
      return NextResponse.json({ success: false, message: 'Reason for change is required' }, { status: 400 });
    }

    const entry = await prisma.customerLedgerEntry.findUnique({ where: { id: entryId } });
    if (!entry || !entry.isActive)
      return NextResponse.json({ success: false, message: 'Ledger entry not found' }, { status: 404 });

    const oldAmount = Number(entry.amount);
    const newAmount = amount !== undefined ? parseFloat(amount) : oldAmount;
    const delta = newAmount - oldAmount; // positive = increased debit, negative = decreased

    // Determine if this is a debit or credit entry
    // Debit entries increase balance (sale/purchase), credit entries decrease balance (payment)
    const isDebit = entry.type === 'debit' || entry.type === 'sale_payment' && oldAmount > 0;

    const updatedEntry = await prisma.$transaction(async (tx) => {
      // 1. Snapshot before
      const before = { ...entry };

      // 2. Update the entry
      const updated = await tx.customerLedgerEntry.update({
        where: { id: entryId },
        data: {
          ...(amount !== undefined && { amount: newAmount }),
          ...(date && { date: new Date(date) }),
          ...(description !== undefined && { description }),
          ...(method && { method }),
          updatedAt: new Date(),
        }
      });

      // 3. Adjust customer balance by delta
      if (delta !== 0) {
        const balanceDelta = isDebit ? delta : -delta;
        await tx.customer.update({
          where: { id: entry.customerId },
          data: { currentBalance: { increment: balanceDelta } }
        });
      }

      // 4. Write audit log
      await writeAuditLog(tx, {
        adminId: BigInt(decoded.userId),
        action: 'EDIT',
        tableName: 'CustomerLedgerEntry',
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
      message: 'Ledger entry updated',
      data: { id: Number(updatedEntry.id), amount: Number(updatedEntry.amount) }
    });

  } catch (error) {
    console.error('[Admin Ledger PATCH]', error);
    return NextResponse.json({ success: false, message: 'Failed to update ledger entry' }, { status: 500 });
  }
}

// DELETE /api/admin/ledger/[id] — soft-delete a CustomerLedgerEntry
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

    if (!reason || reason.trim() === '') {
      return NextResponse.json({ success: false, message: 'Reason for deletion is required' }, { status: 400 });
    }

    const entry = await prisma.customerLedgerEntry.findUnique({ where: { id: entryId } });
    if (!entry || !entry.isActive)
      return NextResponse.json({ success: false, message: 'Ledger entry not found' }, { status: 404 });

    const entryAmount = Number(entry.amount);
    const isDebit = entry.type === 'debit' || (entry.type === 'sale_payment' && entryAmount > 0);

    await prisma.$transaction(async (tx) => {
      // 1. Soft-delete
      await tx.customerLedgerEntry.update({
        where: { id: entryId },
        data: { isActive: false }
      });

      // 2. Reverse balance impact
      const balanceDelta = isDebit ? -entryAmount : entryAmount;
      await tx.customer.update({
        where: { id: entry.customerId },
        data: { currentBalance: { increment: balanceDelta } }
      });

      // 3. Audit log
      await writeAuditLog(tx, {
        adminId: BigInt(decoded.userId),
        action: 'DELETE',
        tableName: 'CustomerLedgerEntry',
        recordId: entryId,
        beforeData: entry,
        afterData: null,
        reason,
        shopId: entry.shopId,
      });
    });

    return NextResponse.json({ success: true, message: 'Ledger entry deleted' });

  } catch (error) {
    console.error('[Admin Ledger DELETE]', error);
    return NextResponse.json({ success: false, message: 'Failed to delete ledger entry' }, { status: 500 });
  }
}
