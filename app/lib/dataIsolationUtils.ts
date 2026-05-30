import { prisma } from '@/lib/prisma';
import { validateToken } from './tokenUtils'


export interface UserAccessInfo {
  userId: number
  userRole: string
  accessibleShopIds: number[]
  isSuperDuperAdmin: boolean
}

/**
 * Get user's accessible shop IDs based on their role and assignments
 */
export async function getUserAccessibleShops(token: string): Promise<UserAccessInfo | null> {
  try {
    const decoded = await validateToken(token)
    if (!decoded) {
      return null
    }

    const userId = decoded.userId
    const userRole = decoded.role

    if (userRole === 'SUPER_DUPER_ADMIN') {
      // SUPER_DUPER_ADMIN can access all shops they created
      console.log('🔍 getUserAccessibleShops: SUPER_DUPER_ADMIN, fetching shops created by:', userId);
      const createdShops = await prisma.shop.findMany({
        where: {
          createdBy: userId,
          isActive: true
        },
        select: { id: true }
      })
      console.log('🔍 getUserAccessibleShops: Found shops:', createdShops);
      
      return {
        userId,
        userRole,
        accessibleShopIds: createdShops.map(shop => Number(shop.id)),
        isSuperDuperAdmin: true
      }
    } else {
      // Other roles can only access shops they are assigned to
      const assignments = await prisma.userShopAssignment.findMany({
        where: {
          userId: userId,
          active: true
        },
        select: { shopId: true }
      })
      
      return {
        userId,
        userRole,
        accessibleShopIds: assignments.map(assignment => Number(assignment.shopId)),
        isSuperDuperAdmin: false
      }
    }
  } catch (error) {
    console.error('Error getting user accessible shops:', error)
    return null
  }
}

/**
 * Get shop filter for database queries based on user access
 */
export function getShopFilter(accessibleShopIds: number[]): any {
  if (accessibleShopIds.length === 0) {
    // User has no shop access, return filter that matches nothing
    return { id: { in: [] } }
  }
  
  return { 
    id: { in: accessibleShopIds },
    isActive: true 
  }
}

/**
 * Get user filter for database queries based on shop assignments
 */
export async function getUserFilter(token: string): Promise<any> {
  try {
    const accessInfo = await getUserAccessibleShops(token)
    if (!accessInfo) {
      return { id: { in: [] } } // No access
    }

    if (accessInfo.isSuperDuperAdmin) {
      // SUPER_DUPER_ADMIN can only see users they created (complete isolation)
      return {
        createdBy: BigInt(accessInfo.userId),
        isActive: true
      }
    } else {
      // Other roles can only see users assigned to their shops
      const shopAssignments = await prisma.userShopAssignment.findMany({
        where: {
          shopId: { in: accessInfo.accessibleShopIds },
          active: true
        },
        select: { userId: true }
      })
      
      const userIds = shopAssignments.map(assignment => assignment.userId)
      
      return {
        id: { in: userIds },
        isActive: true
      }
    }
  } catch (error) {
    console.error('Error getting user filter:', error)
    return { id: { in: [] } } // No access on error
  }
}

/**
 * Get sales filter for database queries based on shop assignments
 */
export function getSalesFilter(accessibleShopIds: number[]): any {
  if (accessibleShopIds.length === 0) {
    return { id: { in: [] } } // No access
  }
  
  return { 
    shopId: { in: accessibleShopIds }
  }
}

/**
 * Get products filter for database queries based on shop assignments
 */
export function getProductsFilter(accessibleShopIds: number[]): any {
  if (accessibleShopIds.length === 0) {
    return { id: { in: [] } } // No access
  }
  
  return { 
    shopId: { in: accessibleShopIds }
  }
}

/**
 * Get customers filter for database queries based on shop assignments
 */
export function getCustomersFilter(accessibleShopIds: number[]): any {
  if (accessibleShopIds.length === 0) {
    return { id: { in: [] } } // No access
  }
  
  return { 
    shopId: { in: accessibleShopIds }
  }
}

/**
 * Get employees filter for database queries based on shop assignments
 */
export function getEmployeesFilter(accessibleShopIds: number[]): any {
  if (accessibleShopIds.length === 0) {
    return { id: { in: [] } } // No access
  }
  
  return { 
    shopId: { in: accessibleShopIds }
  }
}
