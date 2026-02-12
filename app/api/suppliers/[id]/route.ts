import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { validateToken } from '@/app/lib/tokenUtils';
import { getShopFilter } from '@/app/lib/shopAccessUtils';

const prisma = new PrismaClient();

// GET - Get a specific supplier
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    const { id } = await params;
    const supplierId = parseInt(id);
    if (isNaN(supplierId)) {
      return NextResponse.json({ success: false, message: 'Invalid supplier ID' }, { status: 400 });
    }

    // Get user's accessible shops
    const shopFilter = await getShopFilter(token);
    console.log('🔍 [Suppliers API] Shop filter for GET:', shopFilter);

    // Find supplier with access check
    const supplier = await prisma.supplier.findFirst({
      where: {
        id: BigInt(supplierId),
        isActive: true,
        ...shopFilter
      },
      include: {
        shop: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    if (!supplier) {
      return NextResponse.json({ success: false, message: 'Supplier not found or access denied' }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true, 
      data: { supplier } 
    });
  } catch (error) {
    console.error('Get supplier error:', error);
    return NextResponse.json({ success: false, message: 'Failed to fetch supplier' }, { status: 500 });
  }
}

// PUT - Update a supplier
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    const { id } = await params;
    const supplierId = parseInt(id);
    if (isNaN(supplierId)) {
      return NextResponse.json({ success: false, message: 'Invalid supplier ID' }, { status: 400 });
    }

    const body = await req.json();
    const { name, phone, email, address } = body;

    // Get user's accessible shops
    const shopFilter = await getShopFilter(token);
    console.log('🔍 [Suppliers API] Shop filter for PUT:', shopFilter);

    // Check if supplier exists and user has access
    const existingSupplier = await prisma.supplier.findFirst({
      where: {
        id: BigInt(supplierId),
        isActive: true,
        ...shopFilter
      }
    });

    if (!existingSupplier) {
      return NextResponse.json({ success: false, message: 'Supplier not found or access denied' }, { status: 404 });
    }

    // Check for duplicate name in the same shop
    if (name && name !== existingSupplier.name) {
      const duplicateSupplier = await prisma.supplier.findFirst({
        where: {
          name: name,
          shopId: existingSupplier.shopId,
          isActive: true,
          id: { not: BigInt(supplierId) }
        }
      });

      if (duplicateSupplier) {
        return NextResponse.json({ 
          success: false, 
          message: `A supplier with name "${name}" already exists in this shop` 
        }, { status: 400 });
      }
    }

    // Update supplier
    const updatedSupplier = await prisma.supplier.update({
      where: { id: BigInt(supplierId) },
      data: {
        ...(name && { name }),
        ...(phone !== undefined && { phone }),
        ...(email !== undefined && { email }),
        ...(address !== undefined && { address })
      },
      include: {
        shop: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    return NextResponse.json({ 
      success: true, 
      data: { supplier: updatedSupplier },
      message: 'Supplier updated successfully'
    });
  } catch (error) {
    console.error('Update supplier error:', error);
    return NextResponse.json({ success: false, message: 'Failed to update supplier' }, { status: 500 });
  }
}

// DELETE - Delete a supplier
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

    const { id } = await params;
    const supplierId = parseInt(id);
    if (isNaN(supplierId)) {
      return NextResponse.json({ success: false, message: 'Invalid supplier ID' }, { status: 400 });
    }

    // Get user's accessible shops
    const shopFilter = await getShopFilter(token);
    console.log('🔍 [Suppliers API] Shop filter for DELETE:', shopFilter);

    // Check if supplier exists and user has access
    const existingSupplier = await prisma.supplier.findFirst({
      where: {
        id: BigInt(supplierId),
        isActive: true,
        ...shopFilter
      }
    });

    if (!existingSupplier) {
      return NextResponse.json({ success: false, message: 'Supplier not found or access denied' }, { status: 404 });
    }

    // Check if supplier has any stock entries
    const stockEntriesCount = await prisma.stockEntry.count({
      where: {
        supplierId: BigInt(supplierId),
        isActive: true
      }
    });

    if (stockEntriesCount > 0) {
      return NextResponse.json({ 
        success: false, 
        message: `Cannot delete supplier. There are ${stockEntriesCount} stock entries associated with this supplier. Please remove the stock entries first.` 
      }, { status: 400 });
    }

    // Soft delete supplier
    await prisma.supplier.update({
      where: { id: BigInt(supplierId) },
      data: {
        isActive: false
      }
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Supplier deleted successfully'
    });
  } catch (error) {
    console.error('Delete supplier error:', error);
    return NextResponse.json({ success: false, message: 'Failed to delete supplier' }, { status: 500 });
  }
}
