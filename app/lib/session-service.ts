import { PrismaClient } from '@prisma/client';
import { securityService } from './security-service';

const prisma = new PrismaClient();

interface SessionInfo {
  userId: number;
  lastActivity: Date;
  isExpired: boolean;
  timeRemaining: number;
}

class SessionService {
  // Check if user session is expired
  async isSessionExpired(userId: number): Promise<boolean> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { lastLoginAt: true }
      });

      if (!user || !user.lastLoginAt) {
        return true;
      }

      const timeout = await securityService.getSessionTimeout();
      const timeSinceLastActivity = Date.now() - user.lastLoginAt.getTime();
      
      return timeSinceLastActivity > timeout;
    } catch (error) {
      console.error('Error checking session expiration:', error);
      return true; // Assume expired on error for security
    }
  }

  // Update user's last activity
  async updateUserActivity(userId: number): Promise<void> {
    try {
      await prisma.user.update({
        where: { id: userId },
        data: { lastLoginAt: new Date() }
      });
    } catch (error) {
      console.error('Failed to update user activity:', error);
    }
  }

  // Get session information
  async getSessionInfo(userId: number): Promise<SessionInfo | null> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { lastLoginAt: true }
      });

      if (!user || !user.lastLoginAt) {
        return null;
      }

      const timeout = await securityService.getSessionTimeout();
      const timeSinceLastActivity = Date.now() - user.lastLoginAt.getTime();
      const isExpired = timeSinceLastActivity > timeout;
      const timeRemaining = Math.max(0, timeout - timeSinceLastActivity);

      return {
        userId,
        lastActivity: user.lastLoginAt,
        isExpired,
        timeRemaining
      };
    } catch (error) {
      console.error('Error getting session info:', error);
      return null;
    }
  }

  // Force logout user (invalidate session)
  async forceLogout(userId: number, reason: string = 'Session expired'): Promise<void> {
    try {
      // Log the forced logout
      await securityService.logSecurityEvent(
        userId,
        'forced_logout',
        reason,
        'System',
        'Session Service'
      );

      // Update last login to force session expiration
      await prisma.user.update({
        where: { id: userId },
        data: { 
          lastLoginAt: new Date(Date.now() - 24 * 60 * 60 * 1000) // Set to 24 hours ago
        }
      });
    } catch (error) {
      console.error('Error forcing logout:', error);
    }
  }

  // Get all expired sessions
  async getExpiredSessions(): Promise<number[]> {
    try {
      const timeout = await securityService.getSessionTimeout();
      const cutoffTime = new Date(Date.now() - timeout);

      const expiredUsers = await prisma.user.findMany({
        where: {
          lastLoginAt: {
            lt: cutoffTime
          },
          isActive: true
        },
        select: { id: true }
      });

      return expiredUsers.map(user => user.id);
    } catch (error) {
      console.error('Error getting expired sessions:', error);
      return [];
    }
  }

  // Clean up expired sessions
  async cleanupExpiredSessions(): Promise<number> {
    try {
      const expiredUserIds = await this.getExpiredSessions();
      let cleanedCount = 0;

      for (const userId of expiredUserIds) {
        await this.forceLogout(userId, 'Automatic session cleanup');
        cleanedCount++;
      }

      return cleanedCount;
    } catch (error) {
      console.error('Error cleaning up expired sessions:', error);
      return 0;
    }
  }

  // Extend session for a user
  async extendSession(userId: number): Promise<boolean> {
    try {
      await this.updateUserActivity(userId);
      return true;
    } catch (error) {
      console.error('Error extending session:', error);
      return false;
    }
  }

  // Get session statistics
  async getSessionStats(): Promise<{
    totalActive: number;
    totalExpired: number;
    averageSessionTime: number;
  }> {
    try {
      const timeout = await securityService.getSessionTimeout();
      const cutoffTime = new Date(Date.now() - timeout);

      const [activeUsers, expiredUsers] = await Promise.all([
        prisma.user.count({
          where: {
            lastLoginAt: {
              gte: cutoffTime
            },
            isActive: true
          }
        }),
        prisma.user.count({
          where: {
            lastLoginAt: {
              lt: cutoffTime
            },
            isActive: true
          }
        })
      ]);

      // Calculate average session time (simplified)
      const averageSessionTime = timeout / (1000 * 60); // Convert to minutes

      return {
        totalActive: activeUsers,
        totalExpired: expiredUsers,
        averageSessionTime
      };
    } catch (error) {
      console.error('Error getting session stats:', error);
      return {
        totalActive: 0,
        totalExpired: 0,
        averageSessionTime: 0
      };
    }
  }
}

export const sessionService = new SessionService();
export default sessionService; 