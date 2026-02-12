import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient, PaymentMethod } from '@prisma/client';
import { validateToken } from '@/app/lib/tokenUtils';
import { getShopFilter } from '@/app/lib/shopAccessUtils';

const prisma = new PrismaClient();

// GET - Get all employee payments
export async function GET(req: NextRequest) {
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

    const { searchParams } = new URL(req.url);
    const employeeId = searchParams.get('employeeId');
    const shopId = searchParams.get('shopId');

    // Get shop filter based on user's access
    const shopFilter = await getShopFilter(token);

    // Build where clause
    let whereClause: any = { isActive: true };

    if (employeeId) {
      const empIdNum = parseInt(employeeId);
      if (!isNaN(empIdNum)) {
        whereClause.employeeId = BigInt(empIdNum);
      }
    }

    if (shopId) {
      const shopIdNum = parseInt(shopId);
      if (isNaN(shopIdNum)) {
        return NextResponse.json({ success: false, message: 'Invalid shop ID' }, { status: 400 });
      }

      // Check access
      if (shopFilter.shopId && typeof shopFilter.shopId === 'object' && 'in' in shopFilter.shopId) {
        const accessibleShopIds = shopFilter.shopId.in || [];
        if (!accessibleShopIds.includes(shopIdNum)) {
          return NextResponse.json({ success: false, message: 'Access denied to this shop' }, { status: 403 });
        }
      } else if (shopFilter.shopId && typeof shopFilter.shopId === 'number') {
        if (shopFilter.shopId !== shopIdNum) {
          return NextResponse.json({ success: false, message: 'Access denied to this shop' }, { status: 403 });
        }
      }

      whereClause.shopId = BigInt(shopIdNum);
    } else if (Object.keys(shopFilter).length > 0) {
      Object.assign(whereClause, shopFilter);
    }

    const payments = await prisma.employeePayment.findMany({
      where: whereClause,
      include: {
        employee: { select: { id: true, name: true } },
        shop: { select: { id: true, name: true } }
      },
      orderBy: { paymentDate: 'desc' }
    });

    const serializedPayments = payments.map(payment => ({
      id: Number(payment.id),
      employeeId: Number(payment.employeeId),
      amount: Number(payment.amount),
      paymentMethod: payment.paymentMethod,
      paymentDate: payment.paymentDate,
      notes: payment.notes,
      shopId: Number(payment.shopId),
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
      employee: payment.employee ? { ...payment.employee, id: Number(payment.employee.id) } : null,
      shop: payment.shop ? { ...payment.shop, id: Number(payment.shop.id) } : null
    }));

    return NextResponse.json({ success: true, data: { payments: serializedPayments } });
  } catch (error) {
    console.error('Get employee payments error:', error);
    return NextResponse.json({ success: false, message: 'Failed to fetch employee payments' }, { status: 500 });
  }
}

// POST - Create a new employee payment
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
    const { employeeId, amount, paymentMethod, paymentDate, shopId, notes } = body;

    if (!employeeId || !amount || !paymentMethod || !paymentDate || !shopId) {
      return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
    }

    // Validate shop access
    const shopFilter = await getShopFilter(token);
    const shopIdNum = parseInt(shopId);
    if (isNaN(shopIdNum)) {
      return NextResponse.json({ success: false, message: 'Invalid shop ID' }, { status: 400 });
    }

    // Check if user has access to this shop
    if (shopFilter.shopId && typeof shopFilter.shopId === 'object' && 'in' in shopFilter.shopId) {
      const accessibleShopIds = shopFilter.shopId.in || [];
      if (accessibleShopIds.length === 0) {
        return NextResponse.json({ success: false, message: 'No accessible shops found' }, { status: 403 });
      }
      if (!accessibleShopIds.includes(shopIdNum)) {
        return NextResponse.json({ success: false, message: 'Access denied to this shop' }, { status: 403 });
      }
    } else if (shopFilter.shopId && typeof shopFilter.shopId === 'number') {
      if (shopFilter.shopId !== shopIdNum) {
        return NextResponse.json({ success: false, message: 'Access denied to this shop' }, { status: 403 });
      }
    } else if (Object.keys(shopFilter).length === 0) {
      return NextResponse.json({ success: false, message: 'Access denied' }, { status: 403 });
    }

    // Validate employee exists
    const employee = await prisma.employee.findFirst({
      where: {
        id: BigInt(employeeId),
        isActive: true,
        shopId: BigInt(shopId)
      }
    });

    if (!employee) {
      return NextResponse.json({ success: false, message: 'Employee not found or access denied' }, { status: 404 });
    }

    // Create payment
    const payment = await prisma.employeePayment.create({
      data: {
        employeeId: BigInt(employeeId),
        amount,
        paymentMethod: paymentMethod as PaymentMethod,
        paymentDate: new Date(paymentDate),
        shopId: BigInt(shopId),
        notes: notes || null,
        isActive: true
      }
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

    return NextResponse.json({ success: true, data: { payment: safeBigInt(payment) }, message: 'Payment recorded successfully' });
  } catch (error) {
    console.error('Employee payment error:', error);
    return NextResponse.json({ success: false, message: 'Failed to record payment' }, { status: 500 });
  }
}

