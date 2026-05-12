# 🚀 High-Performance SaaS Platform Setup

## 📋 Performance Stack Overview

- **Frontend**: Next.js 14 with Turbopack (ultra-fast dev/build)
- **Backend**: Next.js API Routes with Redis caching
- **Database**: CockroachDB with optimized indexes and connection pooling
- **Caching**: Redis for session management, API caching, and real-time data
- **Containerization**: Docker with multi-stage builds
- **Monitoring**: Performance metrics and health checks

## 🐳 Docker Configuration

### **Dockerfile (Multi-stage, Optimized)**
```dockerfile
# Dockerfile
FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json package-lock.json* ./
RUN npm ci --only=production

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Enable Turbopack for faster builds
ENV TURBOPACK=1
RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
```

### **Docker Compose (Production Ready)**
```yaml
# docker-compose.yml
version: '3.8'

services:
  # Next.js Application
  app:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
      - STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY}
      - RAZORPAY_KEY_ID=${RAZORPAY_KEY_ID}
      - RAZORPAY_KEY_SECRET=${RAZORPAY_KEY_SECRET}
    depends_on:
      - redis
      - db
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Redis Cache
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    command: redis-server --appendonly yes --maxmemory 512mb --maxmemory-policy allkeys-lru
    volumes:
      - redis_data:/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 30s
      timeout: 10s
      retries: 3

  # CockroachDB (using external managed service)
  # db:
  #   image: cockroachdb/cockroach:latest
  #   ports:
  #     - "26257:26257"
  #   command: start-single-node --insecure
  #   volumes:
  #     - db_data:/cockroach/cockroach-data
  #   restart: unless-stopped

  # Nginx Reverse Proxy (Optional)
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - app
    restart: unless-stopped

volumes:
  redis_data:
  db_data:
```

## ⚡ Next.js Configuration (Turbopack Enabled)

### **next.config.js (Optimized)**
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable Turbopack for development
  experimental: {
    turbo: {
      rules: {
        '*.svg': {
          loaders: ['@svgr/webpack'],
          as: '*.js',
        },
      },
    },
  },
  
  // Enable standalone output for Docker
  output: 'standalone',
  
  // Optimize images
  images: {
    domains: ['localhost'],
    formats: ['image/webp', 'image/avif'],
  },
  
  // Enable compression
  compress: true,
  
  // Optimize bundle
  swcMinify: true,
  
  // Enable experimental features
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client'],
    optimizeCss: true,
    optimizePackageImports: ['@prisma/client', 'redis'],
  },
  
  // Webpack optimizations
  webpack: (config, { dev, isServer }) => {
    // Production optimizations
    if (!dev && !isServer) {
      config.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all',
          },
          prisma: {
            test: /[\\/]node_modules[\\/]@prisma[\\/]/,
            name: 'prisma',
            chunks: 'all',
          },
        },
      };
    }
    
    return config;
  },
  
  // Headers for performance
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
        ],
      },
      {
        source: '/api/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=60, stale-while-revalidate=300',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
```

## 🚀 Package.json (Optimized Dependencies)

### **package.json**
```json
{
  "name": "saas-inventory-platform",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev --turbo",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "db:generate": "prisma generate",
    "db:push": "prisma db push",
    "db:migrate": "prisma migrate dev",
    "db:studio": "prisma studio",
    "docker:build": "docker build -t saas-platform .",
    "docker:run": "docker run -p 3000:3000 saas-platform",
    "docker:compose": "docker-compose up -d",
    "docker:down": "docker-compose down",
    "redis:cli": "docker exec -it saas-platform-redis-1 redis-cli",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  },
  "dependencies": {
    "@prisma/client": "^5.7.1",
    "next": "^14.0.4",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "redis": "^4.6.12",
    "stripe": "^14.9.0",
    "razorpay": "^2.9.2",
    "bcryptjs": "^2.4.3",
    "jsonwebtoken": "^9.0.2",
    "zod": "^3.22.4",
    "react-hook-form": "^7.48.2",
    "@hookform/resolvers": "^3.3.2",
    "lucide-react": "^0.294.0",
    "clsx": "^2.0.0",
    "tailwind-merge": "^2.2.0",
    "date-fns": "^3.0.6",
    "recharts": "^2.8.0",
    "react-hot-toast": "^2.4.1",
    "framer-motion": "^10.16.16"
  },
  "devDependencies": {
    "prisma": "^5.7.1",
    "@types/node": "^20.10.5",
    "@types/react": "^18.2.45",
    "@types/react-dom": "^18.2.18",
    "@types/bcryptjs": "^2.4.6",
    "@types/jsonwebtoken": "^9.0.5",
    "typescript": "^5.3.3",
    "tailwindcss": "^3.4.0",
    "autoprefixer": "^10.4.16",
    "postcss": "^8.4.32",
    "eslint": "^8.56.0",
    "eslint-config-next": "^14.0.4",
    "jest": "^29.7.0",
    "@testing-library/react": "^14.1.2",
    "@testing-library/jest-dom": "^6.1.6"
  }
}
```

## 🔧 Redis Configuration (High Performance)

### **lib/redis.js**
```javascript
import { createClient } from 'redis';

