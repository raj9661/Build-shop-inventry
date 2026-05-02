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

    // Get shop filter from query parameters
    const { searchParams } = new URL(req.url);
    const shopIdParam = searchParams.get('shopId');
    const days = parseInt(searchParams.get('days') || '30');
    const shopId = shopIdParam ? parseInt(shopIdParam) : null;

    console.log('🏪 Shop filter:', shopId ? `Shop ID: ${shopId}` : 'All shops');
    console.log('📅 Date range:', days, 'days');
    console.log('👤 Current user ID:', decoded.userId);

    // Calculate date range
    // Special handling for "today" (days=1) - use calendar day instead of rolling 24 hours
    const endDate = new Date();
    const startDate = new Date();

    if (days === 1) {
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

    // Calculate revenue by shop for the selected range
    const generalRevenueByShop = await prisma.sale.groupBy({
      by: ['shopId'],
      where: {
        isActive: true,
        saleDate: { gte: startDate, lte: endDate },
        ...(allowedShopIds.length > 0 ? { shopId: { in: allowedShopIds as any } } : { shopId: { in: [] as any } })
      },
      _sum: { finalAmount: true },
      _count: { id: true }
    });

    const tmtRevenueByShop = await prisma.tmtSale.groupBy({
      by: ['shopId'],
      where: {
        isActive: true,
        saleDate: { gte: startDate, lte: endDate },
        ...(allowedShopIds.length > 0 ? { shopId: { in: allowedShopIds as any } } : { shopId: { in: [] as any } })
      },
      _sum: { totalAmount: true },
      _count: { id: true }
    });

    // Merge both revenue streams by shopId
    const shopRevenueMap = new Map<number, { amount: number; count: number }>();
    
    generalRevenueByShop.forEach(item => {
      const id = Number(item.shopId);
      const val = shopRevenueMap.get(id) || { amount: 0, count: 0 };
      val.amount += item._sum?.finalAmount ? parseFloat((item._sum.finalAmount as any).toString()) : 0;
      val.count += item._count.id;
      shopRevenueMap.set(id, val);
    });

    tmtRevenueByShop.forEach(item => {
      const id = Number(item.shopId);
      const val = shopRevenueMap.get(id) || { amount: 0, count: 0 };
      val.amount += item._sum?.totalAmount ? parseFloat((item._sum.totalAmount as any).toString()) : 0;
      val.count += item._count.id;
      shopRevenueMap.set(id, val);
    });

    // Get shop names for revenue breakdown
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
          amount: data.amount,
          revenue: data.amount,
          sales: data.count
        };
      })
    );

    // Payment method breakdown across accessible shops (based on sales)
    let paymentMethodData: Array<{ method: string; amount: number; count: number }> = [];
    try {
      console.log('🔍 [System Analytics] Fetching payment breakdown from sales...');
      console.log('🔍 Date range for payment breakdown:', { startDate, endDate, days });
      const [sales, tmtSales] = await Promise.all([
        prisma.sale.findMany({
          where: {
            isActive: true,
            saleDate: {
              gte: startDate,
              lte: endDate
            },
            ...(allowedShopIds.length > 0 ? { shopId: { in: allowedShopIds as any } } : { shopId: { in: [] as any } })
          },
          select: {
            finalAmount: true,
            paymentMethod: true,
            paymentStatus: true,
            notes: true
          }
        }),
        prisma.tmtSale.findMany({
          where: {
            isActive: true,
            saleDate: {
              gte: startDate,
              lte: endDate
            },
            ...(allowedShopIds.length > 0 ? { shopId: { in: allowedShopIds as any } } : { shopId: { in: [] as any } })
          },
          select: {
            totalAmount: true,
            paymentMethod: true,
            paymentStatus: true,
            notes: true
          }
        })
      ]);

      const combinedSales = [
        ...sales.map(s => ({ ...s, amount: Number(s.finalAmount || 0) })),
        ...tmtSales.map(ts => ({ ...ts, amount: Number(ts.totalAmount || 0) }))
      ];

      const breakdownMap = new Map<string, { amount: number, count: number }>();
      
      combinedSales.forEach(sale => {
        const amount = sale.amount;
        let method = sale.paymentMethod as string;
        
        // Check for partial payments or loans in notes
        const partialMatch = sale.notes?.match(/Partial Payment: ₹(\d+(?:\.\d+)?) via (\w+), Due: ₹(\d+(?:\.\d+)?)/);
        const isLoan = sale.notes?.includes('Loan/Credit Sale') || (sale.paymentStatus === 'PENDING' && !partialMatch && amount > 0);

        if (partialMatch) {
          // Partial payment: Split between the payment method used and LOAN
          const paid = parseFloat(partialMatch[1]);
          const due = parseFloat(partialMatch[3]);
          const partialMethod = partialMatch[2].toUpperCase();
          
          // Add paid part
          const pMethod = breakdownMap.get(partialMethod) || { amount: 0, count: 0 };
          pMethod.amount += paid;
          pMethod.count += 1;
          breakdownMap.set(partialMethod, pMethod);
          
          // Add due part to LOAN
          const loanMethod = breakdownMap.get('LOAN') || { amount: 0, count: 0 };
          loanMethod.amount += due;
          loanMethod.count += 1;
          breakdownMap.set('LOAN', loanMethod);
        } else if (isLoan) {
          // Full loan/credit
          const m = breakdownMap.get('LOAN') || { amount: 0, count: 0 };
          m.amount += amount;
          m.count += 1;
          breakdownMap.set('LOAN', m);
        } else {
          // Regular payment
          const m = breakdownMap.get(method) || { amount: 0, count: 0 };
          m.amount += amount;
          m.count += 1;
          breakdownMap.set(method, m);
        }
      });

      paymentMethodData = Array.from(breakdownMap.entries()).map(([method, data]) => ({
        method,
        amount: data.amount,
        count: data.count
      }));
      console.log('✅ [System Analytics] Payment breakdown fetched successfully');
      console.log('🔍 Payment breakdown data:', paymentMethodData);
    } catch (error) {
      console.error('❌ [System Analytics] Payment breakdown error:', error);
      paymentMethodData = [];
    }

    // Sales by month - dynamically calculate number of months based on days parameter
    // Calculate how many months to show (default to 6 months if not specified)
    const numMonths = Math.max(1, Math.ceil(days / 30));
    const monthsToShow = Math.min(numMonths, 12); // Cap at 12 months

    const monthIndices = Array.from({ length: monthsToShow }, (_, i) => monthsToShow - 1 - i);
    
    // Execute all month queries in parallel to avoid N+1 sequential bottlenecks
    const monthPromises = monthIndices.map(async (i) => {
      const now = new Date();
      const targetYear = now.getUTCFullYear();
      const targetMonth = now.getUTCMonth() - i;

      const monthStart = new Date(Date.UTC(targetYear, targetMonth, 1, 0, 0, 0, 0));
      const monthEnd = new Date(Date.UTC(targetYear, targetMonth + 1, 0, 23, 59, 59, 999));

      const [monthSales, monthTmtSales, monthExpenses] = await Promise.all([
        prisma.sale.aggregate({
          where: {
            isActive: true,
            saleDate: { gte: monthStart, lte: monthEnd },
            ...shopFilter
          },
          _sum: { finalAmount: true },
          _count: { id: true }
        }),
        prisma.tmtSale.aggregate({
          where: {
            isActive: true,
            saleDate: { gte: monthStart, lte: monthEnd },
            ...shopFilter
          },
          _sum: { totalAmount: true },
          _count: { id: true }
        }),
        prisma.expense.aggregate({
          where: {
            isActive: true,
            date: { gte: monthStart, lte: monthEnd },
            ...shopFilter
          },
          _sum: { amount: true }
        })
      ]);

      const monthLabel = monthStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      const revenue = Number(monthSales._sum.finalAmount || 0) + Number(monthTmtSales._sum.totalAmount || 0);
      const salesCount = (monthSales._count.id || 0) + (monthTmtSales._count.id || 0);
      const expenses = Number(monthExpenses._sum.amount || 0);

      return {
        month: monthLabel,
        salesCount,
        revenue,
        expenses
      };
    });

    const monthlyData = await Promise.all(monthPromises);
    
    const salesByMonth = monthlyData.map(d => ({
      month: d.month,
      sales: d.salesCount,
      revenue: d.revenue
    }));
    
    const expensesByMonth = monthlyData.map(d => ({
      month: d.month,
      expenses: d.expenses
    }));

    console.log('📊 Total monthly analytics processed in parallel');

    // Expenses by category
    const expensesByCategory = await prisma.expense.groupBy({
      by: ['category'],
      where: {
        ...shopFilter,
        date: {
          gte: startDate,
          lte: endDate
        },
        isActive: true
      },
      _sum: { amount: true },
      orderBy: {
        _sum: {
          amount: 'desc'
        }
      }
    });

    // Top products by revenue
    let topProductsData: Array<{ name: string; sales: number; revenue: number }> = [];
    try {
      console.log('🔍 [System Analytics] Fetching top products...');
      const topProducts = await prisma.saleItem.groupBy({
        by: ['productId'],
        where: {
          sale: {
            isActive: true,
            ...shopFilter
          }
        },
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
      console.log('✅ [System Analytics] Top products fetched successfully');
    } catch (error) {
      console.error('❌ [System Analytics] Top products error:', error);
      topProductsData = [];
    }

    // Top shops by revenue
    const generalTopShops = await prisma.sale.groupBy({
      by: ['shopId'],
      where: {
        isActive: true,
        saleDate: {
          gte: startDate,
          lte: endDate
        },
        ...shopFilter
      },
      _sum: { finalAmount: true },
      _count: { id: true }
    });

    const tmtTopShops = await prisma.tmtSale.groupBy({
      by: ['shopId'],
      where: {
        isActive: true,
        saleDate: {
          gte: startDate,
          lte: endDate
        },
        ...shopFilter
      },
      _sum: { totalAmount: true },
      _count: { id: true }
    });

    const topShopsMap = new Map<number, { revenue: number; sales: number }>();
    generalTopShops.forEach(item => {
      const id = Number(item.shopId);
      const val = topShopsMap.get(id) || { revenue: 0, sales: 0 };
      val.revenue += item._sum?.finalAmount ? parseFloat((item._sum.finalAmount as any).toString()) : 0;
      val.sales += item._count.id;
      topShopsMap.set(id, val);
    });
    tmtTopShops.forEach(item => {
      const id = Number(item.shopId);
      const val = topShopsMap.get(id) || { revenue: 0, sales: 0 };
      val.revenue += item._sum?.totalAmount ? parseFloat((item._sum.totalAmount as any).toString()) : 0;
      val.sales += item._count.id;
      topShopsMap.set(id, val);
    });

    let topShopsData: Array<{ name: string; revenue: number; sales: number; customers: number }> = [];
    try {
      console.log('🔍 [System Analytics] Processing top shops data...');
      
      const allShopsData = await Promise.all(
        Array.from(topShopsMap.entries()).map(async ([shopId, data]) => {
          const shop = await prisma.shop.findUnique({
            where: { id: BigInt(shopId) },
            select: { name: true }
          });

          // Get customer count for this shop
          const customerCount = await prisma.customer.count({
            where: {
              shopId: BigInt(shopId),
              isActive: true
            }
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
      console.log('✅ [System Analytics] Top shops data processed successfully');
    } catch (error) {
      console.error('❌ [System Analytics] Top shops data processing error:', error);
      topShopsData = [];
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
            if (entry.type === 'loan_clearing') {
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
    const netProfit = revenue - totalAllExpenses;

    // ROI (Return on Investment) = (Net Profit / Total Expenses) * 100
    const roi = totalAllExpenses > 0 ? (netProfit / totalAllExpenses) * 100 : 0;

    // ROS (Return on Sales) = (Net Profit / Total Sales) * 100
    const ros = revenue > 0 ? (netProfit / revenue) * 100 : 0;

    // Gross Margin = ((Revenue - Expenses) / Revenue) * 100
    const grossMargin = revenue > 0 ? ((revenue - totalAllExpenses) / revenue) * 100 : 0;

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

  } catch (error) {
    console.error('System analytics error:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to fetch system analytics'
    }, { status: 500 });
  }
} 