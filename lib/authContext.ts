/**
 * getAuthContext — single entry point for all auth + RBAC checks.
 *
 * Replaces the scattered pattern of:
 *   validateToken(token) → prisma.user.findUnique (role check)
 *                        → prisma.userShopAssignment.findMany (shop check)
 *
 * AFTER: 0 DB calls on cache-hit (Redis TTL 5 min), 2 parallel DB calls on miss.
 *
 * Redis key: user:ctx:{userId}  TTL 300s
 */
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { validateToken } from '@/app/lib/tokenUtils';
import type { NextRequest } from 'next/server';

// ─── Roles that can access ALL shops ─────────────────────────────────────────
const GLOBAL_ACCESS_ROLES = new Set(['PLATFORM_OWNER', 'MODERATOR']);

// ─── Roles that access only the shops they CREATED ───────────────────────────
const CREATOR_ROLES = new Set(['SUPER_DUPER_ADMIN']);

// ─── Cached shape stored in Redis ────────────────────────────────────────────
interface CachedContext {
  userId: string;         // BigInt serialised as string
  email: string;
  role: string;
  isActive: boolean;
  shopIds: string[];      // BigInt[] serialised as string[]
  canAccessAllShops: boolean;
}

// ─── Public shape returned to callers ────────────────────────────────────────
export interface AuthContext {
  userId: bigint;
  email: string;
  role: string;
  shopIds: bigint[];
  canAccessAllShops: boolean;
  /** true when user's role grants global access (PLATFORM_OWNER / MODERATOR) */
  isGlobalAdmin: boolean;
}

// ─── Core ─────────────────────────────────────────────────────────────────────

/**
 * Extract and validate the Bearer token from the request, then resolve the
 * user's AuthContext (from Redis cache or DB with parallel queries).
 *
 * Returns null when:
 *  - No / invalid Authorization header
 *  - Token is expired or blacklisted
 *  - User is inactive or not found
 */
export async function getAuthContext(req: NextRequest): Promise<AuthContext | null> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.substring(7);
  const decoded = await validateToken(token);
  if (!decoded) return null;

  return resolveAuthContext(decoded.userId);
}

/**
 * Resolve an AuthContext directly from a userId (useful in middleware or
 * when the token has already been decoded upstream).
 */
export async function resolveAuthContext(userId: number | bigint): Promise<AuthContext | null> {
  const cacheKey = `user:ctx:${userId}`;

  // ── 1. Try Redis ────────────────────────────────────────────────────────────
  const cached = await redis.get<CachedContext>(cacheKey);
  if (cached) {
    if (!cached.isActive) return null;
    return deserialise(cached);
  }

  // ── 2. Cache miss — parallel DB queries ────────────────────────────────────
  const userIdBigInt = BigInt(userId);

  const [user, assignments] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userIdBigInt },
      select: { id: true, email: true, role: true, isActive: true },
    }),
    prisma.userShopAssignment.findMany({
      where: { userId: userIdBigInt, active: true },
      select: { shopId: true },
    }),
  ]);

  if (!user || !user.isActive) return null;

  // Resolve shopIds depending on role
  let shopIds: bigint[] = assignments.map((a) => a.shopId);
  let canAccessAllShops = false;

  if (GLOBAL_ACCESS_ROLES.has(user.role)) {
    // PLATFORM_OWNER / MODERATOR → all active shops
    const allShops = await prisma.shop.findMany({
      where: { isActive: true },
      select: { id: true },
    });
    shopIds = allShops.map((s) => s.id);
    canAccessAllShops = true;
  } else if (CREATOR_ROLES.has(user.role)) {
    // SUPER_DUPER_ADMIN → shops they created
    const createdShops = await prisma.shop.findMany({
      where: { createdBy: user.id, isActive: true },
      select: { id: true },
    });
    shopIds = createdShops.map((s) => s.id);
    canAccessAllShops = true;
  }

  // ── 3. Write to Redis ───────────────────────────────────────────────────────
  const toCache: CachedContext = {
    userId: user.id.toString(),
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    shopIds: shopIds.map(String),
    canAccessAllShops,
  };
  await redis.set(cacheKey, toCache, 300); // 5-min TTL

  return {
    userId: user.id,
    email: user.email,
    role: user.role,
    shopIds,
    canAccessAllShops,
    isGlobalAdmin: GLOBAL_ACCESS_ROLES.has(user.role),
  };
}

// ─── Access-check helpers (pure, no DB/network) ───────────────────────────────

/** Returns true if the context grants access to the given shopId */
export function requireShopAccess(ctx: AuthContext, shopId: bigint | number): boolean {
  if (ctx.canAccessAllShops) return true;
  const target = BigInt(shopId);
  return ctx.shopIds.some((id) => id === target);
}

/** Throw-style helper — returns a 403 NextResponse or null if allowed */
import { NextResponse } from 'next/server';

export function assertShopAccess(
  ctx: AuthContext,
  shopId: bigint | number,
): NextResponse | null {
  if (requireShopAccess(ctx, shopId)) return null;
  return NextResponse.json({ success: false, message: 'Forbidden: no access to this shop' }, { status: 403 });
}

/** Returns a Prisma `where` clause that scopes queries to the user's shops */
export function getShopWhereClause(ctx: AuthContext): { shopId: { in: bigint[] } } | Record<string, never> {
  if (ctx.canAccessAllShops && ctx.shopIds.length === 0) return {};
  return { shopId: { in: ctx.shopIds } };
}

// ─── Cache invalidation ───────────────────────────────────────────────────────

/** Call this after changing a user's role or shop assignments */
export async function invalidateUserContext(userId: bigint | number): Promise<void> {
  await redis.del(`user:ctx:${userId}`);
}

/** Call this after creating/cancelling a sale or modifying shop-level data */
export async function invalidateShopDashboard(shopId: bigint | number): Promise<void> {
  const date = new Date().toISOString().slice(0, 10);
  await redis.del(`dashboard:${shopId}:${date}`);
}

// ─── Internal ─────────────────────────────────────────────────────────────────
function deserialise(c: CachedContext): AuthContext {
  return {
    userId: BigInt(c.userId),
    email: c.email,
    role: c.role,
    shopIds: c.shopIds.map(BigInt),
    canAccessAllShops: c.canAccessAllShops,
    isGlobalAdmin: GLOBAL_ACCESS_ROLES.has(c.role),
  };
}