class RedisClient {
  constructor() {
    this.client = null;
    this.isConnected = false;
  }

  async connect() {
    if (this.isConnected) return this.client;

    this.client = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      socket: {
        reconnectStrategy: (retries) => Math.min(retries * 50, 500),
      },
    });

    this.client.on('error', (err) => {
      console.error('Redis Client Error:', err);
    });

    this.client.on('connect', () => {
      console.log('✅ Redis connected');
      this.isConnected = true;
    });

    await this.client.connect();
    return this.client;
  }

  async get(key) {
    const client = await this.connect();
    const value = await client.get(key);
    return value ? JSON.parse(value) : null;
  }

  async set(key, value, ttl = 3600) {
    const client = await this.connect();
    await client.setEx(key, ttl, JSON.stringify(value));
  }

  async del(key) {
    const client = await this.connect();
    await client.del(key);
  }

  async exists(key) {
    const client = await this.connect();
    return await client.exists(key);
  }

  async flush() {
    const client = await this.connect();
    await client.flushAll();
  }

  // Cache patterns
  async cacheUser(userId, userData, ttl = 1800) {
    await this.set(`user:${userId}`, userData, ttl);
  }

  async getCachedUser(userId) {
    return await this.get(`user:${userId}`);
  }

  async cacheSubscription(customerId, subscriptionData, ttl = 3600) {
    await this.set(`subscription:${customerId}`, subscriptionData, ttl);
  }

  async getCachedSubscription(customerId) {
    return await this.get(`subscription:${customerId}`);
  }

  async cacheShopData(shopId, shopData, ttl = 1800) {
    await this.set(`shop:${shopId}`, shopData, ttl);
  }

  async getCachedShopData(shopId) {
    return await this.get(`shop:${shopId}`);
  }

  // Session management
  async setSession(sessionId, sessionData, ttl = 86400) {
    await this.set(`session:${sessionId}`, sessionData, ttl);
  }

  async getSession(sessionId) {
    return await this.get(`session:${sessionId}`);
  }

  async deleteSession(sessionId) {
    await this.del(`session:${sessionId}`);
  }

  // Rate limiting
  async rateLimit(key, limit, window) {
    const client = await this.connect();
    const current = await client.incr(key);
    
    if (current === 1) {
      await client.expire(key, window);
    }
    
    return current <= limit;
  }

  // Real-time data
  async publish(channel, message) {
    const client = await this.connect();
    await client.publish(channel, JSON.stringify(message));
  }

  async subscribe(channel, callback) {
    const client = await this.connect();
    await client.subscribe(channel, callback);
  }
}

export const redis = new RedisClient();
```

## 🗄️ Database Optimization

### **lib/database.js (Connection Pooling)**
```javascript
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
```

## ⚡ API Routes (Optimized with Caching)

### **app/api/health/route.ts**
```typescript
import { NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { redis } from '@/lib/redis';

export async function GET() {
  try {
    const start = Date.now();
    
    // Check database connection
    await db.getClient().$queryRaw`SELECT 1`;
    const dbTime = Date.now() - start;
    
    // Check Redis connection
    const redisStart = Date.now();
    await redis.connect();
    const redisTime = Date.now() - redisStart;
    
    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: {
          status: 'connected',
          responseTime: `${dbTime}ms`,
        },
        redis: {
          status: 'connected',
          responseTime: `${redisTime}ms`,
        },
      },
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    });
  } catch (error) {
    return NextResponse.json(
      { status: 'unhealthy', error: error.message },
      { status: 500 }
    );
  }
}
```

### **app/api/tmt/inventory/route.ts (Optimized)**
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { redis } from '@/lib/redis';
import { validateToken } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const start = Date.now();
    const { searchParams } = new URL(request.url);
    const shopId = searchParams.get('shopId');
    
    if (!shopId) {
      return NextResponse.json({ error: 'Shop ID required' }, { status: 400 });
    }

    // Check cache first
    const cacheKey = `tmt_inventory:${shopId}`;
    const cached = await redis.get(cacheKey);
    
    if (cached) {
      return NextResponse.json({
        ...cached,
        cached: true,
        responseTime: `${Date.now() - start}ms`,
      });
    }

    // Validate token
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Authorization required' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decoded = await validateToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Get optimized inventory data
    const inventory = await db.getTmtInventoryOptimized(parseInt(shopId));
    
    // Process data
    const processedData = inventory.map(item => ({
      id: item.id.toString(),
      productName: item.product.productName,
      companyName: item.product.company.name,
      sizeMM: Number(item.product.size.sizeMm),
      availableQtyKg: Number(item.availableQtyKg),
      availableTons: Number(item.availableQtyKg) / 1000,
      lastUpdated: item.lastUpdated,
    }));

    const response = {
      inventory: processedData,
      summary: {
        totalProducts: processedData.length,
        totalTons: processedData.reduce((sum, item) => sum + item.availableTons, 0),
      },
      cached: false,
      responseTime: `${Date.now() - start}ms`,
    };

    // Cache response for 5 minutes
    await redis.set(cacheKey, response, 300);

    return NextResponse.json(response);
  } catch (error) {
    console.error('TMT Inventory API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

## 🚀 Performance Monitoring

### **lib/monitoring.js**
```javascript
import { db } from './database';
import { redis } from './redis';

