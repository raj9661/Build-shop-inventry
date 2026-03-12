import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { validateToken } from '@/app/lib/tokenUtils';
import { getShopFilter } from '@/app/lib/shopAccessUtils';

const prisma = new PrismaClient();

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

    // For each supplier, aggregate supply and payment info
    const supplierIds = suppliers.map(s => s.id);
    // Fetch all stock entries for these suppliers
    const stockEntries = await prisma.stockEntry.findMany({
      where: {
        supplierId: { in: supplierIds },
        isActive: true
      },
      select: {
        supplierId: true,
        quantity: true,
        totalAmount: true,
        entryDate: true,
        product: { select: { name: true, unit: true } },
        paymentStatus: true // <-- include paymentStatus
      }
    });
    // Fetch all payments for these suppliers
    const payments = await prisma.supplierPayment.findMany({
      where: {
        supplierId: { in: supplierIds },
        isActive: true
      },
      select: {
        supplierId: true,
        amount: true,
        paymentDate: true,
        paymentMethod: true,
        notes: true
      },
      orderBy: { paymentDate: 'desc' }
    });

    // Group stock entries and payments by supplier
    const stockBySupplier: { [supplierId: number]: typeof stockEntries } = {};
    const paymentsBySupplier: { [supplierId: number]: typeof payments } = {};
    for (const entry of stockEntries) {
      const supplierId = Number(entry.supplierId);
      if (!stockBySupplier[supplierId]) stockBySupplier[supplierId] = [];
      stockBySupplier[supplierId].push(entry);
    }
    for (const pay of payments) {
      const supplierId = Number(pay.supplierId);
      if (!paymentsBySupplier[supplierId]) paymentsBySupplier[supplierId] = [];
      paymentsBySupplier[supplierId].push(pay);
    }

    // Helper: get week string (e.g. 2024-W29)
    function getWeekString(date: string | Date): string {
      const d = new Date(date);
      const year = d.getFullYear();
      const onejan = new Date(d.getFullYear(),0,1);
      const week = Math.ceil((((d.getTime() - onejan.getTime()) / 86400000) + onejan.getDay()+1)/7);
      return `${year}-W${week}`;
    }

    // Build response
    const enrichedSuppliers = suppliers.map(supplier => {
      const supplierId = Number(supplier.id);
      const entries = stockBySupplier[supplierId] || [];
      const pays = paymentsBySupplier[supplierId] || [];
      // Total supplied (sum of totalAmount)
      const totalSupplied = entries.reduce((sum, e) => sum + Number(e.totalAmount), 0);
      // Outstanding payment = use stored value from DB (manually set), fallback to computed from unpaid stock entries
      const computedOutstanding = entries.filter(e => e.paymentStatus !== 'COMPLETED').reduce((sum, e) => sum + Number(e.totalAmount), 0);
      const outstandingPayment = Number((supplier as any).outstandingPayment) > 0 ? Number((supplier as any).outstandingPayment) : computedOutstanding;
      // Last supply date
      const lastSupply = entries.length > 0 ? entries.reduce((latest, e) => new Date(e.entryDate) > new Date(latest) ? e.entryDate : latest, entries[0].entryDate) : null;
      // Weekly supply history with product details
      const weeklyMap: { [week: string]: { week: string; quantity: number; amount: number; items: { productName: string; quantity: number; unit: string; dateSupplied: string; paymentStatus: string }[] } } = {};
      for (const e of entries) {
        const week = getWeekString(e.entryDate);
        if (!weeklyMap[week]) weeklyMap[week] = { week, quantity: 0, amount: 0, items: [] };
        weeklyMap[week].quantity += Number(e.quantity);
        weeklyMap[week].amount += Number(e.totalAmount);
        weeklyMap[week].items.push({
          productName: e.product?.name || '',
          quantity: Number(e.quantity),
          unit: e.product?.unit || '',
          dateSupplied: typeof e.entryDate === 'string' ? e.entryDate : e.entryDate.toISOString(),
          paymentStatus: e.paymentStatus // <-- store paymentStatus per item
        });
      }
      // Sort weeks chronologically
      const sortedWeeks = Object.keys(weeklyMap).sort();
      // Sort payments by date
      const sortedPayments = pays.slice().sort((a, b) => new Date(a.paymentDate).getTime() - new Date(b.paymentDate).getTime());
      let paymentCursor = 0;
      let cumulativePaid = 0;
      let cumulativeSupplied = 0;
      // Calculate total supply for all weeks
      const totalWeeklySupply = sortedWeeks.reduce((sum, week) => sum + weeklyMap[week].amount, 0);
      // Calculate total paid
      const totalPaidForSupplier = sortedPayments.reduce((sum, p) => sum + Number(p.amount), 0);
      const allPaid = totalPaidForSupplier >= totalWeeklySupply;
      // Build weeklySupplies with correct status logic
      const weeklySupplies = sortedWeeks.map(week => {
        const weekData = weeklyMap[week];
        // If all items are paid, mark as paid; else unpaid
        const allPaid = weekData.items.length > 0 && weekData.items.every(item => item.paymentStatus === 'COMPLETED');
        const status = allPaid ? 'paid' : 'unpaid';
        return { ...weekData, status };
      });
      return {
        ...supplier,
        totalSupplied,
        outstandingPayment,
        lastSupply,
        weeklySupplies,
        paymentHistory: pays.map(p => ({
          amount: Number(p.amount),
          paymentDate: p.paymentDate instanceof Date ? p.paymentDate.toISOString() : p.paymentDate,
          paymentMethod: (p as any).paymentMethod || 'CASH',
          notes: (p as any).notes || null
        }))
      };
    });

    // Convert BigInt values to strings for JSON serialization
    const serializedSuppliers = enrichedSuppliers.map(supplier => ({
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
      data: { suppliers: serializedSuppliers } 
    });
  } catch (error) {
    console.error('Get suppliers error:', error);
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
      shopId // Single shop ID for backward compatibility
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
            address
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