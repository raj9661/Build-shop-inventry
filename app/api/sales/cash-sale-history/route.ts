import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { validateToken } from '@/app/lib/tokenUtils';


function serializeBigInt(obj: any): string {
  return JSON.stringify(obj, (key, value) =>
    typeof value === 'bigint' ? value.toString() : value
  );
}

// GET - Fetch sale history from both Sale + TmtSale models (SUPER_DUPER_ADMIN and SUPER_ADMIN only)
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

    if (decoded.role !== 'SUPER_DUPER_ADMIN' && decoded.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ success: false, message: 'Access denied. Admin only.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const shopIdParam = searchParams.get('shopId');
    const fromParam   = searchParams.get('from');
    const toParam     = searchParams.get('to');
    const searchParam = searchParams.get('search') || '';
    const page        = parseInt(searchParams.get('page')  || '1');
    const limit       = parseInt(searchParams.get('limit') || '20');
    const skip        = (page - 1) * limit;
    const saleTypeParam = searchParams.get('saleType') || 'all'; // 'all' | 'cash' | 'regular'

    // ─── Build allowed shop list ───────────────────────────────────────────────
    let allowedShopIds: bigint[] = [];
    if (decoded.role === 'SUPER_DUPER_ADMIN') {
      const userShops = await prisma.shop.findMany({
        where: { createdBy: BigInt(decoded.userId), isActive: true },
        select: { id: true }
      });
      allowedShopIds = userShops.map(s => s.id);
    } else {
      const assignments = await prisma.userShopAssignment.findMany({
        where: { userId: BigInt(decoded.userId), active: true },
        include: { shop: { select: { id: true, isActive: true } } }
      });
      allowedShopIds = assignments.filter(a => a.shop.isActive).map(a => a.shop.id);
    }

    if (allowedShopIds.length === 0) {
      return NextResponse.json({ success: false, message: 'No shops assigned' }, { status: 403 });
    }

    let shopIdFilter: any;
    if (shopIdParam) {
      const reqShopId = BigInt(parseInt(shopIdParam));
      if (!allowedShopIds.some(id => id === reqShopId)) {
        return NextResponse.json({ success: false, message: 'Access denied to this shop' }, { status: 403 });
      }
      shopIdFilter = reqShopId;
    } else {
      shopIdFilter = { in: allowedShopIds };
    }

    // ─── Date filter ───────────────────────────────────────────────────────────
    let dateFilter: any = {};
    if (fromParam) { const d = new Date(fromParam); d.setHours(0,0,0,0); dateFilter.gte = d; }
    if (toParam)   { const d = new Date(toParam);   d.setHours(23,59,59,999); dateFilter.lte = d; }
    const hasDateFilter = Object.keys(dateFilter).length > 0;

    // ─── Sale type filters ─────────────────────────────────────────────────────
    // Sale model: Cash = paymentMethod CASH + null/empty/tagged notes
    const LOAN_MARKERS = ['Loan/Credit Sale:', 'Partial Payment:', 'Direct Truck Sale'];
    const isCashSaleCondition: any = {
      AND: [
        { paymentMethod: 'CASH' as any },
        {
          OR: [
            { notes: null },
            { notes: '' },
            { notes: { contains: '[CASH_SALE]' } },
            { AND: LOAN_MARKERS.map(m => ({ NOT: { notes: { contains: m } } })) }
          ]
        }
      ]
    };

    let saleSaleTypeFilter: any = {};
    if (saleTypeParam === 'cash')    saleSaleTypeFilter = isCashSaleCondition;
    else if (saleTypeParam === 'regular') saleSaleTypeFilter = { NOT: isCashSaleCondition };

    // TmtSale model: Cash = paymentMethod CASH, Regular = anything else
    let tmtSaleTypeFilter: any = {};
    if (saleTypeParam === 'cash')    tmtSaleTypeFilter = { paymentMethod: 'CASH' as any };
    else if (saleTypeParam === 'regular') tmtSaleTypeFilter = { NOT: { paymentMethod: 'CASH' as any } };

    // ─── Search conditions ─────────────────────────────────────────────────────
    let searchCondition: any = {};
    let tmtSearchCondition: any = {};
    if (searchParam) {
      searchCondition = {
        OR: [
          { customer: { name: { contains: searchParam, mode: 'insensitive' } } },
          { customer: { phone: { contains: searchParam, mode: 'insensitive' } } },
          { customer: { address: { contains: searchParam, mode: 'insensitive' } } },
          { shop: { name: { contains: searchParam, mode: 'insensitive' } } },
        ]
      };
      tmtSearchCondition = {
        OR: [
          { customerName: { contains: searchParam, mode: 'insensitive' } },
          { customer: { name: { contains: searchParam, mode: 'insensitive' } } },
          { customer: { phone: { contains: searchParam, mode: 'insensitive' } } },
          { customer: { address: { contains: searchParam, mode: 'insensitive' } } },
          { shop: { name: { contains: searchParam, mode: 'insensitive' } } },
        ]
      };
    }

    const fetchLimit = skip + limit;

    // ─── Parallel queries ──────────────────────────────────────────────────────
    const [sales, tmtSales, salesCount, tmtSalesCount, shopsList] = await Promise.all([
      prisma.sale.findMany({
        where: {
          shopId: shopIdFilter,
          isActive: true,
          ...saleSaleTypeFilter,
          ...searchCondition,
          ...(hasDateFilter ? { saleDate: dateFilter } : {})
        },
        include: {
          customer: { select: { name: true, phone: true, address: true } },
          shop: { select: { id: true, name: true, location: true } },
          items: { include: { product: { select: { name: true, sku: true, unit: true } } } }
        },
        orderBy: { saleDate: 'desc' },
        take: fetchLimit
      }),
      prisma.tmtSale.findMany({
        where: {
          shopId: shopIdFilter,
          isActive: true,
          ...tmtSaleTypeFilter,
          ...tmtSearchCondition,
          ...(hasDateFilter ? { saleDate: dateFilter } : {})
        },
        include: {
          customer: { select: { name: true, phone: true, address: true } },
          shop: { select: { id: true, name: true, location: true } },
          items: { include: { product: { select: { productName: true } } } }
        },
        orderBy: { saleDate: 'desc' },
        take: fetchLimit
      }),
      prisma.sale.count({
        where: {
          shopId: shopIdFilter,
          isActive: true,
          ...saleSaleTypeFilter,
          ...searchCondition,
          ...(hasDateFilter ? { saleDate: dateFilter } : {})
        }
      }),
      prisma.tmtSale.count({
        where: {
          shopId: shopIdFilter,
          isActive: true,
          ...tmtSaleTypeFilter,
          ...tmtSearchCondition,
          ...(hasDateFilter ? { saleDate: dateFilter } : {})
        }
      }),
      decoded.role === 'SUPER_DUPER_ADMIN'
        ? prisma.shop.findMany({
            where: { createdBy: BigInt(decoded.userId), isActive: true },
            select: { id: true, name: true, location: true }
          })
        : prisma.userShopAssignment.findMany({
            where: { userId: BigInt(decoded.userId), active: true },
            include: { shop: { select: { id: true, name: true, location: true, isActive: true } } }
          }).then(a => a.filter((x: any) => x.shop.isActive).map((x: any) => x.shop))
    ]);

    const parseDecimal = (v: any): number => {
      if (v == null) return 0;
      if (typeof v === 'object' && v.toString) return parseFloat(v.toString());
      return Number(v) || 0;
    };

    // ─── Map Sale records ──────────────────────────────────────────────────────
    const mappedSales = sales.map(sale => {
      const rawNotes = sale.notes || '';
      const hasTag = rawNotes.includes('[CASH_SALE]');
      const isLegacyCash = sale.paymentMethod === 'CASH'
        && !rawNotes.includes('Loan/Credit Sale:')
        && !rawNotes.includes('Partial Payment:')
        && !rawNotes.includes('Direct Truck Sale');
      const cleanNotes = rawNotes.replace('[CASH_SALE]', '').trim();
      return {
        id: Number(sale.id),
        source: 'sale',
        saleDate: sale.saleDate,
        saleType: (hasTag || isLegacyCash) ? 'cash' : 'regular',
        customerName: sale.customer?.name || 'Walk-in Customer',
        customerPhone: sale.customer?.phone || '',
        customerAddress: sale.customer?.address || '',
        shopId: Number(sale.shopId),
        shopName: (sale as any).shop?.name || '',
        shopLocation: (sale as any).shop?.location || '',
        totalAmount: parseDecimal(sale.totalAmount),
        finalAmount: parseDecimal(sale.finalAmount),
        discount: parseDecimal(sale.discount),
        paymentMethod: sale.paymentMethod,
        paymentStatus: sale.paymentStatus,
        notes: cleanNotes,
        items: sale.items.map(item => ({
          id: Number(item.id),
          name: item.product?.name || '',
          sku: item.product?.sku || '',
          unit: item.unit || item.product?.unit || 'pcs',
          quantity: Number(item.quantity),
          unitPrice: parseDecimal(item.unitPrice),
          totalPrice: parseDecimal(item.totalPrice)
        })),
        createdAt: sale.createdAt
      };
    });

    // ─── Map TmtSale records ───────────────────────────────────────────────────
    const mappedTmtSales = tmtSales.map(sale => ({
      id: Number(sale.id),
      source: 'tmt',
      saleDate: sale.saleDate,
      saleType: sale.paymentMethod === 'CASH' ? 'cash' : 'regular',
      customerName: sale.customerName || sale.customer?.name || 'Walk-in Customer',
      customerPhone: sale.customer?.phone || '',
      customerAddress: sale.customer?.address || '',
      shopId: Number(sale.shopId),
      shopName: (sale as any).shop?.name || '',
      shopLocation: (sale as any).shop?.location || '',
      totalAmount: parseDecimal(sale.totalAmount),
      finalAmount: parseDecimal(sale.totalAmount),
      discount: 0,
      paymentMethod: sale.paymentMethod,
      paymentStatus: sale.paymentStatus,
      notes: sale.notes || '',
      items: sale.items.map((item: any) => ({
        id: Number(item.id),
        name: item.product?.productName || 'TMT Bar',
        sku: '',
        unit: item.unitType?.toLowerCase() || 'kg',
        quantity: Number(item.quantity),
        unitPrice: parseDecimal(item.unitPrice),
        totalPrice: parseDecimal(item.totalPrice)
      })),
      createdAt: sale.createdAt
    }));

    // ─── Merge → sort → paginate ─────────────────────────────────────
    let combined = [...mappedSales, ...mappedTmtSales];

    combined.sort((a, b) => new Date(b.saleDate).getTime() - new Date(a.saleDate).getTime());

    const totalCount  = salesCount + tmtSalesCount;
    const pagedSales  = combined.slice(skip, skip + limit);

    const responseData = {
      success: true,
      data: {
        sales: pagedSales,
        pagination: {
          total: totalCount,
          page,
          limit,
          totalPages: Math.ceil(totalCount / limit)
        },
        shops: (shopsList as any[]).map((s: any) => ({
          id: Number(s.id),
          name: s.name,
          location: s.location
        }))
      }
    };

    return new NextResponse(serializeBigInt(responseData), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Sale history error:', error);
    return NextResponse.json({ success: false, message: 'Failed to fetch sale history' }, { status: 500 });
  }
}

