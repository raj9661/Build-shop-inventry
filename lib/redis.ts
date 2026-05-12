/**
 * Optimized Redis client — singleton with eager connection, typed helpers.
 * Replaces lib/redis.js.
 * - Pre-connects on first import (no per-call lazy connect overhead)
 * - Typed get<T> / set / del / exists / blacklist helpers
 * - Graceful fallback (no throws) when Redis is unavailable
 */
import { createClient, RedisClientType } from 'redis';

// ─── Singleton ────────────────────────────────────────────────────────────────
let _client: RedisClientType | null = null;
let _connecting = false;
let _errorLogged = false;

async function getClient(): Promise<RedisClientType | null> {
  if (_client?.isOpen) return _client;
  if (_connecting) return null;

  _connecting = true;
  try {
    const c = createClient({
      url: process.env.REDIS_URL ?? 'redis://localhost:6379',
      socket: {
        connectTimeout: 3000,
        reconnectStrategy: (retries) =>
          retries > 5 ? new Error('Redis retry exhausted') : retries * 100,
      },
    }) as RedisClientType;

    c.on('error', (err: Error) => {
      if (!_errorLogged) {
        console.warn('⚠️  Redis unavailable — caching disabled:', err.message);
        _errorLogged = true;
      }
      _client = null;
    });

    c.on('connect', () => {
      console.log('✅ Redis connected');
      _errorLogged = false;
    });

    await c.connect();
    _client = c;
    return _client;
  } catch (err: any) {
    if (!_errorLogged) {
      console.warn('⚠️  Redis connection failed:', err.message);
      _errorLogged = true;
    }
    return null;
  } finally {
    _connecting = false;
  }
}

// ─── Typed helpers ────────────────────────────────────────────────────────────
export const redis = {
  /** Get a parsed JSON value, or null on miss/error */
  async get<T = unknown>(key: string): Promise<T | null> {
    const c = await getClient();
    if (!c) return null;
    try {
      const raw = await c.get(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  },

  /** Set a JSON value with TTL in seconds (default 5 min) */
  async set(key: string, value: unknown, ttlSeconds = 300): Promise<void> {
    const c = await getClient();
    if (!c) return;
    try {
      await c.setEx(key, ttlSeconds, JSON.stringify(value));
    } catch {
      /* silent — cache is best-effort */
    }
  },

  /** Delete one or more keys */
  async del(...keys: string[]): Promise<void> {
    const c = await getClient();
    if (!c || keys.length === 0) return;
    try {
      await c.del(keys);
    } catch {
      /* silent */
    }
  },

  /** Check if a key exists (returns 0 or 1) */
  async exists(key: string): Promise<number> {
    const c = await getClient();
    if (!c) return 0;
    try {
      return await c.exists(key);
    } catch {
      return 0;
    }
  },

  /** Blacklist a JWT jti — used on logout */
  async blacklistToken(jti: string, ttlSeconds: number): Promise<void> {
    const c = await getClient();
    if (!c) return;
    try {
      await c.setEx(`token:blacklist:${jti}`, ttlSeconds, '1');
    } catch {
      /* silent */
    }
  },

  /** Check if a JWT jti is blacklisted */
  async isTokenBlacklisted(jti: string): Promise<boolean> {
    const c = await getClient();
    if (!c) return false; // Fail open when Redis is down
    try {
      return (await c.exists(`token:blacklist:${jti}`)) === 1;
    } catch {
      return false;
    }
  },

  /**
   * Sliding-window rate limit.
   * Returns true if the request is allowed (within limit).
   */
  async rateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
    const c = await getClient();
    if (!c) return true; // Fail open when Redis is down
    try {
      const current = await c.incr(key);
      if (current === 1) await c.expire(key, windowSeconds);
      return current <= limit;
    } catch {
      return true;
    }
  },

  /** Delete all keys matching a glob pattern (use sparingly — O(N)) */
  async delPattern(pattern: string): Promise<void> {
    const c = await getClient();
    if (!c) return;
    try {
      let cursor = 0;
      do {
        const result = await c.scan(cursor, { MATCH: pattern, COUNT: 100 });
        cursor = result.cursor;
        if (result.keys.length > 0) await c.del(result.keys);
      } while (cursor !== 0);
    } catch {
      /* silent */
    }
  },

  /** Expose raw client for advanced ops (SINTERSTORE, pipelines, etc.) */
  get raw(): RedisClientType | null {
    return _client;
  },

  // ─── Legacy compat helpers (used by existing code in redis.js) ──────────────
  async cacheUser(userId: string | number | bigint, data: unknown, ttl = 1800) {
    await redis.set(`user:${userId}`, data, ttl);
  },
  async getCachedUser(userId: string | number | bigint) {
    return redis.get(`user:${userId}`);
  },
  async cacheShopData(shopId: string | number | bigint, data: unknown, ttl = 1800) {
    await redis.set(`shop:${shopId}`, data, ttl);
  },
  async getCachedShopData(shopId: string | number | bigint) {
    return redis.get(`shop:${shopId}`);
  },
  async setSession(sessionId: string, data: unknown, ttl = 86400) {
    await redis.set(`session:${sessionId}`, data, ttl);
  },
  async getSession(sessionId: string) {
    return redis.get(`session:${sessionId}`);
  },
  async deleteSession(sessionId: string) {
    await redis.del(`session:${sessionId}`);
  },
};

// ─── Pre-connect on module load (avoids first-request latency spike) ──────────
getClient().catch(() => {});

export default redis;
