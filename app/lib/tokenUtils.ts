/**
 * Optimized token validation.
 *
 * BEFORE: jwt.verify() → prisma.loginLog.findFirst() [40-80ms DB call]
 * AFTER:  jwt.verify() → redis.isTokenBlacklisted()  [1-3ms Redis call]
 *
 * New tokens include a `jti` (JWT ID) field so individual tokens can be
 * blacklisted on logout without querying the database.
 */
import jwt from 'jsonwebtoken';
import { redis } from '@/lib/redis';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface DecodedToken {
  userId: number;           // numeric (matches Prisma BigInt → Number flow)
  email: string;
  role: string;
  jti?: string;             // present on tokens issued after this update
  iat?: number;
  exp?: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getJwtSecret(): string {
  let secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set');
  }
  // Decode base64-encoded secrets (legacy support)
  try {
    if (/^[A-Za-z0-9+/]+=*$/.test(secret)) {
      secret = Buffer.from(secret, 'base64').toString('utf-8');
    }
  } catch {
    // Use as-is
  }
  return secret;
}

// ─── Main validator ───────────────────────────────────────────────────────────
export async function validateToken(token: string): Promise<DecodedToken | null> {
  // Quick sanity checks (avoids expensive jwt.verify on obviously bad inputs)
  if (!token || token === 'undefined' || token === 'null' || token.length < 10) {
    return null;
  }

  let decoded: DecodedToken;
  try {
    decoded = jwt.verify(token, getJwtSecret(), {
      issuer: 'building-materials-inventory',
      audience: 'building-materials-users',
    }) as DecodedToken;
  } catch {
    return null;
  }

  // Check Redis blacklist (replaces DB loginLog query — 40× faster)
  if (decoded.jti) {
    const blacklisted = await redis.isTokenBlacklisted(decoded.jti);
    if (blacklisted) return null;
  } else {
    // Legacy tokens without jti: fall back to approximate logout check via Redis
    // If a legacy-logout key exists for this userId issued before the token, reject it.
    const logoutTs = await redis.get<number>(`logout:user:${decoded.userId}`);
    if (logoutTs && decoded.iat && decoded.iat < logoutTs) return null;
  }

  return decoded;
}

// ─── Generate tokens with jti ─────────────────────────────────────────────────
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export function generateTokenPair(
  userId: number | string | bigint,
  email: string,
  role: string,
): TokenPair {
  const secret = getJwtSecret();
  const refreshSecret = (() => {
    let s = process.env.JWT_REFRESH_SECRET ?? process.env.JWT_SECRET!;
    try {
      if (/^[A-Za-z0-9+/]+=*$/.test(s)) s = Buffer.from(s, 'base64').toString('utf-8');
    } catch { /* use as-is */ }
    return s;
  })();

  const { randomUUID } = require('crypto') as typeof import('crypto');
  const jti = randomUUID();
  const numericId = Number(userId);

  const accessToken = jwt.sign(
    { userId: numericId, email, role, jti },
    secret,
    {
      expiresIn: '15m',          // ← short-lived (was 24h)
      issuer: 'building-materials-inventory',
      audience: 'building-materials-users',
      algorithm: 'HS256',
    },
  );

  const refreshToken = jwt.sign(
    { userId: numericId, type: 'refresh' },
    refreshSecret,
    {
      expiresIn: '7d',
      issuer: 'building-materials-inventory',
      audience: 'building-materials-users',
      algorithm: 'HS256',
    },
  );

  return { accessToken, refreshToken };
}

/**
 * Blacklist an access token on logout.
 * TTL = remaining lifetime of the token (max 15 min for new tokens).
 */
export async function blacklistToken(token: string): Promise<void> {
  try {
    const decoded = jwt.decode(token) as any;
    if (!decoded) return;

    if (decoded.jti) {
      // New-style token: blacklist by jti
      const remainingTtl = Math.max((decoded.exp ?? 0) - Math.floor(Date.now() / 1000), 1);
      await redis.blacklistToken(decoded.jti, remainingTtl);
    } else {
      // Legacy token: record logout timestamp per user so old tokens are rejected
      const remainingTtl = Math.max((decoded.exp ?? 0) - Math.floor(Date.now() / 1000), 86400);
      await redis.set(
        `logout:user:${decoded.userId}`,
        Math.floor(Date.now() / 1000),
        remainingTtl,
      );
    }
  } catch {
    /* silent — worst case legacy token stays valid until natural expiry */
  }
}