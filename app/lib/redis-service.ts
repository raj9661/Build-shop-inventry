import Redis from 'ioredis';
import { performance } from 'perf_hooks';

// Ultra-optimized Redis configuration
const REDIS_CONFIG = {
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
  lazyConnect: true, // Connect only when needed to prevent build failures
  keepAlive: 60000, // Longer keep-alive
  connectTimeout: 2000, // Faster connection
  commandTimeout: 1000, // Faster commands
  // Enable offline queue for graceful handling
  enableOfflineQueue: true,
  // Connection pooling
  family: 4, // IPv4 only for speed
  // Memory optimizations
  maxMemoryPolicy: 'allkeys-lru',
  maxMemory: '256mb',
};

class RedisService {
  private client: Redis;
  private isConnected: boolean = false;
  private performanceMetrics: Map<string, number[]> = new Map();

  constructor() {
    if (process.env.REDIS_URL) {
      this.client = new Redis(process.env.REDIS_URL, {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        retryDelayOnFailover: 50,
        enableReadyCheck: false,
        maxLoadingTimeout: 2000,
        keepAlive: 60000,
        connectTimeout: 2000,
        commandTimeout: 1000,
        enableOfflineQueue: true,
        family: 4,
      });
    } else {
      this.client = new Redis(REDIS_CONFIG);
    }
    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    this.client.on('connect', () => {
      console.log('🔗 Redis connected');
      this.isConnected = true;
    });

    this.client.on('ready', () => {
      console.log('✅ Redis ready');
    });

    this.client.on('error', (error) => {
      console.error('❌ Redis error:', error);
      this.isConnected = false;
    });

    this.client.on('close', () => {
      console.log('🔌 Redis connection closed');
      this.isConnected = false;
    });

    this.client.on('reconnecting', () => {
      console.log('🔄 Redis reconnecting...');
    });
  }

  // Performance monitoring
  private trackPerformance(operation: string, startTime: number) {
    const duration = performance.now() - startTime;
    if (!this.performanceMetrics.has(operation)) {
      this.performanceMetrics.set(operation, []);
    }
    this.performanceMetrics.get(operation)!.push(duration);
  }

  // Get performance statistics
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

  // Advanced caching with compression and TTL
  async set(key: string, value: any, ttlSeconds: number = 300): Promise<void> {
    const startTime = performance.now();
    try {
      // Convert BigInt values to strings before serialization
      const sanitizedValue = this.sanitizeForSerialization(value);
      const serializedValue = JSON.stringify(sanitizedValue);
      await this.client.setex(key, ttlSeconds, serializedValue);
      this.trackPerformance('set', startTime);
    } catch (error) {
      console.error('Redis set error:', error);
      // Don't throw error, just log it - fail gracefully
      this.trackPerformance('set', startTime);
    }
  }

