import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { performance } from 'perf_hooks';

// Ultra-optimized Redis configuration for dashboard
const DASHBOARD_REDIS_CONFIG = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '1'), // Use separate DB for dashboard
  // Ultra-fast settings
  maxRetriesPerRequest: 1,
  retryDelayOnFailover: 50,
  enableReadyCheck: false,
  maxLoadingTimeout: 2000,
  lazyConnect: false,
  keepAlive: 60000,
  connectTimeout: 2000,
  commandTimeout: 1000,
  enableOfflineQueue: false,
  family: 4,
  maxMemoryPolicy: 'allkeys-lru',
  maxMemory: '512mb',
};

interface DashboardCache {
  data: any;
  timestamp: number;
  version: string;
}

interface DashboardStats {
  totalSales: number;
  totalProducts: number;
  totalCustomers: number;
  totalEmployees: number;
  totalRevenue: number;
  sales: any[];
  lowStockProducts: any[];
  topProducts: any[];
  paymentMethods: any[];
  expenses: any[];
  analytics: any;
  productsInStock: any[];
}

class UltraFastDashboard {
  private prisma: PrismaClient;
  private redis: Redis;
  private memoryCache: Map<string, DashboardCache> = new Map();
  private performanceMetrics: Map<string, number[]> = new Map();
  private readonly CACHE_TTL = 300000; // 5 minutes
  private readonly STATS_CACHE_TTL = 600000; // 10 minutes
  private readonly VERSION = '1.0.0';

  constructor() {
    this.prisma = new PrismaClient({
      datasources: {
        db: { url: process.env.DATABASE_URL },
      },
      log: ['error'],
    });

    this.redis = new Redis(DASHBOARD_REDIS_CONFIG);
    this.setupRedisHandlers();
  }

