import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { validateToken } from '@/app/lib/tokenUtils';
import { getShopFilter } from '@/app/lib/shopAccessUtils';

const prisma = new PrismaClient();

// GET - Get today's sales summary and history
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
    const shopIdParam = searchParams.get('shopId');
    const dateParam = searchParams.get('date') || new Date().toISOString().split('T')[0];

    // Get shop filter based on user's access
    const shopFilter = await getShopFilter(token);
    
    let whereClause: any = {};
    if (shopIdParam) {
      const shopId = parseInt(shopIdParam);
      if (!isNaN(shopId)) {
        // Check if user can access this shop
        if (Object.keys(shopFilter).length === 0 || ((shopFilter as any).shopId && (shopFilter as any).shopId.in.includes(shopId))) {
          // Prisma expects BigInt for shopId
          whereClause.shopId = BigInt(shopId);
        } else {
          return NextResponse.json({ success: false, message: 'You do not have access to this shop' }, { status: 403 });
        }
      }
    } else {
      // No specific shopId provided, use user's assigned shops
      if (Object.keys(shopFilter).length > 0) {
        // Check if user has any valid shop assignments
        if ((shopFilter as any).shopId && (shopFilter as any).shopId.in && (shopFilter as any).shopId.in.length > 0) {
          Object.assign(whereClause, shopFilter);
        } else {
          // User has no shop assignments
          return NextResponse.json({ 
            success: false, 
            message: 'You do not have access to any shops. Please contact your administrator.' 
          }, { status: 403 });
        }
      }
      // If no shop filter (SUPER_DUPER_ADMIN), allow access to all shops
    }

    // Get today's sales
    const startOfDay = new Date(dateParam);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(dateParam);
    endOfDay.setHours(23, 59, 59, 999);

    const todaySales = await prisma.sale.findMany({
      where: {
        ...whereClause,
        isActive: true,
        OR: [
          { saleDate: { gte: startOfDay, lte: endOfDay } },
          { createdAt: { gte: startOfDay, lte: endOfDay } }
        ]
      },
      include: {
        customer: { select: { name: true, phone: true } },
        shop: { select: { name: true, location: true } },
        items: {
          include: {
            product: { select: { name: true, sku: true } }
          }
        }
      },
      orderBy: { saleDate: 'desc' }
    });

    // Calculate summary statistics
    const totalSales = todaySales.length;
    const parseDecimal = (value: any): number => {
      if (value === null || value === undefined) return 0;
      if (typeof value === 'object' && value.toString) {
        return parseFloat(value.toString());
      }
      return Number(value) || 0;
    };

    // Compute totals using paymentStatus/paymentMethod/notes
    const amounts = todaySales.map((sale) => {
      const total = parseDecimal(sale.finalAmount);
      let paid = 0;
      let due = 0;
      if (sale.paymentStatus === 'COMPLETED') {
        paid = total; due = 0;
      } else if (sale.paymentStatus === 'PENDING') {
        const m = sale.notes?.match(/Partial Payment: ₹(\d+(?:\.\d+)?) via (\w+), Due: ₹(\d+(?:\.\d+)?)/);
        if (m) { paid = parseFloat(m[1]); due = parseFloat(m[3]); }
        else { paid = 0; due = total; }
      }
      return { total, paid, due };
    });
    const totalAmount = amounts.reduce((s, a) => s + a.total, 0);
    const totalPaid = amounts.reduce((s, a) => s + a.paid, 0);
    const totalDue = amounts.reduce((s, a) => s + a.due, 0);
    
    // Payment method breakdown
    const paymentBreakdown = {
      cash: 0,
      card: 0,
      upi: 0,
      bank_transfer: 0,
      cheque: 0,
      other: 0
    };

    // Build breakdown from inferred payment source and paid amount
    todaySales.forEach((sale) => {
      const total = parseDecimal(sale.finalAmount);
      let method = 'other';
      let paid = 0;
      if (sale.paymentStatus === 'COMPLETED') {
        paid = total;
        method = (sale.paymentMethod || 'CASH').toString().toLowerCase();
        if (method === 'card' || method === 'upi' || method === 'bank_transfer' || method === 'cheque' || method === 'cash') {
          paymentBreakdown[method as keyof typeof paymentBreakdown] += paid;
        } else {
          paymentBreakdown.other += paid;
        }
      } else if (sale.paymentStatus === 'PENDING') {
        const m = sale.notes?.match(/Partial Payment: ₹(\d+(?:\.\d+)?) via (\w+), Due: ₹(\d+(?:\.\d+)?)/);
        if (m) {
          paid = parseFloat(m[1]);
          method = m[2].toLowerCase();
          if (method === 'cash' || method === 'card' || method === 'upi' || method === 'bank_transfer' || method === 'cheque' || method === 'online') {
            const key = method === 'online' || method === 'card' ? 'card' : method;
            paymentBreakdown[key as keyof typeof paymentBreakdown] += paid;
          } else {
            paymentBreakdown.other += paid;
          }
        }
      }
    });

    // Get or create analytics summary for today
    const today = new Date(dateParam);
    today.setHours(0, 0, 0, 0);

    let analyticsSummary = await prisma.analyticsSummary.findFirst({
      where: {
        ...whereClause,
        date: today
      }
    });

    if (!analyticsSummary) {
      // Get the first available shop for this user
      let defaultShopId = 1;
      if (Object.keys(shopFilter).length > 0 && (shopFilter as any).shopId && (shopFilter as any).shopId.in && (shopFilter as any).shopId.in.length > 0) {
        defaultShopId = (shopFilter as any).shopId.in[0];
      } else if (Object.keys(shopFilter).length === 0) {
        // SUPER_DUPER_ADMIN - get first active shop
        const firstShop = await prisma.shop.findFirst({
          where: { isActive: true },
          select: { id: true }
        });
        if (firstShop) {
          defaultShopId = Number(firstShop.id);
        }
      }

      // Create or update summary atomically to avoid unique constraint conflicts
      analyticsSummary = await prisma.analyticsSummary.upsert({
        where: {
          // Prisma generates a compound unique name as `${field1}_${field2}`
          date_shopId: { date: today, shopId: BigInt(defaultShopId) }
        },
        create: {
          shopId: BigInt(defaultShopId),
          date: today,
          totalSales: totalAmount,
          totalExpenses: 0,
          netProfit: totalAmount,
          totalProducts: 0,
          totalCustomers: 0
        },
        update: {
          totalSales: totalAmount,
          netProfit: totalAmount // expenses handled in separate endpoint
        }
      });
    } else {
      // Update existing summary
      analyticsSummary = await prisma.analyticsSummary.update({
        where: { id: analyticsSummary.id },
        data: {
          totalSales: totalAmount,
          netProfit: totalAmount - Number(analyticsSummary.totalExpenses)
        }
      });
    }

    // Map sales for frontend
    const mapPaymentMethodToFrontend = (method: string) => {
      switch (method) {
        case 'CASH': return 'cash';
        case 'CARD': return 'online';
        case 'UPI': return 'upi';
        case 'BANK_TRANSFER': return 'online';
        case 'CHEQUE': return 'cheque';
        default: return 'cash';
      }
    };

    const mappedSales = todaySales.map(sale => {
      const finalAmount = parseDecimal(sale.finalAmount);
      let paidAmount = 0;
      let dueAmount = 0;
      let paymentType = 'cash';
      let partialPaymentMethod: string | null = null;
      if (sale.paymentStatus === 'COMPLETED') {
        paidAmount = finalAmount; dueAmount = 0;
        paymentType = mapPaymentMethodToFrontend(String(sale.paymentMethod));
      } else if (sale.paymentStatus === 'PENDING') {
        const m = sale.notes?.match(/Partial Payment: ₹(\d+(?:\.\d+)?) via (\w+), Due: ₹(\d+(?:\.\d+)?)/);
        if (m) {
          paidAmount = parseFloat(m[1]);
          dueAmount = parseFloat(m[3]);
          paymentType = 'partial';
          partialPaymentMethod = mapPaymentMethodToFrontend(m[2].toUpperCase());
        } else {
          paidAmount = 0; dueAmount = finalAmount; paymentType = 'loan';
        }
      }
      return {
        id: Number(sale.id),
        date: sale.saleDate.toISOString().slice(0, 10),
        time: sale.saleDate.toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        }),
        total_amount: parseDecimal(sale.totalAmount),
        final_amount: finalAmount,
        paid_amount: paidAmount,
        due_amount: dueAmount,
        discount: parseDecimal(sale.discount),
        payment_type: paymentType,
        partial_payment_method: partialPaymentMethod,
        paymentStatus: sale.paymentStatus,
        customerName: sale.customer?.name || '',
        customerPhone: sale.customer?.phone || '',
        shopName: sale.shop?.name || '',
        shopLocation: sale.shop?.location || '',
        notes: sale.notes,
        items: sale.items.map(item => ({
          id: Number(item.id),
          name: item.product?.name || '',
          sku: item.product?.sku || '',
          quantity: Number(item.quantity),
          price_per_unit: parseDecimal(item.unitPrice),
          total_price: parseDecimal(item.totalPrice)
        }))
      };
    });

    // Convert BigInt values in analyticsSummary to numbers
    const serializedAnalyticsSummary = {
      id: Number(analyticsSummary.id),
      shopId: Number(analyticsSummary.shopId),
      date: analyticsSummary.date,
      totalSales: parseDecimal(analyticsSummary.totalSales),
      totalExpenses: parseDecimal(analyticsSummary.totalExpenses),
      netProfit: parseDecimal(analyticsSummary.netProfit),
      totalProducts: Number(analyticsSummary.totalProducts),
      totalCustomers: Number(analyticsSummary.totalCustomers),
      createdAt: analyticsSummary.createdAt,
      updatedAt: analyticsSummary.updatedAt
    };

    return NextResponse.json({
      success: true,
      data: {
        sales: mappedSales,
        summary: {
        totalSales,
          totalAmount,
          totalPaid,
          totalDue,
          paymentBreakdown,
          analyticsSummary: serializedAnalyticsSummary
        }
      }
    });
  } catch (error) {
    console.error('Get today sales error:', error);
    return NextResponse.json({ success: false, message: 'Failed to fetch today sales' }, { status: 500 });
  }
}

