import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { validateToken } from '@/app/lib/tokenUtils';

const prisma = new PrismaClient();

// Virtual shop ID for "All shops" analytics view
const ALL_SHOPS_ID = -1

// GET - Get system-wide statistics for SUPER_DUPER_ADMIN
export async function GET(req: NextRequest) {
  try {
    console.log('🔍 System Analytics API called');
    let decoded: any = null;

    // Check if this is a NextAuth.js request (has cookies)
    const cookies = req.headers.get('cookie');
    if (cookies && cookies.includes('next-auth.session-token')) {
      // Handle NextAuth.js session
      const { getServerSession } = await import('next-auth');
      const { authOptions } = await import('@/lib/auth');
      const session = await getServerSession(authOptions);

      if (!session) {
        return NextResponse.json({ success: false, message: 'No active session' }, { status: 401 });
      }

      // Get user from database
      const user = await prisma.user.findUnique({
        where: { email: session.user?.email || '' },
        select: { id: true, role: true }
      });

      if (!user) {
        return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
      }

      decoded = {
        userId: user.id,
        role: user.role,
        email: session.user?.email
      };
    } else {
      // Handle custom JWT Bearer token
      const authHeader = req.headers.get('authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return NextResponse.json({ success: false, message: 'Access token required' }, { status: 401 });
      }
      const token = authHeader.substring(7);
      decoded = await validateToken(token);
      if (!decoded) {
        console.log('❌ Invalid token');
        return NextResponse.json({ success: false, message: 'Invalid or expired token' }, { status: 401 });
      }
    }

    console.log('✅ Token validated for user:', decoded.email, 'role:', decoded.role);

    // Only SUPER_DUPER_ADMIN and SUPER_ADMIN can access system-wide analytics
    if (decoded.role !== 'SUPER_DUPER_ADMIN' && decoded.role !== 'SUPER_ADMIN') {
      console.log('❌ Insufficient permissions for role:', decoded.role);
      return NextResponse.json({ success: false, message: 'Insufficient permissions' }, { status: 403 });
    }

    console.log('✅ Access granted for role:', decoded.role, 'fetching analytics data...');

    const { searchParams } = new URL(req.url);
    const shopIdParam = searchParams.get('shopId');
    const days = parseInt(searchParams.get('days') || '30');
    const fromParam = searchParams.get('from');
    const toParam = searchParams.get('to');
    const shopId = shopIdParam ? parseInt(shopIdParam) : null;

    console.log('🏪 Shop filter:', shopId ? `Shop ID: ${shopId}` : 'All shops');
    console.log('📅 Date range:', fromParam && toParam ? `${fromParam} → ${toParam}` : `${days} days`);
    console.log('👤 Current user ID:', decoded.userId);

    // Calculate date range — prefer explicit from/to over days
    const endDate = new Date();
    const startDate = new Date();

    if (fromParam && toParam) {
      // Custom date range: from start of fromParam day to end of toParam day
      const from = new Date(fromParam);
      const to = new Date(toParam);
      startDate.setFullYear(from.getFullYear(), from.getMonth(), from.getDate());
      startDate.setHours(0, 0, 0, 0);
      endDate.setFullYear(to.getFullYear(), to.getMonth(), to.getDate());
      endDate.setHours(23, 59, 59, 999);
    } else if (days === 1) {
      // For "today", set to start and end of current calendar day
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
    } else {
      // For other ranges, use rolling period from now
      startDate.setDate(endDate.getDate() - days);
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
    }

    // Helper function to build shop filter for entities (sales, products, etc.)
    const getShopFilter = async () => {
      if (shopId && shopId !== ALL_SHOPS_ID) {
        // For SUPER_DUPER_ADMIN: Verify the specific shop was created by this user
        if (decoded.role === 'SUPER_DUPER_ADMIN') {
          const shop = await prisma.shop.findFirst({
            where: {
              id: BigInt(shopId),
              createdBy: BigInt(decoded.userId),
              isActive: true
            }
          });
          if (!shop) return { id: { in: [] } };
        }
        return { shopId };
      } else {
        // For SUPER_DUPER_ADMIN: Get all shops created by this user
        // For SUPER_ADMIN: Get all active shops
        if (decoded.role === 'SUPER_DUPER_ADMIN') {
          const userShops = await prisma.shop.findMany({
            where: {
              createdBy: BigInt(decoded.userId),
              isActive: true
            },
            select: { id: true }
          });
          return {
            shopId: { in: userShops.map(shop => shop.id) }
          };
        } else {
          // SUPER_ADMIN can see shops they are assigned to
          console.log('🔍 SUPER_ADMIN: Getting assigned shops...');
          console.log('🔍 SUPER_ADMIN userId:', decoded.userId);

          // Get shop assignments for this SUPER_ADMIN
          const assignments = await prisma.userShopAssignment.findMany({
            where: {
              userId: BigInt(decoded.userId),
              active: true
            },
            include: {
              shop: {
                select: { id: true, name: true, isActive: true }
              }
            }
          });

          console.log('🔍 SUPER_ADMIN assignments:', {
            userId: decoded.userId,
            assignmentCount: assignments.length,
            assignments: assignments.map(a => ({
              shopId: a.shop.id,
              shopName: a.shop.name,
              isActive: a.shop.isActive
            }))
          });

          // Filter to only active shops
          const activeShops = assignments
            .filter(assignment => assignment.shop.isActive)
            .map(assignment => assignment.shop.id);

          console.log('🔍 Active shops for SUPER_ADMIN:', activeShops);

          if (activeShops.length === 0) {
            console.log('⚠️ No active shops found for SUPER_ADMIN, returning empty filter');
            return { shopId: { in: [] } };
          }

          return {
            shopId: { in: activeShops }
          };
        }
      }
    };

    const shopFilter = await getShopFilter();
    console.log('🔍 Shop filter applied:', shopFilter);
    console.log('🔍 Shop filter keys:', Object.keys(shopFilter));
    // Convert BigInt values to strings for logging
    const shopFilterForLogging = JSON.parse(JSON.stringify(shopFilter, (key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    ));
    console.log('🔍 Shop filter values:', JSON.stringify(shopFilterForLogging, null, 2));

    // Check if shop filter is empty (no assigned shops)
    if (shopFilter.shopId && typeof shopFilter.shopId === 'object' && 'in' in shopFilter.shopId && Array.isArray(shopFilter.shopId.in) && shopFilter.shopId.in.length === 0) {
      console.log('⚠️ WARNING: No shops assigned to this user. All queries will return 0 results.');
    }

    // Helper function to get authorized users for this tenant
    const getTenantUserIds = async () => {
      let allowedUserIds = new Set<bigint>();
      allowedUserIds.add(BigInt(decoded.userId));

      if (decoded.role === 'SUPER_DUPER_ADMIN') {
        const users = await prisma.user.findMany({
          where: { createdBy: BigInt(decoded.userId) },
          select: { id: true }
        });
        users.forEach(u => allowedUserIds.add(u.id));

        const shops = await prisma.shop.findMany({
          where: { createdBy: BigInt(decoded.userId) },
          select: { id: true }
        });
        if (shops.length > 0) {
          const assignments = await prisma.userShopAssignment.findMany({
            where: { shopId: { in: shops.map(s => s.id) } },
            select: { userId: true }
          });
          assignments.forEach(a => allowedUserIds.add(a.userId));
        }
      } else {
        const assignments = await prisma.userShopAssignment.findMany({
          where: { userId: BigInt(decoded.userId), active: true },
          select: { shopId: true }
        });
        const shopIds = assignments.map(a => a.shopId);

        if (shopIds.length > 0) {
          const userAssignments = await prisma.userShopAssignment.findMany({
            where: { shopId: { in: shopIds }, active: true },
            select: { userId: true }
          });
          userAssignments.forEach(a => allowedUserIds.add(a.userId));

          const shops = await prisma.shop.findMany({
            where: { id: { in: shopIds } },
            select: { createdBy: true }
          });
          shops.forEach(s => {
            if (s.createdBy) allowedUserIds.add(s.createdBy);
          });
        }
      }
      return Array.from(allowedUserIds);
    };

    // Helper function to get activity logs
    const getActivityLogs = async () => {
      const allowedUserIds = await getTenantUserIds();

      const activityLogs = await prisma.activityLog.findMany({
        where: {
          userId: { in: allowedUserIds }
        },
        take: 50,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { name: true, email: true }
          }
        }
      });

      console.log('🔍 [System Analytics] Activity logs fetched:', activityLogs.length, 'logs');
      return activityLogs;
    };

    // Helper function to get login logs
    const getLoginLogs = async () => {
      const allowedUserIds = await getTenantUserIds();

      const loginLogs = await prisma.loginLog.findMany({
        where: {
          userId: { in: allowedUserIds }
        },
        take: 50,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { name: true, email: true }
          }
        }
      });

      console.log('🔍 [System Analytics] Login logs fetched:', loginLogs.length, 'logs');
      return loginLogs;
    };

    // Get system-wide statistics
    const [
      totalShops,
      activeShops,
      totalUsers,
      totalGeneralSales,
      totalGeneralRevenue,
      totalProducts,
      totalCustomers,
      totalEmployees,
      totalSuppliers,
      totalExpenses,
      totalEmployeePayments,
      totalSupplierPayments,
      recentActivityLogs,
      recentLoginLogs,
      businessMetrics,
      inventoryAnalytics,
      businessGoals,
      totalTmtSales,
      totalTmtRevenue
    ] = await Promise.all([
      // Total shops - only count shops created by this SUPER_DUPER_ADMIN
      shopId && shopId !== ALL_SHOPS_ID ? 1 : prisma.shop.count({
        where: {
          isActive: true,
          createdBy: decoded.userId
        }
      }),

      // Active shops - only count shops created by this SUPER_DUPER_ADMIN
      shopId && shopId !== ALL_SHOPS_ID ? 1 : prisma.shop.count({
        where: {
          isActive: true,
          createdBy: decoded.userId
        }
      }),

      // Total users - only count users created by this SUPER_DUPER_ADMIN
      prisma.user.count({
        where: {
          isActive: true,
          createdBy: decoded.userId
        }
      }),

      // Total sales
      prisma.sale.count({
        where: {
          isActive: true,
          paymentStatus: { not: 'CANCELLED' },
          saleDate: {
            gte: startDate,
            lte: endDate
          },
          ...shopFilter
        }
      }),

      // Total revenue
      prisma.sale.aggregate({
        where: {
          isActive: true,
          paymentStatus: { not: 'CANCELLED' },
          saleDate: {
            gte: startDate,
            lte: endDate
          },
          ...shopFilter
        },
        _sum: { finalAmount: true }
      }),

      // Total products
      prisma.product.count({
        where: {
          isActive: true,
          ...shopFilter
        }
      }),

      // Total customers
      prisma.customer.count({
        where: {
          isActive: true,
          ...shopFilter
        }
      }),

      // Total employees
      prisma.employee.count({
        where: {
          isActive: true,
          ...shopFilter
        }
      }),

      // Total suppliers
      prisma.supplier.count({
        where: {
          isActive: true,
          ...shopFilter
        }
      }),

      // Total expenses
      prisma.expense.aggregate({
        where: {
          isActive: true,
          date: {
            gte: startDate,
            lte: endDate
          },
          ...shopFilter
        },
        _sum: { amount: true }
      }),

      // Total employee payments
      prisma.employeePayment.aggregate({
        where: {
          isActive: true,
          paymentDate: {
            gte: startDate,
            lte: endDate
          },
          ...shopFilter
        },
        _sum: { amount: true }
      }),

      // Total supplier payments
      prisma.supplierPayment.aggregate({
        where: {
          isActive: true,
          paymentDate: {
            gte: startDate,
            lte: endDate
          },
          ...shopFilter
        },
        _sum: { amount: true }
      }),

      // Recent activity logs (last 50) - only from shops created by this SUPER_DUPER_ADMIN
      getActivityLogs(),

      // Recent login logs (last 50) - only from users assigned to shops created by this SUPER_DUPER_ADMIN
      getLoginLogs(),

      // Business Metrics - Historical ROI, ROS, Gross Margin
      prisma.businessMetric.findMany({
        where: {
          recordedAt: {
            gte: startDate,
            lte: endDate
          },
          ...shopFilter
        },
        orderBy: { recordedAt: 'desc' },
        take: 100,
        include: {
          shop: {
            select: { name: true }
          }
        }
      }),

      // Inventory Analytics
      prisma.inventoryAnalytics.findMany({
        where: {
          recordedAt: {
            gte: startDate,
            lte: endDate
          },
          ...shopFilter
        },
        orderBy: { recordedAt: 'desc' },
        take: 100,
        include: {
          shop: {
            select: { name: true }
          },
          product: {
            select: { name: true }
          }
        }
      }),

      // Business Goals
      prisma.businessGoal.findMany({
        where: {
          ...shopFilter
        },
        include: {
          shop: {
            select: { name: true }
          }
        }
      }),
      
      // Total TMT sales
      prisma.tmtSale.count({
        where: {
          isActive: true,
          status: { not: 'CANCELLED' },
          saleDate: {
            gte: startDate,
            lte: endDate
          },
          ...shopFilter
        }
      }),

      // Total TMT revenue
      prisma.tmtSale.aggregate({
        where: {
          isActive: true,
          status: { not: 'CANCELLED' },
          saleDate: {
            gte: startDate,
            lte: endDate
          },
          ...shopFilter
        },
        _sum: { totalAmount: true }
      })
    ]);
    
    // Combine totals
    const totalSales = Number(totalGeneralSales) + Number(totalTmtSales);
    const totalRevenueObj = {
      _sum: {
        finalAmount: (Number(totalGeneralRevenue._sum.finalAmount || 0) + Number(totalTmtRevenue._sum.totalAmount || 0))
      }
    };

    // Get shops with their statistics (only shops created by this SUPER_DUPER_ADMIN)
    // Get shops with their statistics based on role isolation
    let shopsWhereClause: any = {
      isActive: true,
      ...(shopId && shopId !== ALL_SHOPS_ID && { id: shopId })
    };

    if (decoded.role === 'SUPER_DUPER_ADMIN') {
      // SUPER_DUPER_ADMIN sees only their own shops
      shopsWhereClause.createdBy = BigInt(decoded.userId);
    } else {
      // SUPER_ADMIN sees shops they are assigned to
      const assignments = await prisma.userShopAssignment.findMany({
        where: {
          userId: BigInt(decoded.userId),
          active: true
        },
        include: {
          shop: {
            select: { id: true, isActive: true }
          }
        }
      });

      const activeShopIds = assignments
        .filter(assignment => assignment.shop.isActive)
        .map(assignment => assignment.shop.id);

      if (activeShopIds.length > 0) {
        shopsWhereClause.id = { in: activeShopIds };
      } else {
        // If no shops assigned, return empty
        shopsWhereClause.id = { in: [] };
      }
    }

    const shopsWithStats = await prisma.shop.findMany({
      where: shopsWhereClause,
      select: {
        id: true,
        name: true,
        location: true,
        isActive: true,
        createdAt: true,
        _count: {
          select: {
            products: true,
            sales: true,
            customers: true,
            employees: true,
            userAssignments: {
              where: { active: true }
            }
          }
        }
      }
    });

    // Build safe shopId filter for related entities (sales, payments)
    const allowedShopIds = shopsWithStats.map((s) => Number(s.id));

    console.log('🔍 [System Analytics] Fetching raw data for in-memory aggregations...');
    const [sales, tmtSales, expenses, saleItems, tmtSaleItems] = await Promise.all([
      prisma.sale.findMany({
        where: {
          isActive: true,
          saleDate: { gte: startDate, lte: endDate },
          ...(allowedShopIds.length > 0 ? { shopId: { in: allowedShopIds as any } } : { shopId: { in: [] as any } })
        },
        select: { shopId: true, saleDate: true, finalAmount: true, paymentMethod: true, paymentStatus: true, notes: true }
      }),
      prisma.tmtSale.findMany({
        where: {
          isActive: true,
          saleDate: { gte: startDate, lte: endDate },
          ...(allowedShopIds.length > 0 ? { shopId: { in: allowedShopIds as any } } : { shopId: { in: [] as any } })
        },
        select: { shopId: true, saleDate: true, totalAmount: true, paymentMethod: true, paymentStatus: true, notes: true }
      }),
      prisma.expense.findMany({
        where: {
          isActive: true,
          date: { gte: startDate, lte: endDate },
          ...shopFilter
        },
        select: { amount: true, date: true, category: true }
      }),
      prisma.saleItem.findMany({
        where: {
          sale: {
            isActive: true,
            saleDate: { gte: startDate, lte: endDate },
            ...(allowedShopIds.length > 0 ? { shopId: { in: allowedShopIds as any } } : { shopId: { in: [] as any } })
          }
        },
        select: {
          saleId: true,
          productId: true,
          quantity: true,
          conversionCft: true,
          unitName: true,
          product: { select: { costPrice: true } }
        }
      }),
      prisma.tmtSaleItem.findMany({
        where: {
          sale: {
            isActive: true,
            saleDate: { gte: startDate, lte: endDate },
            ...(allowedShopIds.length > 0 ? { shopId: { in: allowedShopIds as any } } : { shopId: { in: [] as any } })
          }
        },
        include: {
          sale: { select: { shopId: true } },
          product: { select: { inventory: { select: { costPricePerKg: true, shopId: true } } } }
        }
      })
    ]);

    const combinedSales = [
      ...sales.map(s => ({ ...s, amount: Number(s.finalAmount || 0) })),
      ...tmtSales.map(ts => ({ ...ts, amount: Number(ts.totalAmount || 0) }))
    ];

    // 1. Revenue & Top Shops (grouped by shopId)
    const shopRevenueMap = new Map<number, { revenue: number; sales: number }>();
    combinedSales.forEach(item => {
      const id = Number(item.shopId);
      const val = shopRevenueMap.get(id) || { revenue: 0, sales: 0 };
      val.revenue += item.amount;
      val.sales += 1;
      shopRevenueMap.set(id, val);
    });

    const shopRevenueData = await Promise.all(
      Array.from(shopRevenueMap.entries()).map(async ([shopId, data]) => {
        const shop = await prisma.shop.findUnique({
          where: { id: BigInt(shopId) },
          select: { name: true, location: true }
        });
        return {
          shopId,
          shopName: shop?.name || 'Unknown Shop',
          shopLocation: shop?.location || '',
          amount: data.revenue,
          revenue: data.revenue,
          sales: data.sales
        };
      })
    );

    let topShopsData: Array<{ name: string; revenue: number; sales: number; customers: number }> = [];
    try {
      const allShopsData = await Promise.all(
        Array.from(shopRevenueMap.entries()).map(async ([shopId, data]) => {
          const shop = await prisma.shop.findUnique({
            where: { id: BigInt(shopId) },
            select: { name: true }
          });
          const customerCount = await prisma.customer.count({
            where: { shopId: BigInt(shopId), isActive: true }
          });
          return {
            name: shop?.name || 'Unknown Shop',
            revenue: data.revenue,
            sales: data.sales,
            customers: customerCount
          };
        })
      );
      topShopsData = allShopsData.sort((a, b) => b.revenue - a.revenue).slice(0, 10);
    } catch (error) {
      console.error('❌ [System Analytics] Top shops data processing error:', error);
    }

    // 2. Payment Method Breakdown
    const breakdownMap = new Map<string, { amount: number, count: number }>();
    combinedSales.forEach(sale => {
      const amount = sale.amount;
      let method = sale.paymentMethod as string;
      
      const partialMatch = sale.notes?.match(/Partial Payment: ₹(\d+(?:\.\d+)?) via (\w+), Due: ₹(\d+(?:\.\d+)?)/);
      const isLoan = sale.notes?.includes('Loan/Credit Sale') || (sale.paymentStatus === 'PENDING' && !partialMatch && amount > 0);

      if (partialMatch) {
        const paid = parseFloat(partialMatch[1]);
        const due = parseFloat(partialMatch[3]);
        const partialMethod = partialMatch[2].toUpperCase();
        
        const pMethod = breakdownMap.get(partialMethod) || { amount: 0, count: 0 };
        pMethod.amount += paid; pMethod.count += 1; breakdownMap.set(partialMethod, pMethod);
        
        const loanMethod = breakdownMap.get('LOAN') || { amount: 0, count: 0 };
        loanMethod.amount += due; loanMethod.count += 1; breakdownMap.set('LOAN', loanMethod);
      } else if (isLoan) {
        const m = breakdownMap.get('LOAN') || { amount: 0, count: 0 };
        m.amount += amount; m.count += 1; breakdownMap.set('LOAN', m);
      } else {
        const m = breakdownMap.get(method) || { amount: 0, count: 0 };
        m.amount += amount; m.count += 1; breakdownMap.set(method, m);
      }
    });

    const paymentMethodData = Array.from(breakdownMap.entries()).map(([method, data]) => ({
      method, amount: data.amount, count: data.count
    }));

    // 3. Sales & Expenses — adaptive granularity based on date range
    // Use actual date-range span so custom ranges show the right buckets
    const effectiveDays = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));

    type ChartBucket = { label: string; salesCount: number; revenue: number; expenses: number };
    let chartBuckets: ChartBucket[] = [];

    if (effectiveDays <= 31) {
      // ── Daily grouping ──────────────────────────────────────────────
      for (let i = 0; i < effectiveDays; i++) {
        const dayStart = new Date(startDate);
        dayStart.setDate(startDate.getDate() + i);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(dayStart);
        dayEnd.setHours(23, 59, 59, 999);

        const dSales = combinedSales.filter(s => { const d = new Date(s.saleDate); return d >= dayStart && d <= dayEnd; });
        const dExp   = expenses.filter(e   => { const d = new Date(e.date);    return d >= dayStart && d <= dayEnd; });

        chartBuckets.push({
          label: dayStart.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
          salesCount: dSales.length,
          revenue: dSales.reduce((s, x) => s + x.amount, 0),
          expenses: dExp.reduce((s, e) => s + Number(e.amount), 0)
        });
      }
    } else if (effectiveDays <= 90) {
      // ── Weekly grouping ─────────────────────────────────────────────
      const weekCount = Math.ceil(effectiveDays / 7);
      for (let w = 0; w < weekCount; w++) {
        const wStart = new Date(startDate);
        wStart.setDate(startDate.getDate() + w * 7);
        wStart.setHours(0, 0, 0, 0);
        const wEnd = new Date(wStart);
        wEnd.setDate(wStart.getDate() + 6);
        wEnd.setHours(23, 59, 59, 999);

        const wSales = combinedSales.filter(s => { const d = new Date(s.saleDate); return d >= wStart && d <= wEnd; });
        const wExp   = expenses.filter(e   => { const d = new Date(e.date);    return d >= wStart && d <= wEnd; });

        chartBuckets.push({
          label: `${wStart.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`,
          salesCount: wSales.length,
          revenue: wSales.reduce((s, x) => s + x.amount, 0),
          expenses: wExp.reduce((s, e) => s + Number(e.amount), 0)
        });
      }
    } else {
      // ── Monthly grouping ────────────────────────────────────────────
      const numMonths = Math.min(Math.max(1, Math.ceil(effectiveDays / 30)), 12);
      const anchor = new Date(endDate);
      for (let i = numMonths - 1; i >= 0; i--) {
        const targetYear  = anchor.getFullYear();
        const targetMonth = anchor.getMonth() - i;
        const mStart = new Date(targetYear, targetMonth, 1, 0, 0, 0, 0);
        const mEnd   = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59, 999);

        const mSales = combinedSales.filter(s => { const d = new Date(s.saleDate); return d >= mStart && d <= mEnd; });
        const mExp   = expenses.filter(e   => { const d = new Date(e.date);    return d >= mStart && d <= mEnd; });

        chartBuckets.push({
          label: mStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
          salesCount: mSales.length,
          revenue: mSales.reduce((s, x) => s + x.amount, 0),
          expenses: mExp.reduce((s, e) => s + Number(e.amount), 0)
        });
      }
    }

    const salesByMonth   = chartBuckets.map(b => ({ month: b.label, sales: b.salesCount, revenue: b.revenue }));
    const expensesByMonth = chartBuckets.map(b => ({ month: b.label, expenses: b.expenses }));

    // 4. Expenses by Category
    const expCategoryMap = new Map<string, number>();
    expenses.forEach(e => {
      const cat = e.category || 'OTHER';
      const amt = Number(e.amount);
      expCategoryMap.set(cat, (expCategoryMap.get(cat) || 0) + amt);
    });
    const expensesByCategory = Array.from(expCategoryMap.entries())
      .map(([category, amount]) => ({ category, _sum: { amount } }))
      .sort((a, b) => b._sum.amount - a._sum.amount);

    // 5. Top Products (requires join, keeping query isolated)
    let topProductsData: Array<{ name: string; sales: number; revenue: number }> = [];
    try {
      const topProducts = await prisma.saleItem.groupBy({
        by: ['productId'],
        where: { sale: { isActive: true, ...shopFilter } },
        _sum: { totalPrice: true },
        _count: { id: true },
        orderBy: { _sum: { totalPrice: 'desc' } },
        take: 10
      });

      topProductsData = await Promise.all(
        topProducts.map(async (item) => {
          const product = await prisma.product.findUnique({
            where: { id: item.productId },
            select: { name: true }
          });
          return {
            name: product?.name || 'Unknown Product',
            sales: item._count.id || 0,
            revenue: Number(item._sum.totalPrice || 0)
          };
        })
      );
    } catch (error) {
      console.error('❌ [System Analytics] Top products error:', error);
    }

    // Highest Balance Customers - compute real balance dynamically from ledger entries
    let highestBalanceCustomersData: Array<{ id: number; name: string; phone: string | null; balance: number; shopName: string }> = [];
    let totalCustomerBalance = 0;
    try {
      // Highest Balance Customers — computed live from ledger entries every request.
      // No pre-filter on currentBalance: manual payments in the ledger UI are reflected instantly.
      // Walk-in customers are excluded (they always pay cash, never have dues).
      const customers = await prisma.customer.findMany({
        where: {
          isActive: true,
          name: { not: { startsWith: 'Walk-in' } },
          ...shopFilter
        },
        include: {
          shop: { select: { name: true } },
          ledgerEntries: {
            where: { isActive: true },
            select: { amount: true, type: true }
          }
        }
      });

      highestBalanceCustomersData = customers
        .map(c => {
          // Correct balance formula:
          // - sale_payment with positive amount = purchase/debit (customer owes)
          // - sale_payment with negative amount = auto payment entry (customer paid via sales route)
          // - loan_clearing with positive amount = manual payment via ledger UI (always subtract)
          let realBalance = 0;
          for (const entry of c.ledgerEntries) {
            const amount = Number(entry.amount);
            if (entry.type === 'loan_clearing' || entry.type === 'item_return') {
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
            id: Number(c.id),
            name: c.name,
            phone: c.phone,
            balance: computedBalance,
            shopName: c.shop.name
          };
        })
        .filter(c => c.balance > 0)
        .sort((a, b) => b.balance - a.balance);
      
      // Calculate total balance for all customers fetched
      totalCustomerBalance = highestBalanceCustomersData.reduce((sum, c) => sum + c.balance, 0);
      
      console.log('✅ [System Analytics] Highest balance customers and total balance fetched successfully');
    } catch (error) {
      console.error('❌ [System Analytics] Highest balance customers error:', error);
      highestBalanceCustomersData = [];
    }

// Helper function to safely serialize BigInt values for JSON response
function serializeBigInt(obj: any): string {
  return JSON.stringify(obj, (key, value) =>
    typeof value === 'bigint' ? value.toString() : value
  );
}

    // We also need to map individual sales if they are ever needed in system analytics
    // (currently it seems to focus on aggregates, but let's ensure the logic is there or robust)
    const revenue = Number(totalRevenueObj._sum.finalAmount || 0);
    
    // Extract salary specifically from the Expense table grouping
    const salaryExpenseObj = expensesByCategory.find(e => e.category === 'SALARY');
    const salaryExpenses = Number(salaryExpenseObj?._sum?.amount || 0);
    
    // Total raw expenses from Expense table (includes SALARY)
    const rawExpenses = Number(totalExpenses._sum.amount || 0);
    
    // "Shop" expenses = all expenses EXCEPT salary
    const shopExpenses = Math.max(0, rawExpenses - salaryExpenses);
    
    // employeePayments for the UI metric card should use the accurate salaryExpenses 
    // to include both auto-generated and manual salary records
    const employeePayments = salaryExpenses;
    
    const supplierPayments = Number(totalSupplierPayments._sum.amount || 0);
    
    // Total = Shop (raw - salary) + Salary + Supplier 
    // Which simplifies to: rawExpenses + supplierPayments
    const totalAllExpenses = rawExpenses + supplierPayments;
    // Fetch latest stock entries for products sold today to determine true cost per CFT for bulk items
    const productIds = Array.from(new Set(saleItems.map(item => Number(item.productId))));
    const latestStockEntries = await prisma.stockEntry.findMany({
      where: {
        productId: { in: productIds }
      },
      orderBy: { entryDate: 'desc' },
      select: { productId: true, unitPrice: true, conversionCft: true, unitName: true }
    });

    // Fetch all stock entries that were auto-created from direct sales to use their exact purchase price as cost
    const directSaleStockEntries = await prisma.stockEntry.findMany({
      where: {
        notes: {
          startsWith: 'Auto-created from Direct Sale #'
        },
        isActive: true
      },
      select: {
        productId: true,
        unitPrice: true,
        notes: true
      }
    });

    const directSaleCostMap = new Map();
    for (const entry of directSaleStockEntries) {
      if (entry.notes) {
        const match = entry.notes.match(/Auto-created from Direct Sale #(\d+)/);
        if (match) {
          const saleId = match[1];
          const key = `${saleId}_${entry.productId}`;
          directSaleCostMap.set(key, Number(entry.unitPrice));
        }
      }
    }

    // Map to store calculated true cost per base unit (e.g. per CFT)
    const trueCostPriceMap = new Map();
    // Map to store latest unit price for specific unit names
    const unitCostPriceMap = new Map();

    for (const entry of latestStockEntries) {
      const productId = Number(entry.productId);
      
      // 1. Build trueCostPriceMap for CFT conversions (if conversionCft is set)
      if (entry.conversionCft !== null && !trueCostPriceMap.has(productId)) {
        const cft = Number(entry.conversionCft || 1);
        if (cft > 0) {
          trueCostPriceMap.set(productId, Number(entry.unitPrice) / cft);
        }
      }

      // 2. Build unitCostPriceMap for exact unit name matches
      if (entry.unitName) {
        const unitKey = `${productId}_${entry.unitName.toLowerCase().trim()}`;
        if (!unitCostPriceMap.has(unitKey)) {
          unitCostPriceMap.set(unitKey, Number(entry.unitPrice));
        }
      }
    }

    // Calculate total cost price (COGS)
    const generalCostPrice = saleItems.reduce((sum, item) => {
      let itemCogs = 0;
      const productCost = Number(item.product?.costPrice || 0);
      const saleCft = Number(item.conversionCft || 0);
      const saleQty = Number(item.quantity || 0);
      const isBulkUnit = item.unitName && [
        'cft', 'tempo', 'tractor', 'truck', 'highwa', 'dumper', 
        '407', 'chota_haathi', 'small_hiwa', 'big_hiwa'
      ].includes(item.unitName.toLowerCase());

      const unitKey = item.unitName ? `${item.productId}_${item.unitName.toLowerCase().trim()}` : '';
      const directKey = `${item.saleId.toString()}_${item.productId.toString()}`;

      if (directSaleCostMap.has(directKey)) {
        // Direct sale: use the purchase price from the auto-created StockEntry directly
        itemCogs = saleQty * directSaleCostMap.get(directKey);
      } else if (unitKey && unitCostPriceMap.has(unitKey)) {
        // If we have a stock entry with the exact same unit, use that cost price directly
        itemCogs = saleQty * unitCostPriceMap.get(unitKey);
      } else if (saleCft > 0 && isBulkUnit) {
        // Sold in fractional/bulk units (e.g. tempo = 21 CFT, highwa = 400 CFT)
        // We need the cost per 1 CFT
        const productId = Number(item.productId);
        let costPerCft = productCost; // fallback

        if (trueCostPriceMap.has(productId)) {
          costPerCft = trueCostPriceMap.get(productId);
        } else if (productCost > 5000) {
          // Heuristic: If no stock entry found but cost price is massive (>5000), it's likely a truck price.
          // Fallback to assuming a standard 400 CFT truck if we can't find the stock entry.
          costPerCft = productCost / 400; 
        }

        const totalCftSold = saleQty * saleCft;
        itemCogs = totalCftSold * costPerCft;
      } else {
        // Standard item (e.g. Cement bag, Hardware piece)
        itemCogs = saleQty * productCost;
      }

      return sum + itemCogs;
    }, 0);

    const tmtCostPrice = tmtSaleItems.reduce((sum, item) => {
      const inv = item.product?.inventory?.find(i => Number(i.shopId) === Number(item.sale?.shopId));
      const costPerKg = inv?.costPricePerKg || 0;
      const weightPerRod = Number(item.weightPerRodKg || 0);
      const rodsPerBundle = Number(item.rodsPerBundle || 0);
      const qty = Number(item.quantity || 0);
      
      let totalKg = 0;
      if (item.unitType === 'BUNDLE') totalKg = qty * rodsPerBundle * weightPerRod;
      else if (item.unitType === 'PIECE') totalKg = qty * weightPerRod;
      else if (item.unitType === 'TON') totalKg = qty * 1000;
      else totalKg = qty;

      return sum + (totalKg * Number(costPerKg));
    }, 0);

    const totalCostPrice = generalCostPrice + tmtCostPrice;
    
    // Net Profit = Revenue − Cost Price (COGS) − Expenses − Salary
    // rawExpenses already includes both shop expenses + salary (employeePayments)
    const netProfit = revenue - totalCostPrice - rawExpenses;

    // Total cost basis for ROI = COGS + all operating expenses
    const totalCostBasis = totalCostPrice + rawExpenses;

    // ROI (Return on Investment) = (Net Profit / Total Cost Basis) * 100
    const roi = totalCostBasis > 0 ? (netProfit / totalCostBasis) * 100 : 0;

    // ROS (Return on Sales) = (Net Profit / Revenue) * 100
    const ros = revenue > 0 ? (netProfit / revenue) * 100 : 0;

    // Gross Margin = Net Profit / Revenue * 100
    const grossMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;

    console.log('📊 Business Metrics calculated:', {
      revenue,
      shopExpenses,
      employeePayments,
      supplierPayments,
      totalAllExpenses,
      netProfit,
      roi: roi.toFixed(2) + '%',
      ros: ros.toFixed(2) + '%',
      grossMargin: grossMargin.toFixed(2) + '%'
    });

    const responseData = {
      success: true,
      data: {
        // System statistics
        totalShops: Number(totalShops),
        activeShops: Number(activeShops),
        totalUsers: Number(totalUsers),
        totalSales: Number(totalSales),
        totalRevenue: revenue,
        totalProducts: Number(totalProducts),
        totalCustomers: Number(totalCustomers),
        totalEmployees: Number(totalEmployees),
        totalSuppliers: Number(totalSuppliers),
        totalExpenses: shopExpenses,
        totalEmployeePayments: employeePayments,
        totalSupplierPayments: supplierPayments,
        totalAllExpenses: totalAllExpenses,
        totalCostPrice: totalCostPrice,
        netProfit: netProfit,
        roi: Number(roi.toFixed(2)),
        ros: Number(ros.toFixed(2)),
        grossMargin: Number(grossMargin.toFixed(2)),

        // Shops data
        shops: shopsWithStats.map(shop => ({
          id: Number(shop.id),
          name: shop.name,
          location: shop.location,
          isActive: shop.isActive,
          createdAt: shop.createdAt,
          totalProducts: Number(shop._count.products),
          totalSales: Number(shop._count.sales),
          totalCustomers: Number(shop._count.customers),
          totalEmployees: Number(shop._count.employees),
          assignedUsers: Number(shop._count.userAssignments)
        })),

        // Revenue breakdown
        revenueByShop: shopRevenueData,

        // Sales by month
        salesByMonth: salesByMonth,

        // Expenses by month
        expensesByMonth: expensesByMonth,

        // Expenses by category
        expensesByCategory: expensesByCategory.map(exp => ({
          category: exp.category,
          amount: Number(exp._sum.amount || 0)
        })),

        // Top products
        topProducts: topProductsData,

        // Top shops
        topShops: topShopsData,

        highestBalanceCustomers: highestBalanceCustomersData,
        totalCustomerBalance: totalCustomerBalance,

        // Payment methods
        paymentMethodBreakdown: paymentMethodData,

        // Recent activity
        activityLog: recentActivityLogs.map(log => ({
          id: Number(log.id),
          action: log.action,
          resource: log.resource,
          details: log.details,
          createdAt: log.createdAt,
          user: log.user ? {
            name: log.user.name,
            email: log.user.email
          } : null
        })),

        loginLog: recentLoginLogs.map(log => ({
          id: Number(log.id),
          success: log.success,
          failureReason: log.failureReason,
          ipAddress: log.ipAddress,
          userAgent: log.userAgent,
          createdAt: log.createdAt,
          user: log.user ? {
            name: log.user.name,
            email: log.user.email
          } : null
        })),

        // Business Metrics (Historical)
        businessMetrics: businessMetrics.map(metric => ({
          id: Number(metric.id),
          metricName: metric.metricName,
          value: Number(metric.value),
          formula: metric.formula,
          period: metric.period,
          recordedAt: metric.recordedAt,
          shopId: Number(metric.shopId),
          shopName: metric.shop.name
        })),

        // Inventory Analytics
        inventoryAnalytics: inventoryAnalytics.map(analytics => ({
          id: Number(analytics.id),
          shopId: Number(analytics.shopId),
          productId: Number(analytics.productId),
          shopName: analytics.shop.name,
          productName: analytics.product.name,
          avgStock: Number(analytics.avgStock),
          cogs: Number(analytics.cogs),
          turnoverRatio: Number(analytics.turnoverRatio),
          daysInInventory: Number(analytics.daysInInventory),
          recordedAt: analytics.recordedAt
        })),

        // Business Goals
        businessGoals: businessGoals.map(goal => ({
          id: Number(goal.id),
          metricName: goal.metricName,
          targetValue: Number(goal.targetValue),
          period: goal.period,
          achieved: goal.achieved,
          achievedAt: goal.achievedAt,
          shopId: Number(goal.shopId),
          shopName: goal.shop.name
        }))
      }
    };

    console.log('✅ System analytics data sent successfully');
    console.log('📊 Analytics data prepared:', {
      totalRevenue: Number(totalRevenueObj._sum.finalAmount || 0),
      totalSales,
      totalProducts,
      totalCustomers,
      totalEmployees,
      totalExpenses: Number(totalExpenses._sum.amount || 0),
      shopFilter: shopId ? `Shop ${shopId}` : 'All shops'
    });

    return new NextResponse(serializeBigInt(responseData), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('❌ System analytics error:', error?.message || error);
    console.error('❌ Error stack:', error?.stack);
    return NextResponse.json({
      success: false,
      message: 'Failed to fetch system analytics',
      detail: error?.message
    }, { status: 500 });
  }
} 