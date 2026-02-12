import redisService from './redis-service';

// Rate limiting configuration
const RATE_LIMIT_CONFIG = {
  // Login attempts
  login: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxAttempts: 5,
    blockDuration: 30 * 60 * 1000, // 30 minutes block after 5 failed attempts
  },
  // 2FA attempts
  twoFactor: {
    windowMs: 5 * 60 * 1000, // 5 minutes
    maxAttempts: 3,
    blockDuration: 15 * 60 * 1000, // 15 minutes block after 3 failed attempts
  },
  // Password change attempts
  passwordChange: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxAttempts: 3,
    blockDuration: 60 * 60 * 1000, // 1 hour block after 3 failed attempts
  },
  // General API requests
  api: {
    windowMs: 60 * 1000, // 1 minute
    maxAttempts: 100,
    blockDuration: 5 * 60 * 1000, // 5 minutes block
  },
  // Search requests
  search: {
    windowMs: 60 * 1000, // 1 minute
    maxAttempts: 30,
    blockDuration: 5 * 60 * 1000, // 5 minutes block
  },
};

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  blocked: boolean;
  blockTimeRemaining: number;
}

class RateLimiter {
  private getKey(type: string, identifier: string): string {
    return `rate_limit:${type}:${identifier}`;
  }

  private getBlockKey(type: string, identifier: string): string {
    return `rate_limit_block:${type}:${identifier}`;
  }

  private isLocalhost(ipAddress?: string): boolean {
    if (!ipAddress) return false;
    
    // Check for localhost IPs
    const localhostIPs = [
      '127.0.0.1',
      '::1',
      'localhost',
      '::ffff:127.0.0.1'
    ];
    
    // Check for development environment
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    return localhostIPs.includes(ipAddress) || isDevelopment;
  }

  async checkRateLimit(
    type: keyof typeof RATE_LIMIT_CONFIG,
    identifier: string,
    ipAddress?: string
  ): Promise<RateLimitResult> {
    const config = RATE_LIMIT_CONFIG[type];
    
    // Skip rate limiting for localhost/development environment
    if (this.isLocalhost(ipAddress)) {
      return {
        allowed: true,
        remaining: config.maxAttempts,
        resetTime: Date.now() + config.windowMs,
        blocked: false,
        blockTimeRemaining: 0,
      };
    }
    
    const key = this.getKey(type, identifier);
    const blockKey = this.getBlockKey(type, identifier);

    try {
      // Check if user is blocked
      const isBlocked = await redisService.get<boolean>(blockKey);
      if (isBlocked) {
        const blockExpiry = await redisService.get<number>(`${blockKey}:expiry`);
        const blockTimeRemaining = blockExpiry ? Math.max(0, blockExpiry - Date.now()) : 0;
        
        return {
          allowed: false,
          remaining: 0,
          resetTime: Date.now() + blockTimeRemaining,
          blocked: true,
          blockTimeRemaining,
        };
      }

      // Get current attempts
      const attempts = await redisService.get<number[]>(key) || [];
      const now = Date.now();
      const windowStart = now - config.windowMs;

      // Filter attempts within the current window
      const recentAttempts = attempts.filter(timestamp => timestamp > windowStart);

      // Check if limit exceeded
      if (recentAttempts.length >= config.maxAttempts) {
        // Block the user
        await redisService.set(blockKey, true, Math.floor(config.blockDuration / 1000));
        await redisService.set(`${blockKey}:expiry`, now + config.blockDuration, Math.floor(config.blockDuration / 1000));

        return {
          allowed: false,
          remaining: 0,
          resetTime: now + config.blockDuration,
          blocked: true,
          blockTimeRemaining: config.blockDuration,
        };
      }

      // Add current attempt
      recentAttempts.push(now);
      await redisService.set(key, recentAttempts, Math.floor(config.windowMs / 1000));

      return {
        allowed: true,
        remaining: config.maxAttempts - recentAttempts.length,
        resetTime: now + config.windowMs,
        blocked: false,
        blockTimeRemaining: 0,
      };
    } catch (error) {
      console.error('Rate limit check error:', error);
      // If Redis fails, allow the request (fail open) - this is a security consideration
      // In production, you might want to fail closed for critical operations
      return {
        allowed: true,
        remaining: config.maxAttempts,
        resetTime: Date.now() + config.windowMs,
        blocked: false,
        blockTimeRemaining: 0,
      };
    }
  }