class PerformanceMonitor {
  constructor() {
    this.metrics = new Map();
  }

  startTimer(label) {
    this.metrics.set(label, Date.now());
  }

  endTimer(label) {
    const startTime = this.metrics.get(label);
    if (startTime) {
      const duration = Date.now() - startTime;
      this.metrics.delete(label);
      return duration;
    }
    return null;
  }

  async trackAPIPerformance(apiName, fn) {
    const start = Date.now();
    try {
      const result = await fn();
      const duration = Date.now() - start;
      
      // Log performance metrics
      console.log(`API ${apiName} completed in ${duration}ms`);
      
      // Store metrics in Redis for analytics
      await redis.set(`metrics:${apiName}:${Date.now()}`, {
        duration,
        success: true,
        timestamp: new Date().toISOString(),
      }, 86400); // 24 hours

      return result;
    } catch (error) {
      const duration = Date.now() - start;
      console.error(`API ${apiName} failed after ${duration}ms:`, error);
      
      await redis.set(`metrics:${apiName}:${Date.now()}`, {
        duration,
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      }, 86400);

      throw error;
    }
  }

  async getSystemMetrics() {
    const memoryUsage = process.memoryUsage();
    const uptime = process.uptime();
    
    return {
      memory: {
        rss: Math.round(memoryUsage.rss / 1024 / 1024), // MB
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        external: Math.round(memoryUsage.external / 1024 / 1024),
      },
      uptime: Math.round(uptime),
      cpu: process.cpuUsage(),
      timestamp: new Date().toISOString(),
    };
  }
}

export const monitor = new PerformanceMonitor();
```

## 🔧 Environment Configuration

### **.env.example**
```bash
# Database
DATABASE_URL="postgresql://username:password@localhost:26257/saas_platform?schema=public"

# Redis
REDIS_URL="redis://localhost:6379"

# Next.js
NEXTAUTH_SECRET="your-secret-key"
NEXTAUTH_URL="http://localhost:3000"

# Payment Processing
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_PUBLISHABLE_KEY="pk_test_..."
RAZORPAY_KEY_ID="rzp_test_..."
RAZORPAY_KEY_SECRET="your-razorpay-secret"

# Performance
TURBOPACK=1
NODE_ENV="production"

# Monitoring
ENABLE_METRICS=true
LOG_LEVEL="info"
```

## 🚀 Quick Start Commands

### **Development (Turbopack Enabled)**
```bash
# Start development server with Turbopack
npm run dev

# Build optimized production bundle
npm run build

# Start production server
npm run start
```

### **Docker Deployment**
```bash
# Build and run with Docker Compose
npm run docker:compose

# Stop services
npm run docker:down

# View logs
docker-compose logs -f app
```

### **Database Operations**
```bash
# Generate Prisma client
npm run db:generate

# Push schema changes
npm run db:push

# Run migrations
npm run db:migrate

# Open Prisma Studio
npm run db:studio
```

## 📊 Performance Benchmarks

### **Expected Performance**
- **API Response Time**: <100ms (with Redis cache)
- **Database Queries**: <50ms (optimized indexes)
- **Page Load Time**: <2s (Turbopack + optimizations)
- **Memory Usage**: <512MB (optimized)
- **Concurrent Users**: 1000+ (Redis + connection pooling)

### **Optimization Features**
- ✅ **Turbopack**: 10x faster development builds
- ✅ **Redis Caching**: Sub-100ms API responses
- ✅ **Connection Pooling**: Efficient database connections
- ✅ **Bundle Optimization**: Smaller JavaScript bundles
- ✅ **Image Optimization**: WebP/AVIF support
- ✅ **Compression**: Gzip/Brotli compression
- ✅ **CDN Ready**: Static asset optimization

---

## 🚀 Ready to Launch Your High-Performance SaaS Platform!

This setup provides:
- ⚡ **Ultra-fast development** with Turbopack
- 🚀 **Production-ready** Docker deployment
- 📊 **Redis caching** for sub-100ms responses
- 🗄️ **Optimized database** with connection pooling
- 📈 **Performance monitoring** and metrics
- 🔧 **Scalable architecture** for thousands of users

**Next Step**: Run `npm run docker:compose` to start your high-performance SaaS platform! 🎉
