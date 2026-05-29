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

// GET - Get comprehensive analytics for user's assigned shops
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
    const days = parseInt(searchParams.get('days') || '30');
    const fromParam = searchParams.get('from');
    const toParam = searchParams.get('to');
    const shopIdParam = searchParams.get('shopId');

    console.log('🔍 User analytics API called:', { userId: decoded.userId, days, fromParam, toParam, shopIdParam });

    // Get shop filter based on user's access
    const shopFilter = await getShopFilter(token);
    
    // Determine which shops the user can access
    let whereClause: any = {};
    if (shopIdParam) {
      const shopId = parseInt(shopIdParam);
      if (!isNaN(shopId) && shopId > 0) {
        if (Object.keys(shopFilter).length === 0 || ((shopFilter as any).shopId && (shopFilter as any).shopId.in.includes(shopId))) {
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

    // Calculate date range — prefer explicit from/to over days
    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);
    const startDate = new Date();

    if (fromParam && toParam) {
      const from = new Date(fromParam);
      const to = new Date(toParam);
      startDate.setFullYear(from.getFullYear(), from.getMonth(), from.getDate());
      startDate.setHours(0, 0, 0, 0);
      endDate.setFullYear(to.getFullYear(), to.getMonth(), to.getDate());
      endDate.setHours(23, 59, 59, 999);
    } else {
      startDate.setDate(endDate.getDate() - days);
      startDate.setHours(0, 0, 0, 0);
    }

    // Get sales data
    const [
      totalGeneralSales,
      totalGeneralRevenue,
      totalProducts,
      totalCustomers,
      totalEmployees,
      totalSuppliers,
      totalExpenses,
      totalSupplierPayments,
      totalEmployeePayments,
      shops,
      totalTmtSales,
      totalTmtRevenue
    ] = await Promise.all([
      prisma.sale.count({
        where: {
          ...whereClause,
          saleDate: { gte: startDate, lte: endDate },
          isActive: true
        }
      }),
      prisma.sale.aggregate({
        where: {
          ...whereClause,
          saleDate: { gte: startDate, lte: endDate },
          isActive: true
        },
        _sum: { finalAmount: true }
      }),
      prisma.product.count({
        where: { ...whereClause, isActive: true }
      }),
      prisma.customer.count({
        where: { ...whereClause, isActive: true }
      }),
      prisma.employee.count({
        where: { ...whereClause, isActive: true }
      }),
      prisma.supplier.count({
        where: { ...whereClause, isActive: true }
      }),
      prisma.expense.aggregate({
        where: {
          ...whereClause,
          date: { gte: startDate, lte: endDate },
          isActive: true
        },
        _sum: { amount: true }
      }),
      prisma.supplierPayment.aggregate({
        where: {
          ...whereClause,
          paymentDate: { gte: startDate, lte: endDate },
          isActive: true
        },
        _sum: { amount: true }
      }),
      prisma.employeePayment.aggregate({
        where: {
          ...whereClause,
          paymentDate: { gte: startDate, lte: endDate },
          isActive: true
        },
        _sum: { amount: true }
      }),
      prisma.shop.findMany({
        where: {
          isActive: true,
          ...(whereClause.shopId ? { id: whereClause.shopId } : 
             whereClause.createdBy ? { createdBy: whereClause.createdBy } : {})
        },
        select: { id: true, name: true, location: true }
      }),
      prisma.tmtSale.count({
        where: {
          ...whereClause,
          saleDate: { gte: startDate, lte: endDate },
          isActive: true
        }
      }),
      prisma.tmtSale.aggregate({
        where: {
          ...whereClause,
          saleDate: { gte: startDate, lte: endDate },
          isActive: true
        },
        _sum: { totalAmount: true }
      })
    ]);
    
    const totalSales = Number(totalGeneralSales) + Number(totalTmtSales);
    const totalRevenueObj = {
      _sum: {
        finalAmount: (Number(totalGeneralRevenue._sum.finalAmount || 0) + Number(totalTmtRevenue._sum.totalAmount || 0))
      }
    };

    // Get sales and expenses by date — fetch all at once, bucket in-memory for adaptive granularity
    const effectiveDays = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));

    const [allSalesInRange, allTmtSalesInRange, allExpensesInRange] = await Promise.all([
      prisma.sale.findMany({
        where: { isActive: true, saleDate: { gte: startDate, lte: endDate }, ...whereClause },
        select: { saleDate: true, finalAmount: true }
      }),
      prisma.tmtSale.findMany({
        where: { isActive: true, saleDate: { gte: startDate, lte: endDate }, ...whereClause },
        select: { saleDate: true, totalAmount: true }
      }),
      prisma.expense.findMany({
        where: { isActive: true, date: { gte: startDate, lte: endDate }, ...whereClause },
        select: { date: true, amount: true }
      })
    ]);

    type ChartBucket = { label: string; sales: number; revenue: number; expenses: number };
    const chartBuckets: ChartBucket[] = [];

    const buildBuckets = (bucketDefs: { start: Date; end: Date; label: string }[]) => {
      for (const { start, end, label } of bucketDefs) {
        const bSales = allSalesInRange.filter(s => { const d = new Date(s.saleDate); return d >= start && d <= end; });
        const bTmt   = allTmtSalesInRange.filter(s => { const d = new Date(s.saleDate); return d >= start && d <= end; });
        const bExp   = allExpensesInRange.filter(e => { const d = new Date(e.date); return d >= start && d <= end; });
        chartBuckets.push({
          label,
          sales: bSales.length + bTmt.length,
          revenue: bSales.reduce((s, x) => s + Number(x.finalAmount || 0), 0)
                 + bTmt.reduce((s, x) => s + Number(x.totalAmount || 0), 0),
          expenses: bExp.reduce((s, e) => s + Number(e.amount || 0), 0)
        });
      }
    };

    if (effectiveDays <= 31) {
      // ── Daily buckets ────────────────────────────────────────────────
      const defs = Array.from({ length: effectiveDays }, (_, i) => {
        const s = new Date(startDate); s.setDate(startDate.getDate() + i); s.setHours(0, 0, 0, 0);
        const e = new Date(s); e.setHours(23, 59, 59, 999);
        return { start: s, end: e, label: s.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) };
      });
      buildBuckets(defs);
    } else if (effectiveDays <= 90) {
      // ── Weekly buckets ────────────────────────────────────────────────
      const weekCount = Math.ceil(effectiveDays / 7);
      const defs = Array.from({ length: weekCount }, (_, w) => {
        const s = new Date(startDate); s.setDate(startDate.getDate() + w * 7); s.setHours(0, 0, 0, 0);
        const e = new Date(s); e.setDate(s.getDate() + 6); e.setHours(23, 59, 59, 999);
        return { start: s, end: e, label: s.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) };
      });
      buildBuckets(defs);
    } else {
      // ── Monthly buckets ────────────────────────────────────────────────
      const numMonths = Math.min(Math.max(1, Math.ceil(effectiveDays / 30)), 12);
      const anchor = new Date(endDate);
      const defs = Array.from({ length: numMonths }, (_, i) => {
        const idx = numMonths - 1 - i;
        const s = new Date(anchor.getFullYear(), anchor.getMonth() - idx, 1, 0, 0, 0, 0);
        const e = new Date(anchor.getFullYear(), anchor.getMonth() - idx + 1, 0, 23, 59, 59, 999);
        return { start: s, end: e, label: s.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) };
      });
      buildBuckets(defs);
    }

    const salesByMonth   = chartBuckets.map(b => ({ month: b.label, sales: b.sales, revenue: b.revenue }));
    const expensesByMonth = chartBuckets.map(b => ({ month: b.label, expenses: b.expenses }));

    // Get expenses by category
    const expensesByCategory = await prisma.expense.groupBy({
      by: ['category'],
      where: {
        ...whereClause,
        date: { gte: startDate, lte: endDate },
        isActive: true
      },
      _sum: { amount: true },
      orderBy: { _sum: { amount: 'desc' } }
    });

    // Get top products
    const topProducts = await prisma.saleItem.groupBy({
      by: ['productId'],
      where: {
        sale: {
          ...whereClause,
          saleDate: { gte: startDate, lte: endDate },
          isActive: true
        }
      },
      _sum: { quantity: true, totalPrice: true },
      orderBy: { _sum: { totalPrice: 'desc' } },
      take: 10
    });

    // Get top shops
    const generalTopShops = await prisma.sale.groupBy({
      by: ['shopId'],
      where: {
        ...whereClause,
        saleDate: { gte: startDate, lte: endDate },
        isActive: true
      },
      _sum: { finalAmount: true },
      _count: { id: true }
    });
    
    const tmtTopShops = await prisma.tmtSale.groupBy({
      by: ['shopId'],
      where: {
        ...whereClause,
        saleDate: { gte: startDate, lte: endDate },
        isActive: true
      },
      _sum: { totalAmount: true },
      _count: { id: true }
    });

    const userTopShopsMap = new Map<number, { revenue: number, sales: number }>();
    generalTopShops.forEach(item => {
      const id = Number(item.shopId);
      const val = userTopShopsMap.get(id) || { revenue: 0, sales: 0 };
      val.revenue += item._sum?.finalAmount ? parseFloat((item._sum.finalAmount as any).toString()) : 0;
      val.sales += item._count.id;
      userTopShopsMap.set(id, val);
    });
    tmtTopShops.forEach(item => {
      const id = Number(item.shopId);
      const val = userTopShopsMap.get(id) || { revenue: 0, sales: 0 };
      val.revenue += item._sum?.totalAmount ? parseFloat((item._sum.totalAmount as any).toString()) : 0;
      val.sales += item._count.id;
      userTopShopsMap.set(id, val);
    });
    
    // Sort and take top 10
    const topShopsArr = Array.from(userTopShopsMap.entries())
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .slice(0, 10);

    // Get sales by payment method
    const [salesForPaymentMethod, tmtSalesForPaymentMethod] = await Promise.all([
      prisma.sale.findMany({
        where: {
          ...whereClause,
          saleDate: { gte: startDate, lte: endDate },
          isActive: true
        },
        select: { finalAmount: true, paymentMethod: true, paymentStatus: true, notes: true }
      }),
      prisma.tmtSale.findMany({
        where: {
          ...whereClause,
          saleDate: { gte: startDate, lte: endDate },
          isActive: true
        },
        select: { totalAmount: true, paymentMethod: true, paymentStatus: true, notes: true }
      })
    ]);

    const paymentBreakdownMap = new Map<string, { amount: number, count: number }>();
    
    const combinedPayments = [
      ...salesForPaymentMethod.map(s => ({ ...s, amount: Number(s.finalAmount || 0) })),
      ...tmtSalesForPaymentMethod.map(ts => ({ ...ts, amount: Number(ts.totalAmount || 0) }))
    ];

    combinedPayments.forEach(sale => {
      const amount = sale.amount;
      let method = (sale.paymentMethod || 'CASH') as string;
      
      const partialMatch = sale.notes?.match(/Partial Payment: ₹(\d+(?:\.\d+)?) via (\w+), Due: ₹(\d+(?:\.\d+)?)/);
      const isLoan = sale.notes?.includes('Loan/Credit Sale') || (sale.paymentStatus === 'PENDING' && !partialMatch && amount > 0);

      if (partialMatch) {
        const paid = parseFloat(partialMatch[1]);
        const due = parseFloat(partialMatch[3]);
        const partialMethod = partialMatch[2].toUpperCase();
        const pMethod = paymentBreakdownMap.get(partialMethod) || { amount: 0, count: 0 };
        pMethod.amount += paid; pMethod.count += 1;
        paymentBreakdownMap.set(partialMethod, pMethod);
        const loanMethod = paymentBreakdownMap.get('LOAN') || { amount: 0, count: 0 };
        loanMethod.amount += due; loanMethod.count += 1;
        paymentBreakdownMap.set('LOAN', loanMethod);
      } else if (isLoan) {
        const m = paymentBreakdownMap.get('LOAN') || { amount: 0, count: 0 };
        m.amount += amount; m.count += 1;
        paymentBreakdownMap.set('LOAN', m);
      } else {
        const m = paymentBreakdownMap.get(method) || { amount: 0, count: 0 };
        m.amount += amount; m.count += 1;
        paymentBreakdownMap.set(method, m);
      }
    });

    const salesByPaymentMethod = Array.from(paymentBreakdownMap.entries()).map(([method, data]) => ({
      method, amount: data.amount, count: data.count
    }));

    // Highest Balance Customers — computed live from ledger entries every request.
    // No pre-filter on currentBalance: manual payments in the ledger UI are reflected instantly.
    // Walk-in customers are excluded (they always pay cash, never have dues).
    const customers = await prisma.customer.findMany({
      where: {
        isActive: true,
        name: { not: { startsWith: 'Walk-in' } },
        ...whereClause
      },
      include: {
        shop: { select: { name: true } },
        ledgerEntries: {
          where: { isActive: true },
          select: { amount: true, type: true }
        }
      }
    });

    const highestBalanceCustomersData = customers
      .map(c => {
        // Correct balance formula:
        // - sale_payment with positive amount = purchase/debit (customer owes)
        // - sale_payment with negative amount = auto payment entry (customer paid via sales route)
        // - loan_clearing with positive amount = manual payment via ledger UI (subtract!)
        let realBalance = 0;
        for (const entry of c.ledgerEntries) {
          const amount = Number(entry.amount);
          if (entry.type === 'loan_clearing' || entry.type === 'item_return') {
            // Manual payments/credits stored as positive — always subtract
            realBalance -= amount;
          } else {
            // sale_payment: positive = debit (adds), negative = credit (subtracts naturally)
            realBalance += amount;
          }
        }
        const computedBalance = c.ledgerEntries.length === 0
          ? Number(c.currentBalance)
          : Math.max(0, realBalance);
        return {
          id: Number(c.id), name: c.name, phone: c.phone, balance: computedBalance, shopName: c.shop.name
        };
      })
      .filter(c => c.balance > 0)
      .sort((a, b) => b.balance - a.balance);

    // Get recent activity logs
    const recentActivity = await prisma.activityLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { user: { select: { name: true, email: true } } }
    });

    const rawExpenses = Number(totalExpenses._sum.amount || 0);
    const salaryExpenseObj = expensesByCategory.find(e => e.category === 'SALARY');
    const salaryExpenses = Number(salaryExpenseObj?._sum?.amount || 0);
    const shopExpenses = Math.max(0, rawExpenses - salaryExpenses);
    const employeePayments = salaryExpenses;
    const supplierPaymentsAmt = Number(totalSupplierPayments._sum.amount || 0);

    const totalAllExpenses = rawExpenses + supplierPaymentsAmt;
    const totalRevenueValue = Number(totalRevenueObj._sum.finalAmount || 0);

    // Net Profit = Revenue − Cost Price (COGS) − Shop Expenses − Salary
    // supplierPaymentsAmt = payments made to suppliers for purchasing stock = COGS proxy
    // rawExpenses = shop running costs + salary (employee payments)
    const cogs = supplierPaymentsAmt;
    const netProfit = totalRevenueValue - cogs - rawExpenses;

    // Total cost basis = COGS + all operating expenses
    const totalCostBasis = cogs + rawExpenses;
    const roi = totalCostBasis > 0 ? (netProfit / totalCostBasis) * 100 : 0;
    const ros = totalRevenueValue > 0 ? (netProfit / totalRevenueValue) * 100 : 0;
    const grossMargin = totalRevenueValue > 0 ? (netProfit / totalRevenueValue) * 100 : 0;


    // Format the response data
    const analyticsData = {
      totalRevenue: totalRevenueValue,
      totalSales,
      totalProducts,
      totalCustomers,
      totalEmployees,
      totalSuppliers,
      totalExpenses: shopExpenses,
      totalSupplierPayments: supplierPaymentsAmt,
      totalEmployeePayments: employeePayments,
      totalAllExpenses,
      netProfit,
      roi: Number(roi.toFixed(2)),
      ros: Number(ros.toFixed(2)),
      grossMargin: Number(grossMargin.toFixed(2)),
      shops: shops.map(shop => ({ id: Number(shop.id), name: shop.name, location: shop.location })),
      salesByMonth,
      expensesByMonth,
      expensesByCategory: expensesByCategory.map(exp => ({
        category: exp.category, amount: Number(exp._sum.amount || 0)
      })),
      topProducts: await Promise.all(topProducts.map(async (product) => {
        const p = await prisma.product.findUnique({
          where: { id: product.productId }, select: { name: true, sku: true }
        });
        return {
          id: Number(product.productId), name: p?.name || 'Unknown', sku: p?.sku || 'N/A',
          quantity: Number(product._sum.quantity || 0), revenue: Number(product._sum.totalPrice || 0)
        };
      })),
      topShops: await Promise.all(topShopsArr.map(async ([shopId, data]) => {
        const s = await prisma.shop.findUnique({ where: { id: BigInt(shopId) }, select: { name: true, location: true } });
        return { id: Number(shopId), name: s?.name || 'Unknown', location: s?.location || 'N/A', revenue: data.revenue, sales: data.sales };
      })),
      revenueByShop: shops.map(shop => {
        const rev = totalRevenueObj._sum.finalAmount ? Number(totalRevenueObj._sum.finalAmount) : 0; // Simplified for user analytics
        return { id: Number(shop.id), name: shop.name, location: shop.location, revenue: rev, sales: totalSales };
      }),
      salesByPaymentMethod,
      highestBalanceCustomers: highestBalanceCustomersData,
      totalCustomerBalance: highestBalanceCustomersData.reduce((sum, c) => sum + c.balance, 0),
      recentActivity: recentActivity.map(log => ({
        id: Number(log.id), action: log.action, resource: log.resource, details: log.details, createdAt: log.createdAt, user: log.user
      }))
    };

    return new NextResponse(serializeBigInt({ success: true, data: analyticsData }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('User analytics error:', error);
    return NextResponse.json({ success: false, message: 'Failed to fetch analytics data' }, { status: 500 });
  }
}