  async recordAttempt(
    type: keyof typeof RATE_LIMIT_CONFIG,
    identifier: string,
    success: boolean = true
  ): Promise<void> {
    // Skip recording attempts for localhost/development environment
    if (this.isLocalhost()) {
      return;
    }
    
    const key = this.getKey(type, identifier);
    const successKey = `${key}:success`;
    const failureKey = `${key}:failure`;

    try {
      if (success) {
        // Record successful attempt
        const successes = await redisService.get<number[]>(successKey) || [];
        successes.push(Date.now());
        await redisService.set(successKey, successes, 3600); // Keep for 1 hour
      } else {
        // Record failed attempt
        const failures = await redisService.get<number[]>(failureKey) || [];
        failures.push(Date.now());
        await redisService.set(failureKey, failures, 3600); // Keep for 1 hour
      }
    } catch (error) {
      console.error('Rate limit record error:', error);
      // Fail silently - don't break the application flow
    }
  }

  async getRateLimitInfo(
    type: keyof typeof RATE_LIMIT_CONFIG,
    identifier: string
  ): Promise<{
    attempts: number;
    successes: number;
    failures: number;
    remaining: number;
    resetTime: number;
    blocked: boolean;
    blockTimeRemaining: number;
  }> {
    const config = RATE_LIMIT_CONFIG[type];
    const key = this.getKey(type, identifier);
    const blockKey = this.getBlockKey(type, identifier);

    try {
      const [attempts, successes, failures, isBlocked, blockExpiry] = await Promise.all([
        redisService.get<number[]>(key),
        redisService.get<number[]>(`${key}:success`),
        redisService.get<number[]>(`${key}:failure`),
        redisService.get<boolean>(blockKey),
        redisService.get<number>(`${blockKey}:expiry`),
      ]);

      const now = Date.now();
      const windowStart = now - config.windowMs;

      const recentAttempts = attempts?.filter(timestamp => timestamp > windowStart) || [];
      const recentSuccesses = successes?.filter(timestamp => timestamp > windowStart) || [];
      const recentFailures = failures?.filter(timestamp => timestamp > windowStart) || [];

      const blockTimeRemaining = isBlocked && blockExpiry ? Math.max(0, blockExpiry - now) : 0;

      return {
        attempts: recentAttempts.length,
        successes: recentSuccesses.length,
        failures: recentFailures.length,
        remaining: Math.max(0, config.maxAttempts - recentAttempts.length),
        resetTime: now + config.windowMs,
        blocked: !!isBlocked,
        blockTimeRemaining,
      };
    } catch (error) {
      console.error('Rate limit info error:', error);
      return {
        attempts: 0,
        successes: 0,
        failures: 0,
        remaining: config.maxAttempts,
        resetTime: Date.now() + config.windowMs,
        blocked: false,
        blockTimeRemaining: 0,
      };
    }
  }

  async resetRateLimit(
    type: keyof typeof RATE_LIMIT_CONFIG,
    identifier: string
  ): Promise<void> {
    const key = this.getKey(type, identifier);
    const blockKey = this.getBlockKey(type, identifier);

    try {
      await Promise.all([
        redisService.del(key),
        redisService.del(`${key}:success`),
        redisService.del(`${key}:failure`),
        redisService.del(blockKey),
        redisService.del(`${blockKey}:expiry`),
      ]);
    } catch (error) {
      console.error('Rate limit reset error:', error);
    }
  }

  async getGlobalStats(): Promise<{
    totalBlocked: number;
    totalAttempts: number;
    blockedUsers: string[];
  }> {
    try {
      const [blockedKeys, attemptKeys] = await Promise.all([
        redisService.keys('rate_limit_block:*'),
        redisService.keys('rate_limit:*'),
      ]);

      const blockedUsers = blockedKeys.map(key => key.split(':')[2]);
      const totalAttempts = attemptKeys.length;

      return {
        totalBlocked: blockedUsers.length,
        totalAttempts,
        blockedUsers,
      };
    } catch (error) {
      console.error('Global stats error:', error);
      return {
        totalBlocked: 0,
        totalAttempts: 0,
        blockedUsers: [],
      };
    }
  }
}

// Singleton instance
const rateLimiter = new RateLimiter();

export default rateLimiter;
export { RATE_LIMIT_CONFIG }; 