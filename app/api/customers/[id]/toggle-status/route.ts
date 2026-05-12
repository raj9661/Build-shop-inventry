import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { validateToken } from '@/app/lib/tokenUtils';

const prisma = new PrismaClient();

// Helper function to serialize BigInt values
const serializeBigInt = (obj: any): any => {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'bigint') return Number(obj);
  if (obj instanceof Date) return obj.toISOString();
  if (Array.isArray(obj)) return obj.map(serializeBigInt);
  if (typeof obj === 'object') {
    const serialized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      serialized[key] = serializeBigInt(value);
    }
    return serialized;
  }
  return obj;
};

// Helper function to handle the toggle logic
async function handleToggleStatus(customerId: number) {
  // Find the customer
  const customer = await prisma.customer.findUnique({
    where: { id: customerId }
  });

  if (!customer) {
    return { success: false, message: 'Customer not found', status: 404 };
  }

  // Toggle the status
  const updatedCustomer = await prisma.customer.update({
    where: { id: customerId },
    data: { isActive: !customer.isActive }
  });

  console.log(`🔄 [ToggleStatus] Customer ${customerId} status changed: ${customer.isActive} -> ${updatedCustomer.isActive}`);

  return {
    success: true,
    message: `Customer ${updatedCustomer.isActive ? 'activated' : 'deactivated'} successfully`,
    data: {
      customer: updatedCustomer,
      status: updatedCustomer.isActive ? 'open' : 'closed'
    }
  };
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const resolvedParams = await params;
    const customerId = parseInt(resolvedParams.id);

    if (isNaN(customerId)) {
      return NextResponse.json({ success: false, message: 'Invalid customer ID' }, { status: 400 });
    }

    const result = await handleToggleStatus(customerId);

    if (!result.success) {
      return NextResponse.json({ success: false, message: result.message }, { status: result.status });
    }

    return NextResponse.json(serializeBigInt(result));

  } catch (error) {
    console.error('Toggle customer status error:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to toggle customer status'
    }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const resolvedParams = await params;
    const customerId = parseInt(resolvedParams.id);

    if (isNaN(customerId)) {
      return NextResponse.json({ success: false, message: 'Invalid customer ID' }, { status: 400 });
    }

    const result = await handleToggleStatus(customerId);

    if (!result.success) {
      return NextResponse.json({ success: false, message: result.message }, { status: result.status });
    }

    return NextResponse.json(serializeBigInt(result));

  } catch (error) {
    console.error('Toggle customer status error:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to toggle customer status'
    }, { status: 500 });
  }
} 