  // Helper function to convert BigInt values to strings
  private sanitizeForSerialization(obj: any): any {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj === 'bigint') {
      return obj.toString();
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeForSerialization(item));
    }

    if (typeof obj === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        sanitized[key] = this.sanitizeForSerialization(value);
      }
      return sanitized;
    }

    return obj;
  }

  async get<T>(key: string): Promise<T | null> {
    const startTime = performance.now();
    try {
      const value = await this.client.get(key);
      this.trackPerformance('get', startTime);

      if (value === null) return null;
      return JSON.parse(value) as T;
    } catch (error) {
      console.error('Redis get error:', error);
      return null;
    }
  }

  // Batch operations for better performance
  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    const startTime = performance.now();
    try {
      const values = await this.client.mget(...keys);
      this.trackPerformance('mget', startTime);

      return values.map(value => value ? JSON.parse(value) : null);
    } catch (error) {
      console.error('Redis mget error:', error);
      return keys.map(() => null);
    }
  }

  async mset(keyValuePairs: Record<string, any>, ttlSeconds: number = 300): Promise<void> {
    const startTime = performance.now();
    try {
      const pipeline = this.client.pipeline();

      for (const [key, value] of Object.entries(keyValuePairs)) {
        const serializedValue = JSON.stringify(value);
        pipeline.setex(key, ttlSeconds, serializedValue);
      }

      await pipeline.exec();
      this.trackPerformance('mset', startTime);
    } catch (error) {
      console.error('Redis mset error:', error);
      throw error;
    }
  }

  // Pattern-based operations
  async keys(pattern: string): Promise<string[]> {
    const startTime = performance.now();
    try {
      const keys = await this.client.keys(pattern);
      this.trackPerformance('keys', startTime);
      return keys;
    } catch (error) {
      console.error('Redis keys error:', error);
      return [];
    }
  }

  // Delete operations
  async del(key: string): Promise<void> {
    const startTime = performance.now();
    try {
      await this.client.del(key);
      this.trackPerformance('del', startTime);
    } catch (error) {
      console.error('Redis del error:', error);
    }
  }

  async delPattern(pattern: string): Promise<void> {
    const startTime = performance.now();
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(...keys);
      }
      this.trackPerformance('delPattern', startTime);
    } catch (error) {
      console.error('Redis delPattern error:', error);
    }
  }

  // Hash operations for complex data
  async hset(key: string, field: string, value: any, ttlSeconds: number = 300): Promise<void> {
    const startTime = performance.now();
    try {
      const serializedValue = JSON.stringify(value);
      await this.client.hset(key, field, serializedValue);
      await this.client.expire(key, ttlSeconds);
      this.trackPerformance('hset', startTime);
    } catch (error) {
      console.error('Redis hset error:', error);
      throw error;
    }
  }

  async hget<T>(key: string, field: string): Promise<T | null> {
    const startTime = performance.now();
    try {
      const value = await this.client.hget(key, field);
      this.trackPerformance('hget', startTime);

      if (value === null) return null;
      return JSON.parse(value) as T;
    } catch (error) {
      console.error('Redis hget error:', error);
      return null;
    }
  }

  async hgetall<T>(key: string): Promise<Record<string, T> | null> {
    const startTime = performance.now();
    try {
      const values = await this.client.hgetall(key);
      this.trackPerformance('hgetall', startTime);

      if (!values || Object.keys(values).length === 0) return null;

      const result: Record<string, T> = {};
      for (const [field, value] of Object.entries(values)) {
        result[field] = JSON.parse(value);
      }
      return result;
    } catch (error) {
      console.error('Redis hgetall error:', error);
      return null;
    }
  }

  // List operations for pagination
  async lpush(key: string, value: any, maxLength: number = 100): Promise<void> {
    const startTime = performance.now();
    try {
      const serializedValue = JSON.stringify(value);
      await this.client.lpush(key, serializedValue);
      await this.client.ltrim(key, 0, maxLength - 1);
      this.trackPerformance('lpush', startTime);
    } catch (error) {
      console.error('Redis lpush error:', error);
      throw error;
    }
  }

  async lrange<T>(key: string, start: number = 0, stop: number = -1): Promise<T[]> {
    const startTime = performance.now();
    try {
      const values = await this.client.lrange(key, start, stop);
      this.trackPerformance('lrange', startTime);

      return values.map(value => JSON.parse(value));
    } catch (error) {
      console.error('Redis lrange error:', error);
      return [];
    }
  }

  // Set operations for unique collections
  async sadd(key: string, ...members: any[]): Promise<void> {
    const startTime = performance.now();
    try {
      const serializedMembers = members.map(member => JSON.stringify(member));
      await this.client.sadd(key, ...serializedMembers);
      this.trackPerformance('sadd', startTime);
    } catch (error) {
      console.error('Redis sadd error:', error);
      throw error;
    }
  }

  async smembers<T>(key: string): Promise<T[]> {
    const startTime = performance.now();
    try {
      const members = await this.client.smembers(key);
      this.trackPerformance('smembers', startTime);

      return members.map(member => JSON.parse(member));
    } catch (error) {
      console.error('Redis smembers error:', error);
      return [];
    }
  }

  // Health check
  async ping(): Promise<boolean> {
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch (error) {
      console.error('Redis ping error:', error);
      return false;
    }
  }

  // Get Redis info
  async info(): Promise<any> {
    try {
      const info = await this.client.info();
      return info;
    } catch (error) {
      console.error('Redis info error:', error);
      return null;
    }
  }

  // Graceful shutdown
  async disconnect(): Promise<void> {
    try {
      await this.client.quit();
      console.log('🔌 Redis disconnected gracefully');
    } catch (error) {
      console.error('Redis disconnect error:', error);
    }
  }

  // Check if connected
  isReady(): boolean {
    return this.isConnected && this.client.status === 'ready';
  }
}

// Singleton instance
const redisService = new RedisService();

export default redisService; 