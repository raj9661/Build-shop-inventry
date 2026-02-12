import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

interface PasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
}

interface SecuritySettings {
  sessionTimeout: number;
  requireMFA: boolean;
  passwordPolicy: PasswordPolicy;
}

class SecurityService {
  private async getSecuritySettings(): Promise<SecuritySettings> {
    try {
      const systemSetting = await prisma.websiteSetting.findFirst({ 
        where: { 
          customerId: null, // Global platform setting
          type: 'SEO_META_TAGS' // Use any type for system settings
        } 
      });
      if (systemSetting && systemSetting.value) {
        const data = JSON.parse(systemSetting.value) as any;
        return {
          sessionTimeout: data.security?.sessionTimeout || 30,
          requireMFA: data.security?.requireMFA || false,
          passwordPolicy: {
            minLength: data.security?.passwordPolicy?.minLength || 8,
            requireUppercase: data.security?.passwordPolicy?.requireUppercase || true,
            requireLowercase: data.security?.passwordPolicy?.requireLowercase || true,
            requireNumbers: data.security?.passwordPolicy?.requireNumbers || true,
            requireSpecialChars: data.security?.passwordPolicy?.requireSpecialChars || false
          }
        };
      }
      return {
        sessionTimeout: 30,
        requireMFA: false,
        passwordPolicy: {
          minLength: 8,
          requireUppercase: true,
          requireLowercase: true,
          requireNumbers: true,
          requireSpecialChars: false
        }
      };
    } catch (error) {
      console.error('Failed to load security settings:', error);
      return {
        sessionTimeout: 30,
        requireMFA: false,
        passwordPolicy: {
          minLength: 8,
          requireUppercase: true,
          requireLowercase: true,
          requireNumbers: true,
          requireSpecialChars: false
        }
      };
    }
  }

