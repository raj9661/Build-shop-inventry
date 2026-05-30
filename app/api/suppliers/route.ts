import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { validateToken } from '@/app/lib/tokenUtils';
import { getShopFilter } from '@/app/lib/shopAccessUtils';


// GET - Get all suppliers for user's accessible shops
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
    const shopId = searchParams.get('shopId');
    const search = searchParams.get('search');

    console.log('🔍 [Suppliers API] GET request - shopId:', shopId, 'search:', search, 'userRole:', decoded.role);

    // Build where clause
    let whereClause: any = { isActive: true };
    
    if (shopId) {
      const shopIdNum = parseInt(shopId);
      
      // Handle default shop case (shopId = 0)
      if (shopIdNum === 0) {
        console.log('🔍 [Suppliers API] Default shop requested (shopId=0), getting all accessible shops');
        // Get user's accessible shops without filtering by specific shop
        const shopFilter = await getShopFilter(token);
        console.log('🔍 [Suppliers API] Shop filter for default shop:', shopFilter);
        if (Object.keys(shopFilter).length > 0) {
          whereClause = { ...whereClause, ...shopFilter };
        }
      } else {
        // Filter by specific shop - validate access
        const shopFilter = await getShopFilter(token);
        console.log('🔍 [Suppliers API] Shop filter for validation:', shopFilter);
        
        // Check if user has access to this specific shop
        if (shopFilter.shopId && typeof shopFilter.shopId === 'object' && 'in' in shopFilter.shopId) {
          const accessibleShopIds = shopFilter.shopId.in || [];
          if (!accessibleShopIds.includes(shopIdNum)) {
            console.log('🔍 [Suppliers API] Access denied - shopId not in accessible shops:', shopIdNum, 'accessible:', accessibleShopIds);
            return NextResponse.json({ success: false, message: 'Access denied to this shop' }, { status: 403 });
          }
        } else if (shopFilter.shopId && typeof shopFilter.shopId === 'number') {
          if (shopFilter.shopId !== shopIdNum) {
            console.log('🔍 [Suppliers API] Access denied - shopId mismatch:', shopIdNum, 'allowed:', shopFilter.shopId);
            return NextResponse.json({ success: false, message: 'Access denied to this shop' }, { status: 403 });
          }
        }
        
        whereClause.shopId = BigInt(shopIdNum);
      }
    } else {
      // Get user's accessible shops
      const shopFilter = await getShopFilter(token);
      console.log('🔍 [Suppliers API] Shop filter for all shops:', shopFilter);
      if (Object.keys(shopFilter).length > 0) {
        whereClause = { ...whereClause, ...shopFilter };
      }
    }

    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ];
    }

    // Fetch suppliers
    const suppliers = await prisma.supplier.findMany({
      where: whereClause,
      include: {
        shop: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    const supplierIds = suppliers.map(s => s.id);
    console.log(`🔍 [Suppliers API] Found ${suppliers.length} suppliers. Ids:`, supplierIds.map(id => id.toString()));

    // FETCH TOTAL SUPPLIED IN ONE GO
    const totalSuppliedGroups = await prisma.stockEntry.groupBy({
      by: ['supplierId'],
      where: {
        supplierId: { in: supplierIds },
        isActive: true
      },
      _sum: {
        totalAmount: true
      }
    });

    const tmtSuppliedGroups = await prisma.tmtInventory.groupBy({
      by: ['supplierId'],
      where: {
        supplierId: { in: supplierIds },
        isActive: true
      },
      _sum: {
        totalAmount: true
      }
    });

    const extraChargesGroups = await prisma.supplierPayment.groupBy({
      by: ['supplierId'],
      where: {
        supplierId: { in: supplierIds },
        isActive: true,
        notes: { startsWith: 'EXTRA_CHARGE:' }
      },
      _sum: {
        amount: true
      }
    });

    const totalSuppliedMap: { [id: string]: number } = {};
    totalSuppliedGroups.forEach(group => {
      totalSuppliedMap[group.supplierId.toString()] = Number(group._sum.totalAmount || 0);
    });
    
    tmtSuppliedGroups.forEach(group => {
      if (group.supplierId) {
        const idStr = group.supplierId.toString();
        totalSuppliedMap[idStr] = (totalSuppliedMap[idStr] || 0) + Number(group._sum.totalAmount || 0);
      }
    });

    extraChargesGroups.forEach(group => {
      if (group.supplierId) {
        const idStr = group.supplierId.toString();
        totalSuppliedMap[idStr] = (totalSuppliedMap[idStr] || 0) + Math.abs(Number(group._sum.amount || 0));
      }
    });

    // Build response - LIGHT VERSION
    const serializedSuppliers = suppliers.map((supplier) => {
      const idStr = supplier.id.toString();
      const totalSupplied = totalSuppliedMap[idStr] || 0;
      const outstandingPayment = Number(supplier.outstandingPayment || 0);

      // Log specific supplier if it's the one the user is concerned about (e.g. ID 11)
      if (idStr === '11') {
        console.log(`🔍 [Suppliers API] Supplier 11 Stats: TotalSupplied=${totalSupplied}, Outstanding=${outstandingPayment}`);
      }

      return {
        id: idStr,
        name: supplier.name,
        phone: supplier.phone || '',
        email: supplier.email || '',
        address: supplier.address || '',
        gstNo: (supplier as any).gstNo || '',
        isActive: supplier.isActive,
        createdAt: supplier.createdAt,
        updatedAt: supplier.updatedAt,
        shopId: supplier.shopId.toString(),
        totalSupplied,
        outstandingPayment,
        openingBalance: Number(supplier.openingBalance || 0),
        lastSupply: null,
        weeklySupplies: [],
        paymentHistory: [],
        shop: (supplier as any).shop ? {
          ...(supplier as any).shop,
          id: (supplier as any).shop.id.toString()
        } : null
      };
    });

    return NextResponse.json({ 
      success: true, 
      data: { suppliers: serializedSuppliers } 
    });
  } catch (error) {
    console.error('🔍 [Suppliers API] GET Exception:', error);
    return NextResponse.json({ success: false, message: 'Failed to fetch suppliers' }, { status: 500 });
  }
}

// POST - Create a new supplier
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
    const { 
      name, 
      phone, 
      email, 
      address, 
      shopIds, // Array of shop IDs for multi-shop suppliers
      shopId, // Single shop ID for backward compatibility
      openingBalance
    } = body;

    console.log('🔍 [Suppliers API] POST request - name:', name, 'shopId:', shopId, 'shopIds:', shopIds, 'userRole:', decoded.role);

    if (!name) {
      return NextResponse.json({ success: false, message: 'Supplier name is required' }, { status: 400 });
    }

    // Determine which shops to assign the supplier to
    let targetShopIds: number[] = [];
    
    if (shopIds && Array.isArray(shopIds) && shopIds.length > 0) {
      // Multi-shop supplier
      targetShopIds = shopIds;
    } else if (shopId) {
      // Single shop supplier (backward compatibility)
      targetShopIds = [shopId];
    } else {
      // Get user's accessible shops
      const shopFilter = await getShopFilter(token);
      console.log('🔍 [Suppliers API] Shop filter for POST:', shopFilter);
      if (Object.keys(shopFilter).length > 0 && 'shopId' in shopFilter) {
        if (shopFilter.shopId && typeof shopFilter.shopId === 'object' && 'in' in shopFilter.shopId) {
          targetShopIds = shopFilter.shopId.in || [];
        } else if (typeof shopFilter.shopId === 'number') {
          targetShopIds = [shopFilter.shopId];
        }
      }
    }

    console.log('🔍 [Suppliers API] Target shop IDs:', targetShopIds);

    if (targetShopIds.length === 0) {
      return NextResponse.json({ success: false, message: 'No valid shops found' }, { status: 400 });
    }

    // Create suppliers for each shop
    const createdSuppliers = [];
    
    for (const shopId of targetShopIds) {
      // Check if supplier already exists for this shop
      const existingSupplier = await prisma.supplier.findFirst({
        where: {
          name: name,
          shopId: BigInt(shopId),
          isActive: true
        }
      });

      if (existingSupplier) {
        // Update existing supplier
        const updatedSupplier = await prisma.supplier.update({
          where: { id: existingSupplier.id },
          data: {
            phone,
            email,
            address,
            openingBalance: openingBalance !== undefined ? Number(openingBalance) : existingSupplier.openingBalance
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
        createdSuppliers.push(updatedSupplier);
      } else {
        // Create new supplier
        const newSupplier = await prisma.supplier.create({
          data: {
            name,
            phone,
            email,
            address,
            shopId: BigInt(shopId),
            openingBalance: openingBalance !== undefined ? Number(openingBalance) : 0,
            isActive: true
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
        createdSuppliers.push(newSupplier);
      }
    }

    // Convert BigInt values to strings for JSON serialization
    const serializedSuppliers = createdSuppliers.map(supplier => ({
      ...supplier,
      id: supplier.id.toString(),
      shopId: supplier.shopId.toString(),
      shop: (supplier as any).shop ? {
        ...(supplier as any).shop,
        id: (supplier as any).shop.id.toString()
      } : null
    }));

    return NextResponse.json({ 
      success: true, 
      data: { 
        suppliers: serializedSuppliers,
        message: createdSuppliers.length > 1 
          ? `Supplier created for ${createdSuppliers.length} shops` 
          : 'Supplier created successfully'
      } 
    });
  } catch (error) {
    console.error('Create supplier error:', error);
    return NextResponse.json({ success: false, message: 'Failed to create supplier' }, { status: 500 });
  }
} 