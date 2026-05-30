import { prisma } from '@/lib/prisma';
import { validateToken } from './tokenUtils'


// Simple in-memory cache for shop assignments (in production, use Redis)
const shopAssignmentCache = new Map<string, any>();
const CACHE_TTL = 1 * 60 * 1000; // 1 minute (reduced for debugging)

// Function to clear cache for a specific user
export function clearUserShopCache(userId: number) {
  const cacheKey = `shop_assignments_${userId}`;
  shopAssignmentCache.delete(cacheKey);
  console.log('🧹 Cleared shop cache for user:', userId);
}

// Function to clear all shop caches
export function clearAllShopCaches() {
  shopAssignmentCache.clear();
  console.log('🧹 Cleared all shop caches');
}

interface CachedShopAssignment {
  data: any;
  timestamp: number;
}

export interface ShopAccessInfo {
  userId: number
  userRole: string
  assignedShopIds: number[]
  isSuperDuperAdmin: boolean
  canAccessAllShops: boolean
}

/**
 * Get user's shop access information
 */
export async function getUserShopAccess(token: string): Promise<ShopAccessInfo | null> {
  try {
    const decoded = await validateToken(token)
    if (!decoded) {
      return null
    }

    const userId = decoded.userId
    const userRole = decoded.role

    // SUPER_DUPER_ADMIN can access all shops they created
    if (userRole === 'SUPER_DUPER_ADMIN') {
      // Get shops created by this SUPER_DUPER_ADMIN
      const createdShops = await prisma.shop.findMany({
        where: {
          createdBy: userId,
          isActive: true
        },
        select: { id: true }
      })
      
      const assignedShopIds = createdShops.map(shop => Number(shop.id))
      
      return {
        userId,
        userRole,
        assignedShopIds,
        isSuperDuperAdmin: true,
        canAccessAllShops: true // SUPER_DUPER_ADMIN can access all their shops
      }
    }

    // SUPER_ADMIN and ADMIN can only access shops they are assigned to
    if (userRole === 'SUPER_ADMIN' || userRole === 'ADMIN') {
      // Get user's shop assignments
      const assignments = await prisma.userShopAssignment.findMany({
        where: {
          userId: userId,
          active: true
        },
        select: { shopId: true }
      });
      
      const assignedShopIds = assignments.map(assignment => Number(assignment.shopId));
      
      return {
        userId,
        userRole,
        assignedShopIds,
        isSuperDuperAdmin: false,
        canAccessAllShops: false // SUPER_ADMIN and ADMIN can only access assigned shops
      };
    }

    // Get user's shop assignments
    const assignments = await prisma.userShopAssignment.findMany({
      where: {
        userId: userId,
        active: true
      },
      select: {
        shopId: true,
        role: true
      }
    })

    const assignedShopIds = assignments.map(assignment => Number(assignment.shopId))

    return {
      userId,
      userRole,
      assignedShopIds,
      isSuperDuperAdmin: false,
      canAccessAllShops: false
    }
  } catch (error) {
    console.error('Error getting user shop access:', error)
    return null
  }
}

/**
 * Check if user can access a specific shop
 */
export async function canAccessShop(token: string, shopId: number): Promise<boolean> {
  try {
    const accessInfo = await getUserShopAccess(token)
    if (!accessInfo) {
      return false
    }

    // SUPER_DUPER_ADMIN can only access shops they created
    if (accessInfo.isSuperDuperAdmin) {
      return accessInfo.assignedShopIds.includes(shopId)
    }

    // Check if user is assigned to this shop
    return accessInfo.assignedShopIds.includes(shopId)
  } catch (error) {
    console.error('Error checking shop access:', error)
    return false
  }
}

/**
 * Get shop filter for database queries based on user's access
 */
export async function getShopFilter(token: string): Promise<any> {
  try {
    const decoded = await validateToken(token);
    if (!decoded) {
      return {};
    }

    // Check cache first
    const cacheKey = `shop_assignments_${decoded.userId}`;
    const cached = shopAssignmentCache.get(cacheKey) as CachedShopAssignment;
    
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }

    let shopFilter = {};

    if (decoded.role === 'SUPER_DUPER_ADMIN') {
      // SUPER_DUPER_ADMIN can access all shops they created
      const createdShops = await prisma.shop.findMany({
        where: {
          createdBy: decoded.userId,
          isActive: true
        },
        select: { id: true }
      });
      
      const shopIds = createdShops.map(shop => Number(shop.id));
      shopFilter = { shopId: { in: shopIds } };
    } else {
      // All other roles (including SUPER_ADMIN and ADMIN) can only access assigned shops
      const assignments = await prisma.userShopAssignment.findMany({
        where: {
          userId: decoded.userId,
          active: true
        },
        include: {
          shop: {
            select: { id: true, name: true, location: true }
          }
        }
      });

      if (assignments.length > 0) {
        const shopIds = assignments.map(assignment => Number(assignment.shop.id));
        // Return shopId filter for other models (sales, products, etc.)
        shopFilter = { shopId: { in: shopIds } };
      } else {
        // No shop assignments - restrict access
        shopFilter = { shopId: -1 }; // Invalid shop ID to ensure no results
      }
    }

    // Cache the result
    shopAssignmentCache.set(cacheKey, {
      data: shopFilter,
      timestamp: Date.now()
    });

    console.log('🔍 Shop filter result for user', decoded.userId, ':', shopFilter);
    return shopFilter;
  } catch (error) {
    console.error('Error getting shop filter:', error);
    return {};
  }
}

