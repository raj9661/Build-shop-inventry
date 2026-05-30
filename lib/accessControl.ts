import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Role-based permissions
const ROLE_PERMISSIONS = {
  PLATFORM_OWNER: ['*'], // All permissions
  SUPER_DUPER_ADMIN: [
    'manage_own_account',
    'manage_own_shops',
    'manage_own_users',
    'view_own_analytics',
    'manage_own_subscription'
  ],
  SUPER_ADMIN: [
    'manage_own_shops',
    'manage_own_users',
    'view_shop_analytics',
    'manage_shop_settings'
  ],
  ADMIN: [
    'manage_own_shop',
    'manage_shop_users',
    'view_shop_data',
    'manage_shop_inventory'
  ],
  USER: [
    'view_own_data',
    'create_sales',
    'view_shop_inventory'
  ],
  STAFF: [
    'view_shop_data',
    'create_sales',
    'view_inventory'
  ],
  MODERATOR: [
    'manage_customers',
    'handle_violations',
    'manage_website_settings',
    'view_platform_analytics',
    'manage_support_tickets'
  ],
  CREATOR: [
    'manage_content',
    'manage_seo',
    'manage_website_settings'
  ]
};

// Check if user has permission
export function hasPermission(userRole: string, permission: string): boolean {
  const permissions = (ROLE_PERMISSIONS as any)[userRole] || [];
  return permissions.includes('*') || permissions.includes(permission);
}

// Middleware to require specific roles
export function requireRole(allowedRoles: string[]) {
  return async (req: NextRequest): Promise<NextResponse | null> => {
    try {
      const session = await getServerSession(authOptions);
      
      if (!session || !(session.user as any)?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      const user = await prisma.user.findUnique({
        where: { id: BigInt((session.user as any).id) },
        select: { role: true, isActive: true }
      });

      if (!user || !user.isActive) {
        return NextResponse.json({ error: 'User not found or inactive' }, { status: 401 });
      }

      if (!allowedRoles.includes(user.role)) {
        return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
      }

      return null; // Allow request to continue
    } catch (error) {
      console.error('Role check error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  };
}

// Middleware to require specific permission
export function requirePermission(permission: string) {
  return async (req: NextRequest): Promise<NextResponse | null> => {
    try {
      const session = await getServerSession(authOptions);
      
      if (!session || !(session.user as any)?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      const user = await prisma.user.findUnique({
        where: { id: BigInt((session.user as any).id) },
        select: { role: true, isActive: true }
      });

      if (!user || !user.isActive) {
        return NextResponse.json({ error: 'User not found or inactive' }, { status: 401 });
      }

      if (!hasPermission(user.role, permission)) {
        return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
      }

      return null; // Allow request to continue
    } catch (error) {
      console.error('Permission check error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  };
}

// Check if user can access shop data
export async function canAccessShop(userId: bigint, shopId: bigint): Promise<boolean> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true }
    });

    if (!user) return false;

    // Platform owners and moderators can access all shops
    if (['PLATFORM_OWNER', 'MODERATOR'].includes(user.role)) {
      return true;
    }

    // Check if user is assigned to the shop
    const assignment = await prisma.userShopAssignment.findFirst({
      where: {
        userId,
        shopId,
        active: true
      }
    });

    return !!assignment;
  } catch (error) {
    console.error('Shop access check error:', error);
    return false;
  }
}

// Check if user can access customer data
export async function canAccessCustomer(userId: bigint, customerId: bigint): Promise<boolean> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true }
    });

    if (!user) return false;

    // Platform owners and moderators can access all customers
    if (['PLATFORM_OWNER', 'MODERATOR'].includes(user.role)) {
      return true;
    }

    // SUPER_DUPER_ADMIN can access their own data
    if (user.role === 'SUPER_DUPER_ADMIN' && userId === customerId) {
      return true;
    }

    // Check if user is assigned to shops that the customer belongs to
    const customerShops = await prisma.shop.findMany({
      where: {
        customers: {
          some: { id: customerId }
        }
      },
      select: { id: true }
    });

    const userShops = await prisma.userShopAssignment.findMany({
      where: {
        userId,
        active: true
      },
      select: { shopId: true }
    });

    const userShopIds = userShops.map(assignment => assignment.shopId);
    const customerShopIds = customerShops.map(shop => shop.id);

    return customerShopIds.some(shopId => userShopIds.includes(shopId));
  } catch (error) {
    console.error('Customer access check error:', error);
    return false;
  }
}

// Log user activity
export async function logActivity(
  userId: bigint,
  action: string,
  resource: string,
  resourceId?: bigint,
  details?: any,
  req?: NextRequest
) {
  try {
    // Import IP utilities
    const { getClientIP, getUserAgent } = await import('@/app/lib/ipUtils');
    
    const ipAddress = req ? getClientIP(req) : null;
    const userAgent = req ? getUserAgent(req) : null;
    
    console.log('🔍 [Activity Log] Creating log:', { userId, action, resource, ipAddress, userAgent });
    
    await prisma.activityLog.create({
      data: {
        userId,
        action,
        resource,
        resourceId,
        details: details ? JSON.stringify(details) : null,
        ipAddress: ipAddress || 'unknown',
        userAgent: userAgent || 'unknown'
      }
    });
  } catch (error) {
    console.error('Activity logging error:', error);
  }
}

// Get user's accessible shops
export async function getUserShops(userId: bigint): Promise<bigint[]> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true }
    });

    if (!user) return [];

    // Platform owners and moderators can access all shops
    if (['PLATFORM_OWNER', 'MODERATOR'].includes(user.role)) {
      const allShops = await prisma.shop.findMany({
        where: { isActive: true },
        select: { id: true }
      });
      return allShops.map(shop => shop.id);
    }

    // Get user's assigned shops
    const assignments = await prisma.userShopAssignment.findMany({
      where: {
        userId,
        active: true
      },
      select: { shopId: true }
    });

    return assignments.map(assignment => assignment.shopId);
  } catch (error) {
    console.error('Get user shops error:', error);
    return [];
  }
}