  // Validate password against security policy
  async validatePassword(password: string): Promise<{ valid: boolean; errors: string[] }> {
    const settings = await this.getSecuritySettings();
    const policy = settings.passwordPolicy;
    const errors: string[] = [];

    // Check minimum length
    if (password.length < policy.minLength) {
      errors.push(`Password must be at least ${policy.minLength} characters long`);
    }

    // Check for uppercase letters
    if (policy.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    // Check for lowercase letters
    if (policy.requireLowercase && !/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    // Check for numbers
    if (policy.requireNumbers && !/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    // Check for special characters
    if (policy.requireSpecialChars && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  // Hash password with bcrypt
  async hashPassword(password: string): Promise<string> {
    return await bcrypt.hash(password, 12);
  }

  // Verify password against hash
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return await bcrypt.compare(password, hash);
  }

  // Check if MFA is required for a user
  async isMFARequired(userId: number): Promise<boolean> {
    try {
      const settings = await this.getSecuritySettings();
      if (!settings.requireMFA) return false;

      // Check if user has MFA enabled
      const user2FA = await prisma.user2FASetting.findUnique({
        where: { userId }
      });

      return user2FA?.isEnabled || false;
    } catch (error) {
      console.error('Error checking MFA requirement:', error);
      return false;
    }
  }

  // Get session timeout in milliseconds
  async getSessionTimeout(): Promise<number> {
    const settings = await this.getSecuritySettings();
    return settings.sessionTimeout * 60 * 1000; // Convert minutes to milliseconds
  }

  // Log security event
  async logSecurityEvent(
    userId: number,
    action: string,
    details: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    try {
      await prisma.activityLog.create({
        data: {
          userId,
          action,
          resource: 'security',
          resourceId: userId,
          details,
          ipAddress: ipAddress || 'Unknown',
          userAgent: userAgent || 'Unknown'
        }
      });
    } catch (error) {
      console.error('Failed to log security event:', error);
    }
  }

  // Check for suspicious login activity
  async checkSuspiciousActivity(userId: number, ipAddress: string): Promise<{ suspicious: boolean; reason?: string }> {
    try {
      // Check for multiple failed login attempts
      const recentFailedLogins = await prisma.loginLog.count({
        where: {
          userId,
          success: false,
          createdAt: {
            gte: new Date(Date.now() - 15 * 60 * 1000) // Last 15 minutes
          }
        }
      });

      if (recentFailedLogins >= 5) {
        return {
          suspicious: true,
          reason: 'Multiple failed login attempts detected'
        };
      }

      // Check for login from new IP address
      const previousLogins = await prisma.loginLog.findMany({
        where: {
          userId,
          success: true,
          ipAddress: {
            not: ipAddress
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 1
      });

      if (previousLogins.length > 0) {
        const lastLogin = previousLogins[0];
        const timeDiff = Date.now() - lastLogin.createdAt.getTime();
        
        // If last login was more than 30 days ago and from different IP
        if (timeDiff > 30 * 24 * 60 * 60 * 1000) {
          return {
            suspicious: true,
            reason: 'Login from new IP address after long period'
          };
        }
      }

      return { suspicious: false };
    } catch (error) {
      console.error('Error checking suspicious activity:', error);
      return { suspicious: false };
    }
  }

  // Get password strength score (0-100)
  calculatePasswordStrength(password: string): number {
    let score = 0;

    // Length contribution (up to 25 points)
    if (password.length >= 8) score += 10;
    if (password.length >= 12) score += 10;
    if (password.length >= 16) score += 5;

    // Character variety contribution (up to 50 points)
    if (/[a-z]/.test(password)) score += 10;
    if (/[A-Z]/.test(password)) score += 10;
    if (/\d/.test(password)) score += 10;
    if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) score += 20;

    // Complexity contribution (up to 25 points)
    const uniqueChars = new Set(password).size;
    if (uniqueChars >= password.length * 0.7) score += 15;
    if (uniqueChars >= password.length * 0.9) score += 10;

    return Math.min(score, 100);
  }

  // Get password strength description
  getPasswordStrengthDescription(score: number): { level: string; color: string; description: string } {
    if (score >= 80) {
      return {
        level: 'Very Strong',
        color: 'text-green-600',
        description: 'Excellent password strength'
      };
    } else if (score >= 60) {
      return {
        level: 'Strong',
        color: 'text-blue-600',
        description: 'Good password strength'
      };
    } else if (score >= 40) {
      return {
        level: 'Moderate',
        color: 'text-yellow-600',
        description: 'Acceptable password strength'
      };
    } else if (score >= 20) {
      return {
        level: 'Weak',
        color: 'text-orange-600',
        description: 'Password needs improvement'
      };
    } else {
      return {
        level: 'Very Weak',
        color: 'text-red-600',
        description: 'Password is too weak'
      };
    }
  }

  // Generate secure random password
  generateSecurePassword(length: number = 12): string {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
    let password = '';
    
    // Ensure at least one character from each required category
    password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)]; // Uppercase
    password += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)]; // Lowercase
    password += '0123456789'[Math.floor(Math.random() * 10)]; // Number
    password += '!@#$%^&*()_+-=[]{}|;:,.<>?'[Math.floor(Math.random() * 32)]; // Special char
    
    // Fill the rest randomly
    for (let i = 4; i < length; i++) {
      password += charset[Math.floor(Math.random() * charset.length)];
    }
    
    // Shuffle the password
    return password.split('').sort(() => Math.random() - 0.5).join('');
  }

  // Update user's last activity timestamp
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

  // Check if user session is expired
  async isSessionExpired(userId: number, lastActivity: Date): Promise<boolean> {
    try {
      const timeout = await this.getSessionTimeout();
      const timeSinceLastActivity = Date.now() - lastActivity.getTime();
      return timeSinceLastActivity > timeout;
    } catch (error) {
      console.error('Error checking session expiration:', error);
      return false;
    }
  }
}

export const securityService = new SecurityService();
export default securityService; 