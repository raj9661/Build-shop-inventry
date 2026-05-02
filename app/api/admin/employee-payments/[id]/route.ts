import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { validateToken } from '@/app/lib/tokenUtils';

const prisma = new PrismaClient();

// PATCH - Edit employee payment (and sync the matching SALARY Expense)
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

    await prisma.$transaction(async (tx) => {
      // Update EmployeePayment
      await tx.employeePayment.update({
        where: { id: paymentId },
        data: {
          ...(amount !== undefined && { amount }),
          ...(paymentDate && { paymentDate: new Date(paymentDate) }),
          ...(paymentMethod && { paymentMethod }),
          ...(notes !== undefined && { notes })
        }
      });

      // Sync the matching SALARY Expense record (match by description pattern + date + shopId)
      const empName = existingPayment.employee?.name || '';
      const matchingExpense = await tx.expense.findFirst({
        where: {
          shopId: existingPayment.shopId,
          category: 'SALARY' as any,
          isActive: true,
          description: { contains: empName },
          date: existingPayment.paymentDate
        }
      });

      if (matchingExpense) {
        await tx.expense.update({
          where: { id: matchingExpense.id },
          data: {
            ...(amount !== undefined && { amount }),
            ...(paymentDate && { date: new Date(paymentDate) }),
            ...(notes !== undefined && {
              description: notes
                ? `Salary – ${empName}: ${notes}`
                : `Salary – ${empName}`
            })
          }
        });
      }
    });

    return NextResponse.json({ success: true, message: 'Payment updated successfully' });
  } catch (error) {
    console.error('Update payment error:', error);
    return NextResponse.json({ success: false, message: 'Failed to update payment' }, { status: 500 });
  }
}

// DELETE - Soft delete employee payment AND matching SALARY Expense
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
      where: { id: paymentId, isActive: true },
      include: { employee: true }
    });

    if (!existingPayment) {
      return NextResponse.json({ success: false, message: 'Payment not found' }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      // Soft-delete EmployeePayment
      await tx.employeePayment.update({
        where: { id: paymentId },
        data: { isActive: false }
      });

      // Soft-delete matching SALARY Expense
      const empName = existingPayment.employee?.name || '';
      const matchingExpense = await tx.expense.findFirst({
        where: {
          shopId: existingPayment.shopId,
          category: 'SALARY' as any,
          isActive: true,
          description: { contains: empName },
          date: existingPayment.paymentDate
        }
      });

      if (matchingExpense) {
        await tx.expense.update({
          where: { id: matchingExpense.id },
          data: { isActive: false }
        });
      }
    });

    return NextResponse.json({ success: true, message: 'Payment deleted successfully' });
  } catch (error) {
    console.error('Delete payment error:', error);
    return NextResponse.json({ success: false, message: 'Failed to delete payment' }, { status: 500 });
  }
}
