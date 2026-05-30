import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { validateToken } from '@/app/lib/tokenUtils';
import { getShopFilter } from '@/app/lib/shopAccessUtils';
import { serializeBigInt } from '@/app/lib/serializationUtils';


// GET - List all unit conversions for a product
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
    const productId = searchParams.get('productId');

    if (!productId) {
      return NextResponse.json({ success: false, message: 'productId is required' }, { status: 400 });
    }

    const conversions = await prisma.productUnitConversion.findMany({
      where: {
        productId: BigInt(productId)
      }
    });

    return NextResponse.json({ success: true, data: serializeBigInt(conversions) });
  } catch (error) {
    console.error('Get unit conversions error:', error);
    return NextResponse.json({ success: false, message: 'Failed to fetch unit conversions' }, { status: 500 });
  }
}

// POST - Create or update a unit conversion
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, message: 'Access token required' }, { status: 401 });
    }
    const token = authHeader.substring(7);
    const decoded = await validateToken(token);
    if (!decoded || (decoded.role !== 'SUPER_ADMIN' && decoded.role !== 'SUPER_DUPER_ADMIN')) {
      return NextResponse.json({ success: false, message: 'Unauthorized. Super Admin access required' }, { status: 403 });
    }

    const body = await req.json();
    const { productId, unitName, cftValue } = body;

    if (!productId || !unitName || cftValue === undefined) {
      return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
    }

    const conversion = await prisma.productUnitConversion.upsert({
      where: {
        productId_unitName: {
          productId: BigInt(productId),
          unitName
        }
      },
      update: {
        cftValue: parseFloat(cftValue)
      },
      create: {
        productId: BigInt(productId),
        unitName,
        cftValue: parseFloat(cftValue)
      }
    });

    return NextResponse.json({ success: true, data: serializeBigInt(conversion) });
  } catch (error) {
    console.error('Create unit conversion error:', error);
    return NextResponse.json({ success: false, message: 'Failed to save unit conversion' }, { status: 500 });
  }
}

// DELETE - Remove a unit conversion
export async function DELETE(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, message: 'Access token required' }, { status: 401 });
    }
    const token = authHeader.substring(7);
    const decoded = await validateToken(token);
    if (!decoded || (decoded.role !== 'SUPER_ADMIN' && decoded.role !== 'SUPER_DUPER_ADMIN')) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, message: 'id is required' }, { status: 400 });
    }

    await prisma.productUnitConversion.delete({
      where: { id: BigInt(id) }
    });

    return NextResponse.json({ success: true, message: 'Unit conversion deleted' });
  } catch (error) {
    console.error('Delete unit conversion error:', error);
    return NextResponse.json({ success: false, message: 'Failed to delete unit conversion' }, { status: 500 });
  }
}
