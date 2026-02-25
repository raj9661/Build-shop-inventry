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
      startDate.setHours(0, 0, 0, 0); // Start of today (00:00:00)
      endDate.setHours(23, 59, 59, 999); // End of today (23:59:59)
    } else {
      // For other ranges, use rolling period from now
      startDate.setDate(endDate.getDate() - days);
      startDate.setHours(0, 0, 0, 0); // Start of day
      endDate.setHours(23, 59, 59, 999); // End of day
    }

    // Helper function to build shop filter for entities (sales, products, etc.)
    const getShopFilter = async () => {
      if (shopId && shopId !== ALL_SHOPS_ID) {
        // For SUPER_DUPER_ADMIN: Verify the specific shop was created by this user
        // For SUPER_ADMIN: Allow access to any shop
        if (decoded.role === 'SUPER_DUPER_ADMIN') {
          const shop = await prisma.shop.findFirst({
            where: {
              id: shopId,
              createdBy: BigInt(decoded.userId),
              isActive: true
            }
          });
          if (!shop) {
            // Shop not found or not created by this user
            return { id: { in: [] } };
          }
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
      totalSales,
      totalRevenue,
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
      businessGoals
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
      })
    ]);

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
    const revenueByShop = await prisma.sale.groupBy({
      by: ['shopId'],
      where: {
        isActive: true,
        saleDate: { gte: startDate, lte: endDate },
        ...(allowedShopIds.length > 0 ? { shopId: { in: allowedShopIds as any } } : { shopId: { in: [] as any } })
      },
      _sum: { finalAmount: true },
      _count: { id: true }
    });

    // Get shop names for revenue breakdown
    const shopRevenueData = await Promise.all(
      revenueByShop.map(async (item) => {
        const shop = await prisma.shop.findUnique({
          where: { id: item.shopId },
          select: { name: true, location: true }
        });
        const amount = item._sum?.finalAmount ? parseFloat((item._sum.finalAmount as any).toString()) : 0
        return {
          shopId: Number(item.shopId),
          shopName: shop?.name || 'Unknown Shop',
          shopLocation: shop?.location || '',
          amount,
          revenue: amount,
          sales: item._count.id
        };
      })
    );

    // Payment method breakdown across accessible shops (based on sales)
    let paymentMethodData: Array<{ method: string; amount: number; count: number }> = [];
    try {
      console.log('🔍 [System Analytics] Fetching payment breakdown from sales...');
      console.log('🔍 Date range for payment breakdown:', { startDate, endDate, days });
      const paymentBreakdown = await prisma.sale.groupBy({
        by: ['paymentMethod'],
        where: {
          isActive: true,
          saleDate: {
            gte: startDate,
            lte: endDate
          },
          ...(allowedShopIds.length > 0 ? { shopId: { in: allowedShopIds as any } } : { shopId: { in: [] as any } })
        },
        _sum: { finalAmount: true },
        _count: { id: true }
      });

      paymentMethodData = paymentBreakdown.map(item => ({
        method: item.paymentMethod,
        amount: Number(item._sum.finalAmount || 0),
        count: item._count.id
      }));
      console.log('✅ [System Analytics] Payment breakdown fetched successfully');
      console.log('🔍 Raw breakdown from DB:', paymentBreakdown);
      console.log('🔍 Payment breakdown data:', paymentMethodData);
    } catch (error) {
      console.error('❌ [System Analytics] Payment breakdown error:', error);
      paymentMethodData = [];
    }

    // Sales by month - dynamically calculate number of months based on days parameter
    const salesByMonth = [];
    // Calculate how many months to show (default to 6 months if not specified)
    const numMonths = Math.max(1, Math.ceil(days / 30));
    const monthsToShow = Math.min(numMonths, 12); // Cap at 12 months

    for (let i = monthsToShow - 1; i >= 0; i--) {
      const now = new Date();
      // Calculate the target month by subtracting i months from now (using UTC)
      const targetYear = now.getUTCFullYear();
      const targetMonth = now.getUTCMonth() - i;

      // Create month start (first day of month, 00:00:00 UTC)
      const monthStart = new Date(Date.UTC(targetYear, targetMonth, 1, 0, 0, 0, 0));

      // Create month end (last day of month, 23:59:59.999 UTC)
      const monthEnd = new Date(Date.UTC(targetYear, targetMonth + 1, 0, 23, 59, 59, 999));

      const monthSales = await prisma.sale.aggregate({
        where: {
          isActive: true,
          saleDate: {
            gte: monthStart,
            lte: monthEnd
          },
          ...shopFilter
        },
        _sum: { finalAmount: true },
        _count: { id: true }
      });

      // Format month as "MMM YYYY"
      const monthLabel = monthStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

      const revenue = Number(monthSales._sum.finalAmount || 0);
      console.log(`📊 Month ${monthLabel}: ${monthSales._count.id || 0} sales, ₹${revenue}`);

      salesByMonth.push({
        month: monthLabel,
        sales: monthSales._count.id || 0,
        revenue: revenue
      });
    }
    console.log('📊 Total sales by month data:', salesByMonth);

    // Expenses by month - same logic as sales by month
    const expensesByMonth = [];
    for (let i = monthsToShow - 1; i >= 0; i--) {
      const now = new Date();
      const targetYear = now.getUTCFullYear();
      const targetMonth = now.getUTCMonth() - i;

      const monthStart = new Date(Date.UTC(targetYear, targetMonth, 1, 0, 0, 0, 0));
      const monthEnd = new Date(Date.UTC(targetYear, targetMonth + 1, 0, 23, 59, 59, 999));

      const monthExpenses = await prisma.expense.aggregate({
        where: {
          isActive: true,
          date: {
            gte: monthStart,
            lte: monthEnd
          },
          ...shopFilter
        },
        _sum: { amount: true }
      });

      const monthLabel = monthStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

      expensesByMonth.push({
        month: monthLabel,
        expenses: Number(monthExpenses._sum.amount || 0)
      });
    }

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
    const topShops = await prisma.sale.groupBy({
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
      _count: { id: true },
      orderBy: { _sum: { finalAmount: 'desc' } },
      take: 10
    });

    let topShopsData: Array<{ name: string; revenue: number; sales: number; customers: number }> = [];
    try {
      console.log('🔍 [System Analytics] Processing top shops data...');
      topShopsData = await Promise.all(
        topShops.map(async (item) => {
          const shop = await prisma.shop.findUnique({
            where: { id: item.shopId },
            select: { name: true }
          });

          // Get customer count for this shop
          const customerCount = await prisma.customer.count({
            where: {
              shopId: item.shopId,
              isActive: true
            }
          });

          return {
            name: shop?.name || 'Unknown Shop',
            revenue: Number(item._sum.finalAmount || 0),
            sales: item._count.id || 0,
            customers: customerCount
          };
        })
      );
      console.log('✅ [System Analytics] Top shops data processed successfully');
    } catch (error) {
      console.error('❌ [System Analytics] Top shops data processing error:', error);
      topShopsData = [];
    }

    // Helper function to serialize BigInt values and Date objects
    const serializeBigInt = (obj: any): any => {
      if (obj === null || obj === undefined) return obj;
      if (typeof obj === 'bigint') return Number(obj);
      if (obj instanceof Date) return obj.toISOString();
      if (Array.isArray(obj)) return obj.map(serializeBigInt);
      if (typeof obj === 'object') {
        const serialized: any = {};
        for (const [key, value] of Object.entries(obj)) {
          serialized[key] = serializeBigInt(value);
        }
        return serialized;
      }
      return obj;
    };

    // Calculate business metrics
    const revenue = Number(totalRevenue._sum.finalAmount || 0);
    const expenses = Number(totalExpenses._sum.amount || 0);
    const employeePayments = Number(totalEmployeePayments._sum.amount || 0);
    const supplierPayments = Number(totalSupplierPayments._sum.amount || 0);
    const totalAllExpenses = expenses + employeePayments + supplierPayments;
    const netProfit = revenue - totalAllExpenses;

    // ROI (Return on Investment) = (Net Profit / Total Expenses) * 100
    const roi = totalAllExpenses > 0 ? (netProfit / totalAllExpenses) * 100 : 0;

    // ROS (Return on Sales) = (Net Profit / Total Sales) * 100
    const ros = revenue > 0 ? (netProfit / revenue) * 100 : 0;

    // Gross Margin = ((Revenue - Expenses) / Revenue) * 100
    const grossMargin = revenue > 0 ? ((revenue - totalAllExpenses) / revenue) * 100 : 0;

    console.log('📊 Business Metrics calculated:', {
      revenue,
      expenses,
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
        totalExpenses: expenses,
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
      totalRevenue: Number(totalRevenue._sum.finalAmount || 0),
      totalSales,
      totalProducts,
      totalCustomers,
      totalEmployees,
      totalExpenses: Number(totalExpenses._sum.amount || 0),
      shopFilter: shopId ? `Shop ${shopId}` : 'All shops'
    });

    return NextResponse.json(serializeBigInt(responseData));

  } catch (error) {
    console.error('System analytics error:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to fetch system analytics'
    }, { status: 500 });
  }
} 