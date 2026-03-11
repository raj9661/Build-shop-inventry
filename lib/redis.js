import { createClient } from 'redis';

class RedisClient {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.connectionErrorLogged = false;
  }

  async connect() {
    if (this.isConnected && this.client) return this.client;

    if (!this.client) {
      this.client = createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        socket: {
          reconnectStrategy: (retries) => {
            // Limit retries to prevent infinite loops if Redis is permanently down
            if (retries > 5) return new Error('Redis Retry Exhausted');
            return Math.min(retries * 100, 1000);
          },
          connectTimeout: 5000,
        },
      });

      this.client.on('error', (err) => {
        // Only log the first connection error to avoid console spam
        if (!this.connectionErrorLogged) {
          console.warn('⚠️ Redis Error (Caching Disabled):', err.message);
          this.connectionErrorLogged = true;
        }
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        console.log('✅ Redis connected');
        this.isConnected = true;
        this.connectionErrorLogged = false;
      });
    }

    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }
      return this.client;
    } catch (error) {
      if (!this.connectionErrorLogged) {
        console.warn('⚠️ Redis Connection Failed (Caching Disabled):', error.message);
        this.connectionErrorLogged = true;
      }
      this.isConnected = false;
      return null;
    }
  }

  async get(key) {
    const client = await this.connect();
    if (!client || !this.isConnected) return null;
    try {
      const value = await client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (e) {
      return null;
    }
  }

  async set(key, value, ttl = 3600) {
    const client = await this.connect();
    if (!client || !this.isConnected) return;
    try {
      await client.setEx(key, ttl, JSON.stringify(value));
    } catch (e) {
      console.error('Redis Set Error:', e.message);
    }
  }

  async del(key) {
    const client = await this.connect();
    if (!client || !this.isConnected) return;
    try {
      await client.del(key);
    } catch (e) {
      console.error('Redis Del Error:', e.message);
    }
  }

  async exists(key) {
    const client = await this.connect();
    if (!client || !this.isConnected) return false;
    try {
      return await client.exists(key);
    } catch (e) {
      return false;
    }
  }

  async flush() {
    const client = await this.connect();
    if (!client || !this.isConnected) return;
    try {
      await client.flushAll();
    } catch (e) {
      console.error('Redis Flush Error:', e.message);
    }
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
    if (!client || !this.isConnected) return true; // Fail open (allow request) if Redis is down

    try {
      const current = await client.incr(key);

      if (current === 1) {
        await client.expire(key, window);
      }

      return current <= limit;
    } catch (e) {
      return true; // Fail open
    }
  }

  // Real-time data
  async publish(channel, message) {
    const client = await this.connect();
    if (!client || !this.isConnected) return;
    try {
      await client.publish(channel, JSON.stringify(message));
    } catch (e) {
      console.error('Redis Publish Error:', e.message);
    }
  }

  async subscribe(channel, callback) {
    const client = await this.connect();
    if (!client || !this.isConnected) return;
    try {
      await client.subscribe(channel, callback);
    } catch (e) {
      console.error('Redis Subscribe Error:', e.message);
    }
  }
}



let redis;

if (process.env.NODE_ENV !== 'production') {
  if (!global.redis) {
    global.redis = new RedisClient();
  }
  redis = global.redis;
} else {
  redis = new RedisClient();
}

export { redis };
