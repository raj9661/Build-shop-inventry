import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export interface PlanLimits {
  maxShops: number
  maxUsers: number
  maxProducts: number
  maxCustomers: number
}

export const PLAN_LIMITS: Record<string, PlanLimits> = {
  TRIAL_30_DAYS: {
    maxShops: 1,
    maxUsers: 1,
    maxProducts: 100,
    maxCustomers: 50
  },
  BASIC_MONTHLY: {
    maxShops: 2,
    maxUsers: 3,
    maxProducts: 500,
    maxCustomers: 200
  },
  BASIC_YEARLY: {
    maxShops: 2,
    maxUsers: 3,
    maxProducts: 500,
    maxCustomers: 200
  },
  PROFESSIONAL_MONTHLY: {
    maxShops: 5,
    maxUsers: 10,
    maxProducts: 2000,
    maxCustomers: 1000
  },
  PROFESSIONAL_YEARLY: {
    maxShops: 5,
    maxUsers: 10,
    maxProducts: 2000,
    maxCustomers: 1000
  },
  ENTERPRISE_MONTHLY: {
    maxShops: -1,
    maxUsers: -1,
    maxProducts: -1,
    maxCustomers: -1
  },
  ENTERPRISE_YEARLY: {
    maxShops: -1,
    maxUsers: -1,
    maxProducts: -1,
    maxCustomers: -1
  }
}

export async function getUserSubscription(userId: bigint) {
  try {
    const subscription = await prisma.subscription.findUnique({
      where: { customerId: userId },
      include: {
        usage: true
      }
    })
    return subscription
  } catch (error) {
    console.error('Error fetching user subscription:', error)
    return null
  }
}

export async function canCreateShop(userId: bigint): Promise<{ canCreate: boolean; reason?: string; currentCount: number; limit: number }> {
  try {
    const subscription = await getUserSubscription(userId)
    
    if (!subscription) {
      // If no subscription, assume trial limits
      const currentShops = await prisma.shop.count({
        where: { 
          createdBy: userId,
          isActive: true 
        }
      })
      
      const limits = PLAN_LIMITS.TRIAL_30_DAYS
      const limit = limits.maxShops
      const canCreate = limit === -1 ? true : currentShops < limit
      return {
        canCreate,
        reason: !canCreate ? `Trial plan allows maximum ${limit} shop(s). You have ${currentShops} shop(s).` : undefined,
        currentCount: currentShops,
        limit
      }
    }

    const limits = PLAN_LIMITS[subscription.plan] || PLAN_LIMITS.TRIAL_30_DAYS
    const limit = limits.maxShops
    
    const currentShops = await prisma.shop.count({
      where: { 
        createdBy: userId,
        isActive: true 
      }
    })

    const canCreate = limit === -1 ? true : currentShops < limit
    return {
      canCreate,
      reason: !canCreate ? `${subscription.plan} plan allows maximum ${limit} shop(s). You have ${currentShops} shop(s).` : undefined,
      currentCount: currentShops,
      limit
    }
  } catch (error) {
    console.error('Error checking shop creation limits:', error)
    return {
      canCreate: false,
      reason: 'Error checking subscription limits',
      currentCount: 0,
      limit: 0
    }
  }
}

export async function canCreateUser(userId: bigint, targetRole: string): Promise<{ canCreate: boolean; reason?: string; currentCount: number; limit: number }> {
  try {
    const subscription = await getUserSubscription(userId)
    
    if (!subscription) {
      // If no subscription, assume trial limits
      const currentUsers = await prisma.user.count({
        where: { 
          createdBy: userId,
          isActive: true 
        }
      })
      
      const limits = PLAN_LIMITS.TRIAL_30_DAYS
      const limit = limits.maxUsers
      const canCreate = limit === -1 ? true : currentUsers < limit
      return {
        canCreate,
        reason: !canCreate ? `Trial plan allows maximum ${limit} users. You have ${currentUsers} users.` : undefined,
        currentCount: currentUsers,
        limit
      }
    }

    const limits = PLAN_LIMITS[subscription.plan] || PLAN_LIMITS.TRIAL_30_DAYS
    const limit = limits.maxUsers
    
    const currentUsers = await prisma.user.count({
      where: { 
        createdBy: userId,
        isActive: true 
      }
    })

    const canCreate = limit === -1 ? true : currentUsers < limit
    return {
      canCreate,
      reason: !canCreate ? `${subscription.plan} plan allows maximum ${limit} users. You have ${currentUsers} users.` : undefined,
      currentCount: currentUsers,
      limit
    }
  } catch (error) {
    console.error('Error checking user creation limits:', error)
    return {
      canCreate: false,
      reason: 'Error checking subscription limits',
      currentCount: 0,
      limit: 0
    }
  }
}

export function canCreateRole(creatorRole: string, targetRole: string): { canCreate: boolean; reason?: string } {
  // SUPER_DUPER_ADMIN can create all roles except SUPER_DUPER_ADMIN
  if (creatorRole === 'SUPER_DUPER_ADMIN') {
    if (targetRole === 'SUPER_DUPER_ADMIN') {
      return {
        canCreate: false,
        reason: 'SUPER_DUPER_ADMIN cannot create another SUPER_DUPER_ADMIN user'
      }
    }
    return { canCreate: true }
  }

  // Other roles have limited creation rights
  if (creatorRole === 'SUPER_ADMIN') {
    const allowedRoles = ['ADMIN', 'USER', 'STAFF']
    if (!allowedRoles.includes(targetRole)) {
      return {
        canCreate: false,
        reason: `SUPER_ADMIN can only create users with roles: ${allowedRoles.join(', ')}`
      }
    }
    return { canCreate: true }
  }

  if (creatorRole === 'ADMIN') {
    const allowedRoles = ['USER', 'STAFF']
    if (!allowedRoles.includes(targetRole)) {
      return {
        canCreate: false,
        reason: `ADMIN can only create users with roles: ${allowedRoles.join(', ')}`
      }
    }
    return { canCreate: true }
  }

  return {
    canCreate: false,
    reason: `Role ${creatorRole} cannot create users`
  }
}