/**
 * Validate shop access and return access info
 */
export async function validateShopAccess(token: string, shopId?: number): Promise<ShopAccessInfo | null> {
  try {
    const accessInfo = await getUserShopAccess(token)
    if (!accessInfo) {
      return null
    }

    // If specific shopId is provided, check access
    if (shopId && !accessInfo.isSuperDuperAdmin) {
      if (!accessInfo.assignedShopIds.includes(shopId)) {
        return null
      }
    }

    return accessInfo
  } catch (error) {
    console.error('Error validating shop access:', error)
    return null
  }
}

/**
 * Get user's assigned shops for frontend
 */
export async function getUserAssignedShops(token: string): Promise<Array<{ id: number; name: string; location: string }>> {
  try {
    console.log('🔍 getUserAssignedShops: Getting access info...');
    const accessInfo = await getUserShopAccess(token)
    if (!accessInfo) {
      console.log('❌ getUserAssignedShops: No access info');
      return []
    }

    console.log('🔍 getUserAssignedShops: Access info:', {
      userId: accessInfo.userId,
      userRole: accessInfo.userRole,
      isSuperDuperAdmin: accessInfo.isSuperDuperAdmin
    });

    // PLATFORM_OWNER and MODERATOR get all shops
    if (accessInfo.userRole === 'PLATFORM_OWNER' || accessInfo.userRole === 'MODERATOR') {
      console.log('🔍 getUserAssignedShops: PLATFORM_OWNER/MODERATOR - fetching all active shops');
      const allShops = await prisma.shop.findMany({
        where: { isActive: true },
        select: { id: true, name: true, location: true }
      });
      console.log('🔍 getUserAssignedShops: Found', allShops.length, 'active shops');
      console.log('🔍 getUserAssignedShops: Raw shop data:', allShops);
      const mappedShops = allShops.map(shop => ({
        id: Number(shop.id),
        name: shop.name,
        location: shop.location || ''
      }));
      console.log('🔍 getUserAssignedShops: Mapped shop data:', mappedShops);
      return mappedShops;
    }

    // SUPER_DUPER_ADMIN gets all shops they created
    if (accessInfo.isSuperDuperAdmin) {
      console.log('🔍 getUserAssignedShops: SUPER_DUPER_ADMIN - fetching all shops created by user');
      const userShops = await prisma.shop.findMany({
        where: { 
          createdBy: accessInfo.userId,
          isActive: true
        },
        select: { id: true, name: true, location: true, address: true, phone: true, gstNo: true }
      })
      console.log('🔍 getUserAssignedShops: Found', userShops.length, 'shops created by user');
      console.log('🔍 getUserAssignedShops: Raw shop data:', userShops);
      const mappedShops = userShops.map(shop => ({
        id: Number(shop.id),
        name: shop.name,
        location: shop.location || '',
        address: shop.address || '',
        phone: shop.phone || '',
        gstNo: shop.gstNo || ''
      }));
      console.log('🔍 getUserAssignedShops: Mapped shop data:', mappedShops);
      return mappedShops;
    }

    // All other roles (SUPER_ADMIN, ADMIN, etc.) get only assigned shops
    const assignedShops = await prisma.shop.findMany({
      where: {
        id: { in: accessInfo.assignedShopIds },
        isActive: true
      },
      select: { id: true, name: true, location: true, address: true, phone: true, gstNo: true }
    })

    console.log('🔍 getUserAssignedShops: Found', assignedShops.length, 'assigned shops');
    return assignedShops.map(shop => ({
      id: Number(shop.id),
      name: shop.name,
      location: shop.location || '',
      address: shop.address || '',
      phone: shop.phone || '',
      gstNo: shop.gstNo || ''
    }))
  } catch (error) {
    console.error('Error getting user assigned shops:', error)
    return []
  }
}

export async function getUserShops(token: string): Promise<any[]> {
  try {
    const decoded = await validateToken(token);
    if (!decoded) {
      return [];
    }

    // Check cache first
    const cacheKey = `user_shops_${decoded.userId}`;
    const cached = shopAssignmentCache.get(cacheKey) as CachedShopAssignment;
    
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }

    let shops = [];

    if (decoded.role === 'SUPER_DUPER_ADMIN') {
      // SUPER_DUPER_ADMIN can access all shops they created
      shops = await prisma.shop.findMany({
        where: { 
          createdBy: decoded.userId,
          isActive: true
        },
        select: { id: true, name: true, location: true }
      });
    } else {
      // Get user's assigned shops
      const assignments = await prisma.userShopAssignment.findMany({
        where: {
          userId: decoded.userId,
          active: true
        },
        include: {
          shop: {
            select: { id: true, name: true, location: true }
          }
        }
      });

      shops = assignments.map(assignment => assignment.shop);
    }

    // Cache the result
    shopAssignmentCache.set(cacheKey, {
      data: shops,
      timestamp: Date.now()
    });

    return shops;
  } catch (error) {
    console.error('Error getting user shops:', error);
    return [];
  }
}

// Clear cache when shop assignments change
export function clearShopAssignmentCache(userId?: number): void {
  if (userId) {
    shopAssignmentCache.delete(`shop_assignments_${userId}`);
    shopAssignmentCache.delete(`user_shops_${userId}`);
  } else {
    shopAssignmentCache.clear();
  }
}

// Get cache statistics (for debugging)
export function getCacheStats(): { size: number; entries: string[] } {
  return {
    size: shopAssignmentCache.size,
    entries: Array.from(shopAssignmentCache.keys())
  };
} 