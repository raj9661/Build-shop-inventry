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

    // Helper: get week string (e.g. 2024-W29)
    function getWeekString(date: string | Date): string {
      const d = new Date(date);
      const year = d.getFullYear();
      const onejan = new Date(d.getFullYear(),0,1);
      const week = Math.ceil((((d.getTime() - onejan.getTime()) / 86400000) + onejan.getDay()+1)/7);
      return `${year}-W${week}`;
    }

    console.log(`🔍 [Supplier Detail API] Fetching details for ID: ${supplierId}`);
    // Fetch transactions for this specific supplier
    const stockEntries = await prisma.stockEntry.findMany({
      where: {
        supplierId: BigInt(supplierId),
        isActive: true
      },
      include: {
        product: { select: { name: true, unit: true } }
      },
      orderBy: { entryDate: 'desc' }
    });

    console.log(`🔍 [Supplier Detail API] Found ${stockEntries.length} stock entries`);

    const payments = await prisma.supplierPayment.findMany({
      where: {
        supplierId: BigInt(supplierId),
        isActive: true
      },
      orderBy: { paymentDate: 'desc' }
    });

    console.log(`🔍 [Supplier Detail API] Found ${payments.length} payments`);

    // Process enrichment logic
    const totalSupplied = stockEntries.reduce((sum, e) => sum + Number(e.totalAmount), 0);
    const lastSupply = stockEntries.length > 0 ? stockEntries[0].entryDate : null;

    console.log(`🔍 [Supplier Detail API] Calculated TotalSupplied: ${totalSupplied}`);

    // Weekly supply history
    const weeklyMap: { [week: string]: any } = {};
    for (const e of stockEntries) {
      const week = getWeekString(e.entryDate);
      if (!weeklyMap[week]) weeklyMap[week] = { week, quantity: 0, amount: 0, items: [] };
      weeklyMap[week].quantity += Number(e.quantity);
      weeklyMap[week].amount += Number(e.totalAmount);
      weeklyMap[week].items.push({
        productName: e.product?.name || '',
        quantity: Number(e.quantity),
        unit: e.product?.unit || '',
        dateSupplied: e.entryDate instanceof Date ? e.entryDate.toISOString() : e.entryDate,
        paymentStatus: e.paymentStatus
      });
    }

    const sortedWeeks = Object.keys(weeklyMap).sort((a, b) => b.localeCompare(a)); // Newest first
    const weeklySupplies = sortedWeeks.map(week => {
      const weekData = weeklyMap[week];
      const allPaid = weekData.items.length > 0 && weekData.items.every((item: any) => item.paymentStatus === 'COMPLETED');
      return { ...weekData, status: allPaid ? 'paid' : 'unpaid' };
    });

    console.log(`🔍 [Supplier Detail API] Generated ${weeklySupplies.length} weeks of history. First week items: ${weeklySupplies[0]?.items?.length || 0}`);

    // Build the final response object carefully
    const enrichedSupplier = {
      id: supplier.id.toString(),
      name: supplier.name,
      phone: supplier.phone || '',
      email: supplier.email || '',
      address: supplier.address || '',
      gstNo: (supplier as any).gstNo || '',
      isActive: supplier.isActive,
      shopId: supplier.shopId.toString(),
      outstandingPayment: Number(supplier.outstandingPayment || 0),
      totalSupplied,
      lastSupply: lastSupply instanceof Date ? lastSupply.toISOString() : lastSupply,
      weeklySupplies,
      paymentHistory: payments.map(p => ({
        amount: Number(p.amount),
        paymentDate: p.paymentDate instanceof Date ? p.paymentDate.toISOString() : p.paymentDate,
        paymentMethod: (p as any).paymentMethod || 'CASH',
        notes: (p as any).notes || null
      })),
      shop: supplier.shop ? {
        id: supplier.shop.id.toString(),
        name: supplier.shop.name
      } : null
    };
    
    console.log(`🔍 [Supplier Detail API] Final Response for ${enrichedSupplier.name}: Balance=${enrichedSupplier.outstandingPayment}, Weeks=${enrichedSupplier.weeklySupplies.length}`);

    return NextResponse.json({ 
      success: true, 
      data: { supplier: enrichedSupplier } 
    });
  } catch (error) {
    console.error('🔍 [Supplier Detail API] GET Exception:', error);
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
