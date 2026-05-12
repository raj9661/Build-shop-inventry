import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { validateToken } from '@/app/lib/tokenUtils';
import { getShopFilter } from '@/app/lib/shopAccessUtils';

const prisma = new PrismaClient();

// Helper function to safely serialize BigInt values for JSON response
function serializeBigInt(obj: any): string {
  return JSON.stringify(obj, (key, value) =>
    typeof value === 'bigint' ? value.toString() : value
  );
}

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
    const now = new Date();
    const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const dateParam = searchParams.get('date') || localDate;
    const fromDateParam = searchParams.get('from_date');
    const toDateParam = searchParams.get('to_date');

    // Get shop filter based on user's access
    const shopFilter = await getShopFilter(token);
    
    let whereClause: any = {};
    if (shopIdParam) {
      const shopId = parseInt(shopIdParam);
      if (!isNaN(shopId)) {
        // Check if user can access this shop
        let hasAccess = false;
        if (Object.keys(shopFilter).length === 0) {
          hasAccess = true;
        } else if ((shopFilter as any).shopId && (shopFilter as any).shopId.in.includes(shopId)) {
          hasAccess = true;
        }

        if (hasAccess) {
          whereClause.shopId = BigInt(shopId);
        } else {
          return NextResponse.json({ success: false, message: 'You do not have access to this shop' }, { status: 403 });
        }
      }
    } else {
      if (Object.keys(shopFilter).length > 0) {
        if ((shopFilter as any).shopId && (shopFilter as any).shopId.in && (shopFilter as any).shopId.in.length > 0) {
          Object.assign(whereClause, shopFilter);
        } else {
          return NextResponse.json({ 
            success: false, 
            message: 'You do not have access to any shops. Please contact your administrator.' 
          }, { status: 403 });
        }
      }
    }

    // 1. Get Sales for Summary (Strictly for the selected date)
    const summaryStart = new Date(dateParam);
    summaryStart.setHours(0, 0, 0, 0);
    const summaryEnd = new Date(dateParam);
    summaryEnd.setHours(23, 59, 59, 999);

    const summarySales = await prisma.sale.findMany({
      where: {
        ...whereClause,
        isActive: true,
        saleDate: { gte: summaryStart, lte: summaryEnd }
      }
    });

    // 2. Get Sales for History (Range based or fallback to today)
    let historyStart = summaryStart;
    let historyEnd = summaryEnd;

    if (fromDateParam || toDateParam) {
      if (fromDateParam) {
        historyStart = new Date(fromDateParam);
        historyStart.setHours(0, 0, 0, 0);
      } else {
        historyStart = new Date(historyEnd);
        historyStart.setDate(historyStart.getDate() - 30);
      }
      
      if (toDateParam) {
        historyEnd = new Date(toDateParam);
        historyEnd.setHours(23, 59, 59, 999);
      }
    } else {
      // Narrow history to the selected date if no range is provided
      historyStart = summaryStart;
      historyEnd = summaryEnd;
    }

    const historySales = await prisma.sale.findMany({
      where: {
        ...whereClause,
        isActive: true,
        saleDate: { gte: historyStart, lte: historyEnd }
      },
      include: {
        customer: { select: { name: true, phone: true } },
        shop: { select: { name: true, location: true } },
        items: {
          include: {
            product: { select: { name: true, sku: true, unit: true } }
          }
        }
      },
      orderBy: { saleDate: 'desc' }
    });

    // Calculate summary statistics using summarySales
    const parseDecimal = (value: any): number => {
      if (value === null || value === undefined) return 0;
      if (typeof value === 'object' && value.toString) {
        return parseFloat(value.toString());
      }
      return Number(value) || 0;
    };

    const amounts = summarySales.map((sale) => {
      const total = parseDecimal(sale.finalAmount);
      let paid = 0;
      let due = 0;
      
      const isExplicitLoan = sale.notes?.includes('Loan/Credit Sale');
      const partialMatch = sale.notes?.match(/Partial Payment: ₹(\d+(?:\.\d+)?) via (\w+), Due: ₹(\d+(?:\.\d+)?)/);

      if (isExplicitLoan) {
        paid = 0; due = total;
      } else if (partialMatch) {
        paid = parseFloat(partialMatch[1]);
        due = parseFloat(partialMatch[3]);
      } else if (sale.paymentStatus === 'COMPLETED') {
        paid = total; due = 0;
      } else if (sale.paymentStatus === 'PENDING') {
        paid = 0; due = total;
      }
      return { total, paid, due };
    });
    
    const totalSales = summarySales.length;
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
      loan: 0,
      other: 0
    };

    summarySales.forEach((sale) => {
      const total = parseDecimal(sale.finalAmount);
      let method = (sale.paymentMethod || 'CASH').toString().toLowerCase();
      
      const partialMatch = sale.notes?.match(/Partial Payment: ₹(\d+(?:\.\d+)?) via (\w+), Due: ₹(\d+(?:\.\d+)?)/);
      const isLoan = sale.notes?.includes('Loan/Credit Sale') || (sale.paymentStatus === 'PENDING' && !partialMatch && total > 0);

      if (partialMatch) {
        const paid = parseFloat(partialMatch[1]);
        const due = parseFloat(partialMatch[3]);
        let partialMethod = partialMatch[2].toLowerCase();
        if (partialMethod === 'online') partialMethod = 'card';
        
        if (partialMethod in paymentBreakdown) {
          paymentBreakdown[partialMethod as keyof typeof paymentBreakdown] += paid;
        } else {
          paymentBreakdown.other += paid;
        }
        paymentBreakdown.loan += due;
      } else if (isLoan) {
        paymentBreakdown.loan += total;
      } else {
        if (method === 'online') method = 'card';
        if (method in paymentBreakdown) {
          paymentBreakdown[method as keyof typeof paymentBreakdown] += total;
        } else {
          paymentBreakdown.other += total;
        }
      }
    });

    const summaryDay = new Date(dateParam);
    summaryDay.setHours(0, 0, 0, 0);

    let analyticsSummary = await prisma.analyticsSummary.findFirst({
      where: {
        ...whereClause,
        date: summaryDay
      }
    });

    if (!analyticsSummary) {
      let defaultShopId = 1;
      if (Object.keys(shopFilter).length > 0 && (shopFilter as any).shopId && (shopFilter as any).shopId.in && (shopFilter as any).shopId.in.length > 0) {
        defaultShopId = (shopFilter as any).shopId.in[0];
      } else if (Object.keys(shopFilter).length === 0) {
        const firstShop = await prisma.shop.findFirst({
          where: { isActive: true },
          select: { id: true }
        });
        if (firstShop) defaultShopId = Number(firstShop.id);
      }

      analyticsSummary = await prisma.analyticsSummary.upsert({
        where: {
          date_shopId: { date: summaryDay, shopId: BigInt(defaultShopId) }
        },
        create: {
          shopId: BigInt(defaultShopId),
          date: summaryDay,
          totalSales: totalAmount,
          totalExpenses: 0,
          netProfit: totalAmount,
          totalProducts: 0,
          totalCustomers: 0
        },
        update: {
          totalSales: totalAmount,
          netProfit: totalAmount
        }
      });
    } else {
      analyticsSummary = await prisma.analyticsSummary.update({
        where: { id: analyticsSummary.id },
        data: {
          totalSales: totalAmount,
          netProfit: totalAmount - Number(analyticsSummary.totalExpenses)
        }
      });
    }

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

    const mappedSales = historySales.map(sale => {
      const finalAmount = parseDecimal(sale.finalAmount);
      let paidAmount = 0;
      let dueAmount = 0;
      let paymentType = 'cash';
      let partialPaymentMethod: string | null = null;

      const isExplicitLoan = sale.notes?.includes('Loan/Credit Sale');
      const partialMatch = sale.notes?.match(/Partial Payment: ₹(\d+(?:\.\d+)?) via (\w+), Due: ₹(\d+(?:\.\d+)?)/);

      if (isExplicitLoan) {
        paidAmount = 0;
        dueAmount = finalAmount;
        paymentType = 'loan';
      } else if (partialMatch) {
        paidAmount = parseFloat(partialMatch[1]);
        dueAmount = parseFloat(partialMatch[3]);
        paymentType = 'partial';
        partialPaymentMethod = mapPaymentMethodToFrontend(partialMatch[2].toUpperCase());
      } else if (sale.paymentStatus === 'COMPLETED') {
        paidAmount = finalAmount; dueAmount = 0;
        paymentType = mapPaymentMethodToFrontend(String(sale.paymentMethod));
      } else if (sale.paymentStatus === 'PENDING') {
        paidAmount = 0; dueAmount = finalAmount; paymentType = 'loan';
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
          unit: item.unit || item.product?.unit || 'pcs',
          quantity: Number(item.quantity),
          price_per_unit: parseDecimal(item.unitPrice),
          total_price: parseDecimal(item.totalPrice)
        }))
      };
    });

    const responseData = {
      success: true,
      data: {
        sales: mappedSales,
        summary: {
          totalSales,
          totalAmount,
          totalPaid,
          totalDue,
          paymentBreakdown,
          analyticsSummary: {
            ...analyticsSummary,
            id: Number(analyticsSummary.id),
            shopId: Number(analyticsSummary.shopId),
            totalSales: parseDecimal(analyticsSummary.totalSales),
            totalExpenses: parseDecimal(analyticsSummary.totalExpenses),
            netProfit: parseDecimal(analyticsSummary.netProfit),
            totalProducts: Number(analyticsSummary.totalProducts),
            totalCustomers: Number(analyticsSummary.totalCustomers)
          }
        }
      }
    };

    return new NextResponse(serializeBigInt(responseData), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Get analytics error:', error);
    return NextResponse.json({ success: false, message: 'Failed to fetch analytics data' }, { status: 500 });
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