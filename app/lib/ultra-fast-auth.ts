import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Redis from 'ioredis';
import { performance } from 'perf_hooks';

// Ultra-optimized Redis configuration
const ULTRA_REDIS_CONFIG = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0'),
  // Ultra-fast connection settings
  maxRetriesPerRequest: 1, // Reduced for speed
  retryDelayOnFailover: 50, // Faster retry
  enableReadyCheck: false, // Disable for speed
  maxLoadingTimeout: 2000, // Shorter timeout
  // Performance optimizations
  lazyConnect: false, // Connect immediately
  keepAlive: 60000, // Longer keep-alive
  connectTimeout: 2000, // Faster connection
  commandTimeout: 1000, // Faster commands
  // Disable features for speed
  enableOfflineQueue: false,
  // Connection pooling
  family: 4, // IPv4 only for speed
  // Memory optimizations
  maxMemoryPolicy: 'allkeys-lru',
  maxMemory: '256mb',
};

class UltraFastAuth {
  private prisma: PrismaClient;
  private redis: Redis;
  private userCache: Map<string, { data: any; timestamp: number }> = new Map();
  private passwordCache: Map<string, { hash: string; timestamp: number }> = new Map();
  private performanceMetrics: Map<string, number[]> = new Map();
  private readonly CACHE_TTL = 300000; // 5 minutes
  private readonly PASSWORD_CACHE_TTL = 600000; // 10 minutes