  // Helper function to safely serialize BigInt values
  private serializeBigInt(obj: any): string {
    return JSON.stringify(obj, (key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    );
  }

  private setupRedisHandlers() {
    this.redis.on('connect', () => {
      console.log('⚡ Ultra-fast Dashboard Redis connected');
    });

    this.redis.on('error', (error) => {
      console.error('❌ Dashboard Redis error:', error);
    });
  }

  private trackPerformance(operation: string, startTime: number) {
    const duration = performance.now() - startTime;
    if (!this.performanceMetrics.has(operation)) {
      this.performanceMetrics.set(operation, []);
    }
    this.performanceMetrics.get(operation)!.push(duration);
  }

  getPerformanceStats() {
    const stats: Record<string, any> = {};
    for (const [operation, times] of this.performanceMetrics) {
      const avg = times.reduce((a, b) => a + b, 0) / times.length;
      const min = Math.min(...times);
      const max = Math.max(...times);
      stats[operation] = {
        count: times.length,
        average: avg.toFixed(2),
        min: min.toFixed(2),
        max: max.toFixed(2),
        p95: this.percentile(times, 95).toFixed(2),
        p99: this.percentile(times, 99).toFixed(2),
      };
    }
    return stats;
  }

  private percentile(arr: number[], p: number): number {
    const sorted = arr.sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[index] || 0;
  }

  // Ultra-fast dashboard data loading with multi-layer caching
  async getDashboardData(shopId: number, userId: number): Promise<DashboardStats> {
    const startTime = performance.now();
    const cacheKey = `dashboard:${shopId}:${userId}`;

    try {
      // 1. Check memory cache first (fastest)
      const memoryCache = this.memoryCache.get(cacheKey);
      if (memoryCache && Date.now() - memoryCache.timestamp < this.CACHE_TTL) {
        this.trackPerformance('dashboard_memory_cache', startTime);
        return memoryCache.data;
      }

      // 2. Check Redis cache
      const redisData = await this.redis.get(cacheKey);
      if (redisData) {
        const cachedData = JSON.parse(redisData);
        this.memoryCache.set(cacheKey, {
          data: cachedData,
          timestamp: Date.now(),
          version: this.VERSION
        });
        this.trackPerformance('dashboard_redis_cache', startTime);
        return cachedData;
      }

      // 3. Load from database with parallel queries
      const dashboardData = await this.loadDashboardDataFromDB(shopId);

      // 4. Cache the result
      await Promise.all([
        this.redis.setex(cacheKey, 300, this.serializeBigInt(dashboardData)),
        this.memoryCache.set(cacheKey, {
          data: dashboardData,
          timestamp: Date.now(),
          version: this.VERSION
        })
      ]);

      this.trackPerformance('dashboard_db_load', startTime);
      return dashboardData;

    } catch (error) {
      console.error('Dashboard data loading error:', error);
      throw error;
    }
  }

  // Parallel database queries for maximum performance
  private async loadDashboardDataFromDB(shopId: number): Promise<DashboardStats> {
    const startTime = performance.now();

    try {
      // Parallel execution of all dashboard queries
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const endOfToday = new Date();
      endOfToday.setHours(23, 59, 59, 999);

      const results = await Promise.all([
        this.prisma.sale.count({
          where: {
            shopId: BigInt(shopId),
            paymentStatus: 'COMPLETED',
            updatedAt: { gte: startOfToday, lte: endOfToday }
          }
        }),
        this.prisma.product.count({ where: { shopId: BigInt(shopId), isActive: true } }),
        this.prisma.customer.count({ where: { shopId: BigInt(shopId), isActive: true } }),
        this.prisma.employee.count({ where: { shopId: BigInt(shopId), isActive: true } }),
        this.prisma.sale.aggregate({
          where: {
            shopId: BigInt(shopId),
            isActive: true,
            paymentStatus: 'COMPLETED',
            updatedAt: { gte: startOfToday, lte: endOfToday },
          },
          _sum: { finalAmount: true }
        }),
        this.prisma.sale.findMany({
          where: { shopId: BigInt(shopId), isActive: true },
          include: {
            customer: { select: { name: true, phone: true, address: true } },
            items: { include: { product: { select: { name: true } } } }
          },
          orderBy: { createdAt: 'desc' }
        }),
        this.prisma.tmtSale.findMany({
          where: { shopId: BigInt(shopId), isActive: true },
          include: {
            items: {
              include: {
                product: {
                  select: {
                    productName: true,
                    company: { select: { name: true } },
                    size: { select: { sizeMm: true } }
                  }
                }
              }
            },
            customer: { select: { name: true, phone: true, address: true } }
          },
          orderBy: { createdAt: 'desc' }
        }),
        this.prisma.product.findMany({
          where: { shopId: BigInt(shopId), isActive: true, stockQuantity: { lte: 10 } },
          select: {
            id: true,
            name: true,
            stockQuantity: true,
            minStockLevel: true,
            category: { select: { name: true } }
          },
          orderBy: { stockQuantity: 'asc' },
          take: 10
        }),
        this.prisma.saleItem.groupBy({
          by: ['productId'],
          where: { sale: { shopId: BigInt(shopId) } },
          _sum: { quantity: true },
          orderBy: { _sum: { quantity: 'desc' } },
          take: 10
        }),
        this.prisma.payment.groupBy({
          by: ['method'],
          where: { shopId: BigInt(shopId), isActive: true },
          _sum: { amount: true }
        }),
        this.prisma.expense.findMany({
          where: {
            shopId: BigInt(shopId),
            isActive: true,
            date: { gte: startOfToday, lte: endOfToday }
          },
          orderBy: { createdAt: 'desc' },
          take: 10
        }),
        this.getAnalyticsData(shopId)
      ]);

      const totalSales = Number(results[0]);
      const totalProducts = Number(results[1]);
      const totalCustomers = Number(results[2]);
      const totalEmployees = Number(results[3]);
      const totalRevenue = results[4];
      const recentSales = results[5] as any[];
      const tmtSales = results[6] as any[];
      const lowStockProducts = results[7] as any[];
      const topProducts = results[8] as any[];
      const paymentMethods = results[9] as any[];
      const expenses = results[10] as any[];
      const analytics = results[11] as any;

      const parseDecimal = (value: any): number => {
        if (value === null || value === undefined) return 0;
        if (typeof value === 'object' && value.toString) return parseFloat(value.toString());
        return Number(value) || 0;
      };

      const mapPaymentMethodToFrontend = (method: string) => {
        switch (method) {
          case 'CASH': return 'cash';
          case 'CARD': return 'online';
          case 'UPI': return 'upi';
          case 'BANK_TRANSFER': return 'bank_transfer';
          case 'CHEQUE': return 'cheque';
          default: return 'cash';
        }
      };

      // 1. Transform Regular Sales
      const transformedRegularSales = recentSales.map((sale: any) => {
        const total = parseDecimal(sale.finalAmount);
        let paid = 0;
        let due = 0;
        let paymentType = 'cash';

        if (sale.paymentStatus === 'PENDING' || sale.paymentStatus === 'COMPLETED') {
          const partialPaymentMatch = sale.notes?.match(/Partial Payment: ₹(\d+(?:\.\d+)?) via (\w+), Due: ₹(\d+(?:\.\d+)?)/);
          const loanMatch = sale.notes?.match(/Loan\/Credit Sale: Full amount due \(₹(\d+(?:\.\d+)?)\)/);
          const hasLoanNote = sale.notes?.includes('Loan/Credit Sale');

          if (partialPaymentMatch) {
            paid = parseFloat(partialPaymentMatch[1]);
            due = parseFloat(partialPaymentMatch[3]);
            paymentType = 'partial';
          } else if (loanMatch || hasLoanNote) {
            paid = 0;
            due = total;
            paymentType = 'loan';
          } else if (sale.paymentMethod) {
            paid = total;
            due = 0;
            paymentType = mapPaymentMethodToFrontend(sale.paymentMethod);
          } else {
            paid = 0;
            due = total;
            paymentType = 'loan';
          }
        }

        return {
          id: Number(sale.id),
          customerName: sale.customer?.name || 'Unknown',
          customerPhone: sale.customer?.phone || '',
          customerAddress: sale.customer?.address || '',
          final_amount: total,
          paid_amount: paid,
          due_amount: due,
          payment_type: paymentType,
          createdAt: sale.createdAt,
          paymentStatus: sale.paymentStatus,
          isCompleted: sale.paymentStatus === 'COMPLETED',
          isCancelled: sale.paymentStatus === 'CANCELLED',
          notes: sale.notes || '',
          items: sale.items.map((item: any) => ({
            productName: item.product?.name || 'Unknown',
            quantity: item.quantity,
            unit: item.unit || 'bag'
          })),
          isTmtSale: false
        };
      });

      // 2. Transform TMT Sales
      const transformedTmtSales = tmtSales.map((tmtSale: any) => {
        const total = parseDecimal(tmtSale.totalAmount);
        const paid = parseDecimal(tmtSale.paidAmount) || total;
        const due = parseDecimal(tmtSale.dueAmount) || 0;

        let paymentType = 'cash';
        if (tmtSale.paymentStatus === 'PARTIAL') paymentType = 'partial';
        else if (tmtSale.paymentStatus === 'UNPAID') paymentType = 'loan';
        else if (tmtSale.paymentStatus === 'PAID') {
          const method = tmtSale.paymentMethod?.toLowerCase() || 'cash';
          paymentType = (method === 'card' || method === 'upi') ? 'online' : method;
        }

        let isCompleted = tmtSale.status === 'COMPLETED';
        let isCancelled = tmtSale.paymentStatus === 'CANCELLED';

        return {
          id: Number(tmtSale.id),
          customerName: tmtSale.customer?.name || tmtSale.customerName || 'Walk-in Customer',
          customerPhone: tmtSale.customer?.phone || '',
          customerAddress: tmtSale.customer?.address || '',
          final_amount: total,
          paid_amount: paid,
          due_amount: due,
          payment_type: paymentType,
          createdAt: tmtSale.createdAt || tmtSale.saleDate,
          paymentStatus: isCancelled ? 'CANCELLED' : (isCompleted ? 'COMPLETED' : 'PENDING'),
          isCompleted,
          isCancelled,
          notes: tmtSale.notes || '',
          items: tmtSale.items?.map((item: any) => ({
            productName: item.product?.productName || 'TMT Bar',
            quantity: item.quantity,
            unit: item.unitType || 'KG'
          })) || [],
          isTmtSale: true
        };
      });

      // 3. Combine and Group
      const allSales = [...transformedRegularSales, ...transformedTmtSales].sort((a, b) => {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

      const groupedSales = this.groupMixedSales(allSales);

      // 4. Fetch Products and today's rates for stock display
      const products = await this.prisma.product.findMany({
        where: { shopId: BigInt(shopId), isActive: true, stockQuantity: { gt: 0 } },
        select: { id: true, name: true, unit: true, price: true, stockQuantity: true }
      });

      const dailyRates = await this.prisma.dailyProductPrice.findMany({
        where: { productId: { in: products.map(p => p.id) }, date: startOfToday },
        select: { productId: true, price: true }
      });

      const dailyRateMap = new Map(dailyRates.map((dr: any) => [dr.productId, dr.price]));
      const productsWithDailyRates = products.map((product: any) => ({
        id: Number(product.id),
        name: product.name,
        unit: product.unit,
        dailyRate: dailyRateMap.has(product.id) ? Number(dailyRateMap.get(product.id)) : null
      }));

      const dashboardData: DashboardStats = {
        totalSales,
        totalProducts,
        totalCustomers,
        totalEmployees,
        totalRevenue: (() => {
          const v = (totalRevenue as any)?._sum?.finalAmount;
          return v ? parseFloat(v.toString()) : 0;
        })(),
        sales: groupedSales,
        lowStockProducts: lowStockProducts.map((p: any) => ({
          id: p.id,
          name: p.name,
          stockQuantity: p.stockQuantity,
          minStockLevel: p.minStockLevel,
          category: p.category?.name || 'Unknown'
        })),
        topProducts: await this.getTopProductsWithDetails(topProducts, shopId),
        paymentMethods: paymentMethods.map((pm: any) => ({
          method: pm.method,
          amount: Number(pm._sum.amount || 0)
        })),
        expenses: expenses.map((e: any) => ({
          id: Number(e.id),
          description: e.description,
          amount: Number(e.amount),
          category: e.category,
          date: e.date
        })),
        analytics,
        productsInStock: productsWithDailyRates
      };

      this.trackPerformance('dashboard_parallel_queries', startTime);
      return dashboardData;

    } catch (error) {
      console.error('Error loading dashboard data from DB:', error);
      throw error;
    }
  }

  // Get top products with details
  private async getTopProductsWithDetails(topProducts: any[], shopId: number) {
    const productIds = topProducts.map((p: any) => p.productId);
    const products = await this.prisma.product.findMany({
      where: {
        id: { in: productIds },
        shopId: BigInt(shopId)
      },
      select: {
        id: true,
        name: true,
        price: true,
        stockQuantity: true,
        category: { select: { name: true } }
      }
    });

    return topProducts.map((tp: any) => {
      const product = products.find(p => p.id === tp.productId);
      return {
        id: tp.productId,
        name: product?.name || 'Unknown',
        totalSold: Number(tp._sum.quantity || 0),
        price: Number(product?.price || 0),
        stockQuantity: product?.stockQuantity || 0,
        category: product?.category?.name || 'Unknown'
      };
    });
  }

  // Get analytics data
  private async getAnalyticsData(shopId: number) {
    const today = new Date();
    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);

    const [todaySales, todayRevenue, monthlySales] = await Promise.all([
      this.prisma.sale.count({
        where: {
          shopId: BigInt(shopId),
          createdAt: { gte: startOfDay, lte: endOfDay }
        }
      }),
      this.prisma.sale.aggregate({
        where: {
          shopId: BigInt(shopId),
          createdAt: { gte: startOfDay, lte: endOfDay }
        },
        _sum: { finalAmount: true }
      }),
      this.prisma.sale.groupBy({
        by: ['createdAt'],
        where: {
          shopId: BigInt(shopId),
          createdAt: { gte: new Date(today.getFullYear(), today.getMonth(), 1) }
        },
        _sum: { finalAmount: true }
      })
    ]);

    return {
      todaySales,
      todayRevenue: Number(todayRevenue._sum.finalAmount || 0),
      monthlySales: monthlySales.map((sale: any) => ({
        date: sale.createdAt,
        revenue: Number(sale._sum.finalAmount || 0)
      }))
    };
  }

  // Clear dashboard cache
  async clearDashboardCache(shopId: number, userId: number): Promise<void> {
    const cacheKey = `dashboard:${shopId}:${userId}`;
    await Promise.all([
      this.redis.del(cacheKey),
      this.memoryCache.delete(cacheKey)
    ]);
  }

  // Clear dashboard cache for all users of a shop
  async clearAllShopDashboardCaches(shopId: number): Promise<void> {
    // Clear from Redis
    const keys = await this.redis.keys(`dashboard:${shopId}:*`);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
    // Clear from memory cache
    for (const key of this.memoryCache.keys()) {
      if (key.startsWith(`dashboard:${shopId}:`)) {
        this.memoryCache.delete(key);
      }
    }
  }

  // Group mixed sales (Regular + TMT) for the same customer
  private groupMixedSales(sales: any[]): any[] {
    if (sales.length === 0) return [];

    // Ensure sorted by date (newest first)
    const sorted = [...sales].sort((a, b) => {
      const dateA = new Date(a.createdAt || a.saleDate).getTime();
      const dateB = new Date(b.createdAt || b.saleDate).getTime();
      return dateB - dateA;
    });

    const grouped: any[] = [];
    const usedIndices = new Set<number>();

    for (let i = 0; i < sorted.length; i++) {
      if (usedIndices.has(i)) continue;

      const current = sorted[i];

      // Only group if we have a valid phone number (to avoid merging random walk-ins)
      if (!current.customerPhone) {
        grouped.push(current);
        continue;
      }

      let merged = { ...current };
      usedIndices.add(i);

      // Look ahead for matches within 1 minute window
      for (let j = i + 1; j < Math.min(i + 5, sorted.length); j++) {
        if (usedIndices.has(j)) continue;

        const candidate = sorted[j];

        // Check Phone Match
        if (candidate.customerPhone !== current.customerPhone) continue;

        // Check Time Match (within 60 seconds)
        const timeDiff = Math.abs(new Date(current.createdAt).getTime() - new Date(candidate.createdAt).getTime());
        if (timeDiff > 60000) continue;

        // Consolidate
        merged.final_amount = (merged.final_amount || 0) + (candidate.final_amount || 0);
        merged.paid_amount = (merged.paid_amount || 0) + (candidate.paid_amount || 0);
        merged.due_amount = (merged.due_amount || 0) + (candidate.due_amount || 0);
        merged.items = [...(merged.items || []), ...(candidate.items || [])];

        // Combine Notes if unique
        if (candidate.notes && candidate.notes !== merged.notes) {
          merged.notes = merged.notes ? `${merged.notes} | ${candidate.notes}` : candidate.notes;
        }

        // Mark as used
        usedIndices.add(j);
      }

      grouped.push(merged);
    }

    return grouped;
  }

  // Get cache statistics
  getCacheStats() {
    return {
      memoryCacheSize: this.memoryCache.size,
      performanceStats: this.getPerformanceStats()
    };
  }

  // Cleanup
  async disconnect(): Promise<void> {
    await Promise.all([
      this.prisma.$disconnect(),
      this.redis.quit()
    ]);
  }
}

// Export singleton instance
const ultraFastDashboard = new UltraFastDashboard();
export default ultraFastDashboard; 