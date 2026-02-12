import { PrismaClient } from '@prisma/client';

class DatabaseClient {
  constructor() {
    this.prisma = null;
  }

  getClient() {
    if (!this.prisma) {
      this.prisma = new PrismaClient({
        log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
        datasources: {
          db: {
            url: process.env.DATABASE_URL,
          },
        },
        // Connection pooling
        __internal: {
          engine: {
            connectTimeout: 60000,
            queryTimeout: 30000,
          },
        },
      });
    }
    return this.prisma;
  }

  async disconnect() {
    if (this.prisma) {
      await this.prisma.$disconnect();
      this.prisma = null;
    }
  }

  // Optimized queries with caching
  async getUserWithCache(userId) {
    const cacheKey = `user:${userId}`;
    
    // Try cache first
    const cached = await redis.getCachedUser(userId);
    if (cached) return cached;

    // Query database
    const user = await this.getClient().user.findUnique({
      where: { id: userId },
      include: {
        customerSubscription: {
          include: {
            payments: true,
            usage: true,
          },
        },
      },
    });

    // Cache result
    if (user) {
      await redis.cacheUser(userId, user);
    }

    return user;
  }

  async getShopWithCache(shopId) {
    const cached = await redis.getCachedShopData(shopId);
    if (cached) return cached;

    const shop = await this.getClient().shop.findUnique({
      where: { id: shopId },
      include: {
        products: true,
        tmtInventory: true,
        sales: true,
      },
    });

    if (shop) {
      await redis.cacheShopData(shopId, shop);
    }

    return shop;
  }

  // Batch operations
  async batchGetUsers(userIds) {
    const users = await this.getClient().user.findMany({
      where: { id: { in: userIds } },
    });

    // Cache all users
    await Promise.all(
      users.map(user => redis.cacheUser(user.id, user))
    );

    return users;
  }

  // Optimized TMT inventory query
  async getTmtInventoryOptimized(shopId) {
    const cacheKey = `tmt_inventory:${shopId}`;
    const cached = await redis.get(cacheKey);
    if (cached) return cached;

    const inventory = await this.getClient().tmtInventory.findMany({
      where: { shopId },
      include: {
        product: {
          include: {
            company: true,
            size: true,
          },
        },
      },
      orderBy: [
        { product: { company: { name: 'asc' } } },
        { product: { size: { sizeMm: 'asc' } } },
      ],
    });

    await redis.set(cacheKey, inventory, 300); // 5 minutes cache
    return inventory;
  }
}

export const db = new DatabaseClient();