  constructor() {
    this.prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
      // Ultra-fast Prisma config
      log: ['error'], // Only log errors
    });

    if (process.env.REDIS_URL) {
      this.redis = new Redis(process.env.REDIS_URL, {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        enableReadyCheck: false,
        maxLoadingTimeout: 2000,
        keepAlive: 60000,
        connectTimeout: 2000,
        commandTimeout: 1000,
        enableOfflineQueue: true,
        family: 4,
        ...({ retryDelayOnFailover: 50 } as any)
      });
    } else {
      this.redis = new Redis({
        ...ULTRA_REDIS_CONFIG,
        lazyConnect: true,
        enableOfflineQueue: true
      });
    }
    this.setupRedisHandlers();
  }

  private setupRedisHandlers() {
    this.redis.on('connect', () => {
      console.log('⚡ Ultra-fast Redis connected');
    });

    this.redis.on('error', (error) => {
      console.error('❌ Redis error:', error);
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
    const stats: Record<string, any> = {};
    for (const [operation, times] of Array.from(this.performanceMetrics.entries())) {
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

  // Ultra-fast user lookup with multi-layer caching
  async getUserByEmail(email: string): Promise<any | null> {
    const startTime = performance.now();
    const normalizedEmail = email.toLowerCase();

    try {
      // 1. Check in-memory cache first (fastest)
      const memoryCache = this.userCache.get(normalizedEmail);
      if (memoryCache && Date.now() - memoryCache.timestamp < this.CACHE_TTL) {
        this.trackPerformance('user_lookup_memory', startTime);
        return memoryCache.data;
      }

      // 2. Check Redis cache (very fast)
      const redisKey = `user:${normalizedEmail}`;
      const redisData = await this.redis.get(redisKey);
      if (redisData) {
        const userData = JSON.parse(redisData);
        // Update memory cache
        this.userCache.set(normalizedEmail, {
          data: userData,
          timestamp: Date.now()
        });
        this.trackPerformance('user_lookup_redis', startTime);
        return userData;
      }

      // 3. Database lookup (slowest, but necessary)
      const user = await this.prisma.user.findUnique({
        where: { email: normalizedEmail },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          password: true,
          role: true,
          isActive: true,
          createdAt: true,
          lastLoginAt: true
        }
      });

      if (user) {
        // Cache in both Redis and memory
        const userForCache = { ...user } as any;
        delete userForCache.password; // Don't cache password

        // Parallel caching
        await Promise.all([
          this.redis.setex(redisKey, 300, JSON.stringify(userForCache)),
          this.userCache.set(normalizedEmail, {
            data: userForCache,
            timestamp: Date.now()
          })
        ]);
      }

      this.trackPerformance('user_lookup_db', startTime);
      return user;

    } catch (error) {
      console.error('User lookup error:', error);
      return null;
    }
  }

  // Ultra-fast password verification with caching
  async verifyPassword(email: string, password: string): Promise<boolean> {
    const startTime = performance.now();
    const normalizedEmail = email.toLowerCase();

    try {
      // Check password cache first
      const passwordCache = this.passwordCache.get(normalizedEmail);
      if (passwordCache && Date.now() - passwordCache.timestamp < this.PASSWORD_CACHE_TTL) {
        const isValid = await bcrypt.compare(password, passwordCache.hash);
        this.trackPerformance('password_verify_cache', startTime);
        return isValid;
      }

      // Get password from database
      const user = await this.prisma.user.findUnique({
        where: { email: normalizedEmail },
        select: { password: true, isActive: true }
      });

      if (!user || !user.isActive) {
        return false;
      }

      // Cache password hash
      this.passwordCache.set(normalizedEmail, {
        hash: user.password,
        timestamp: Date.now()
      });

      const isValid = await bcrypt.compare(password, user.password);
      this.trackPerformance('password_verify_db', startTime);
      return isValid;

    } catch (error) {
      console.error('Password verification error:', error);
      return false;
    }
  }

  // Ultra-fast token generation
  async generateTokens(user: any): Promise<{ token: string; refreshToken: string }> {
    const startTime = performance.now();

    try {
      const tokenPayload = {
        userId: user.id,
        email: user.email,
        role: user.role,
        iat: Math.floor(Date.now() / 1000)
      };

      // Decode base64 JWT secrets if they're encoded
      let jwtSecret = process.env.JWT_SECRET as string;
      let jwtRefreshSecret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET as string;

      try {
        if (jwtSecret.match(/^[A-Za-z0-9+/]+=*$/)) {
          jwtSecret = Buffer.from(jwtSecret, 'base64').toString('utf-8');
        }
        if (jwtRefreshSecret.match(/^[A-Za-z0-9+/]+=*$/)) {
          jwtRefreshSecret = Buffer.from(jwtRefreshSecret, 'base64').toString('utf-8');
        }
      } catch (decodeError) {
        // Use as-is if not base64
      }

      // Parallel token generation
      const [token, refreshToken] = await Promise.all([
        jwt.sign(tokenPayload, jwtSecret, {
          expiresIn: '24h',
          issuer: 'building-materials-inventory',
          audience: 'building-materials-users',
          algorithm: 'HS256'
        }),
        jwt.sign(
          { userId: user.id, type: 'refresh', iat: Math.floor(Date.now() / 1000) },
          jwtRefreshSecret,
          {
            expiresIn: '7d',
            issuer: 'building-materials-inventory',
            audience: 'building-materials-users',
            algorithm: 'HS256'
          }
        )
      ]);

      // Update last login asynchronously (don't wait)
      this.prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() }
      }).catch(console.error);

      this.trackPerformance('token_generation', startTime);
      return { token, refreshToken };

    } catch (error) {
      console.error('Token generation error:', error);
      throw error;
    }
  }

  // Ultra-fast login with all optimizations
  async login(email: string, password: string): Promise<any> {
    const startTime = performance.now();

    try {
      // Parallel user lookup and password verification
      const [user, isValidPassword] = await Promise.all([
        this.getUserByEmail(email),
        this.verifyPassword(email, password)
      ]);

      if (!user || !isValidPassword) {
        // Log failed login attempt
        await this.logLoginAttempt('0', email, false, 'Invalid credentials');
        return {
          success: false,
          message: 'Invalid credentials',
          code: 'INVALID_CREDENTIALS'
        };
      }

      // Log successful login attempt
      await this.logLoginAttempt(user.id, email, true);

      // Update lastLoginAt timestamp
      try {
        await this.prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() }
        });
        console.log(`✅ Updated lastLoginAt for user ${user.email}`);
      } catch (error) {
        console.error('❌ Failed to update lastLoginAt:', error);
      }

      // Generate tokens
      const tokens = await this.generateTokens(user);

      this.trackPerformance('login_total', startTime);

      return {
        success: true,
        data: {
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role
          },
          ...tokens
        }
      };

    } catch (error) {
      console.error('Login error:', error);
      // Log failed login attempt
      await this.logLoginAttempt('0', email, false, 'System error');
      return {
        success: false,
        message: 'Login failed',
        code: 'LOGIN_ERROR'
      };
    }
  }

  // Helper function to log login attempts
  async logLoginAttempt(
    userId: bigint | string,
    email: string,
    success: boolean,
    reason?: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    try {
      await this.prisma.loginLog.create({
        data: {
          userId: BigInt(userId),
          ipAddress: ipAddress || 'Unknown',
          userAgent: userAgent || 'Unknown',
          success,
          failureReason: success ? null : reason
        }
      });
      console.log(`✅ Ultra-fast login log created: ${success ? 'SUCCESS' : 'FAILED'} for ${email}`);
    } catch (error) {
      console.error('❌ Failed to create ultra-fast login log:', error);
    }
  }

  // Clear caches for a user
  async clearUserCaches(email: string): Promise<void> {
    const normalizedEmail = email.toLowerCase();

    await Promise.all([
      this.redis.del(`user:${normalizedEmail}`),
      this.userCache.delete(normalizedEmail),
      this.passwordCache.delete(normalizedEmail)
    ]);
  }

  // Get cache statistics
  getCacheStats() {
    return {
      userCacheSize: this.userCache.size,
      passwordCacheSize: this.passwordCache.size,
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
const ultraFastAuth = new UltraFastAuth();
export default ultraFastAuth; 