// POST - Update daily analytics summary
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
    const { shopId, date, totalExpenses, totalProducts, totalCustomers } = body;

    if (!shopId || !date) {
      return NextResponse.json({ success: false, message: 'Missing required fields: shopId, date' }, { status: 400 });
    }

    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);

    // Get or create analytics summary
    let analyticsSummary = await prisma.analyticsSummary.findFirst({
      where: {
        shopId,
        date: targetDate
      }
    });

    if (analyticsSummary) {
      // Update existing summary
      analyticsSummary = await prisma.analyticsSummary.update({
        where: { id: analyticsSummary.id },
        data: {
          totalExpenses: totalExpenses || analyticsSummary.totalExpenses,
          totalProducts: totalProducts || analyticsSummary.totalProducts,
          totalCustomers: totalCustomers || analyticsSummary.totalCustomers,
          netProfit: Number(analyticsSummary.totalSales) - Number(totalExpenses || analyticsSummary.totalExpenses),
          
        }
      });
    } else {
      // Create new summary
      analyticsSummary = await prisma.analyticsSummary.create({
        data: {
          shopId,
          date: targetDate,
          totalSales: 0,
          totalExpenses: totalExpenses || 0,
          netProfit: -(totalExpenses || 0),
          totalProducts: totalProducts || 0,
          totalCustomers: totalCustomers || 0,
          
        }
      });
    }

    return NextResponse.json({ success: true, data: { analyticsSummary } });
  } catch (error) {
    console.error('Update analytics error:', error);
    return NextResponse.json({ success: false, message: 'Failed to update analytics' }, { status: 500 });
  }
} 