// DELETE - Delete a sale (SUPER_DUPER_ADMIN only) — operates on Sale model
export async function DELETE(req: NextRequest) {
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
      return NextResponse.json({ success: false, message: 'Only Super Admin can delete sales' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const saleIdParam = searchParams.get('id');
    const sourceParam = searchParams.get('source') || 'sale'; // 'sale' | 'tmt'
    if (!saleIdParam) {
      return NextResponse.json({ success: false, message: 'Sale ID required' }, { status: 400 });
    }

    const saleId = parseInt(saleIdParam);
    if (isNaN(saleId)) {
      return NextResponse.json({ success: false, message: 'Invalid sale ID' }, { status: 400 });
    }

    if (sourceParam === 'tmt') {
      // Soft-delete TmtSale
      const tmtSale = await prisma.tmtSale.findUnique({
        where: { id: BigInt(saleId) },
        include: { shop: { select: { createdBy: true } } }
      });
      if (!tmtSale) {
        return NextResponse.json({ success: false, message: 'TMT Sale not found' }, { status: 404 });
      }
      if ((tmtSale as any).shop?.createdBy !== BigInt(decoded.userId)) {
        return NextResponse.json({ success: false, message: 'Access denied to this sale' }, { status: 403 });
      }
      await prisma.tmtSale.update({
        where: { id: BigInt(saleId) },
        data: { isActive: false }
      });
      return NextResponse.json({ success: true, message: 'TMT sale deleted successfully' });
    }

    // Default: Sale model
    const sale = await prisma.sale.findUnique({
      where: { id: BigInt(saleId) },
      include: {
        shop: { select: { createdBy: true } },
        items: { include: { product: true } }
      }
    });

    if (!sale) {
      return NextResponse.json({ success: false, message: 'Sale not found' }, { status: 404 });
    }
    if (sale.shop?.createdBy !== BigInt(decoded.userId)) {
      return NextResponse.json({ success: false, message: 'Access denied to this sale' }, { status: 403 });
    }

    await prisma.$transaction(async (tx) => {
      for (const item of sale.items) {
        const product = item.product;
        if (!product) continue;
        const quantity = Number(item.quantity);
        const conversionCft = item.conversionCft ? Number(item.conversionCft) : 1;
        const totalCft = quantity * conversionCft;
        const currentStock = Number(product.stockQuantity);
        await tx.product.update({
          where: { id: product.id },
          data: { stockQuantity: currentStock + totalCft }
        });
      }
      await tx.sale.update({
        where: { id: BigInt(saleId) },
        data: { isActive: false, notes: `${sale.notes || ''} [Deleted by admin]` }
      });
      await tx.saleItem.updateMany({
        where: { saleId: BigInt(saleId) },
        data: { isActive: false }
      });
      await tx.customerLedgerEntry.deleteMany({
        where: { description: { contains: `Sale #${saleId}` } }
      });
    });

    return NextResponse.json({ success: true, message: 'Sale deleted successfully' });
  } catch (error) {
    console.error('Delete sale error:', error);
    return NextResponse.json({ success: false, message: 'Failed to delete sale' }, { status: 500 });
  }
}

// PATCH - Edit a sale notes/discount (SUPER_DUPER_ADMIN only)
export async function PATCH(req: NextRequest) {
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
      return NextResponse.json({ success: false, message: 'Only Super Admin can edit sales' }, { status: 403 });
    }

    const body = await req.json();
    const { id, notes, discount, source } = body;

    if (!id) {
      return NextResponse.json({ success: false, message: 'Sale ID required' }, { status: 400 });
    }

    if (source === 'tmt') {
      const tmtSale = await prisma.tmtSale.findUnique({
        where: { id: BigInt(id), isActive: true },
        include: { shop: { select: { createdBy: true } } }
      });
      if (!tmtSale) {
        return NextResponse.json({ success: false, message: 'TMT Sale not found' }, { status: 404 });
      }
      if ((tmtSale as any).shop?.createdBy !== BigInt(decoded.userId)) {
        return NextResponse.json({ success: false, message: 'Access denied' }, { status: 403 });
      }
      const updateData: any = {};
      if (notes !== undefined) updateData.notes = notes;
      const updated = await prisma.tmtSale.update({ where: { id: BigInt(id) }, data: updateData });
      return NextResponse.json({ success: true, message: 'TMT sale updated', data: { id: Number(updated.id) } });
    }

    // Default: Sale model
    const sale = await prisma.sale.findUnique({
      where: { id: BigInt(id), isActive: true },
      include: { shop: { select: { createdBy: true } } }
    });

    if (!sale) {
      return NextResponse.json({ success: false, message: 'Sale not found' }, { status: 404 });
    }
    if (sale.shop?.createdBy !== BigInt(decoded.userId)) {
      return NextResponse.json({ success: false, message: 'Access denied' }, { status: 403 });
    }

    const updateData: any = {};
    if (notes !== undefined) updateData.notes = notes;

    const updated = await prisma.sale.update({ where: { id: BigInt(id) }, data: updateData });

    return NextResponse.json({
      success: true,
      message: 'Sale updated successfully',
      data: { id: Number(updated.id) }
    });
  } catch (error) {
    console.error('Update sale error:', error);
    return NextResponse.json({ success: false, message: 'Failed to update sale' }, { status: 500 });
  }
}
