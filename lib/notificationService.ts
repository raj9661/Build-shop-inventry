import { PrismaClient, NotificationType } from '@prisma/client';

const prisma = new PrismaClient();

// Notification service for automated notifications
export class NotificationService {
  
  // Send subscription expiry notification
  static async sendSubscriptionExpiryNotification(customerId: bigint, daysLeft: number) {
    try {
      await prisma.notification.create({
        data: {
          recipientId: customerId,
          recipientType: 'user',
          type: NotificationType.SUBSCRIPTION_EXPIRY,
          title: 'Subscription Expiring Soon',
          message: `Your subscription will expire in ${daysLeft} days. Please renew to continue using our services.`,
          scheduledFor: new Date()
        }
      });
    } catch (error) {
      console.error('Error sending subscription expiry notification:', error);
    }
  }

  // Send trial ending notification
  static async sendTrialEndingNotification(customerId: bigint, daysLeft: number) {
    try {
      await prisma.notification.create({
        data: {
          recipientId: customerId,
          recipientType: 'user',
          type: NotificationType.TRIAL_ENDING,
          title: 'Trial Ending Soon',
          message: `Your free trial will end in ${daysLeft} days. Choose a plan to continue using our services.`,
          scheduledFor: new Date()
        }
      });
    } catch (error) {
      console.error('Error sending trial ending notification:', error);
    }
  }

  // Send user creation notification
  static async sendUserCreatedNotification(createdUserId: bigint, createdByUserId: bigint, username: string, role: string) {
    try {
      // Get the creator's name for the notification
      const creator = await prisma.user.findUnique({
        where: { id: createdByUserId },
        select: { name: true, username: true }
      });

      const creatorName = creator?.name || creator?.username || 'System Admin';

      await prisma.notification.create({
        data: {
          recipientId: createdUserId,
          recipientType: 'user',
          type: 'USER_CREATED' as NotificationType,
          title: 'Welcome to the Platform!',
          message: `Your account has been created by ${creatorName}. You can now access the platform with role: ${role}.`,
          sentAt: new Date()
        }
      });

      console.log(`✅ User creation notification sent to user ${username}`);
    } catch (error) {
      console.error('Error sending user creation notification:', error);
    }
  }

  // Send payment due notification
  static async sendPaymentDueNotification(customerId: bigint, amount: number, currency: string) {
    try {
      await prisma.notification.create({
        data: {
          recipientId: customerId,
          recipientType: 'user',
          type: NotificationType.PAYMENT_DUE,
          title: 'Payment Due',
          message: `Your subscription payment of ${currency} ${amount} is due. Please update your payment method.`,
          scheduledFor: new Date()
        }
      });
    } catch (error) {
      console.error('Error sending payment due notification:', error);
    }
  }

  // Send account suspended notification
  static async sendAccountSuspendedNotification(customerId: bigint, reason: string) {
    try {
      await prisma.notification.create({
        data: {
          recipientId: customerId,
          recipientType: 'user',
          type: NotificationType.ACCOUNT_SUSPENDED,
          title: 'Account Suspended',
          message: `Your account has been suspended due to: ${reason}. Please contact support for assistance.`,
          scheduledFor: new Date()
        }
      });
    } catch (error) {
      console.error('Error sending account suspended notification:', error);
    }
  }

  // Send violation reported notification
  static async sendViolationReportedNotification(customerId: bigint, violationTitle: string) {
    try {
      await prisma.notification.create({
        data: {
          recipientId: customerId,
          recipientType: 'user',
          type: NotificationType.VIOLATION_REPORTED,
          title: 'Violation Reported',
          message: `A violation has been reported against your account: ${violationTitle}. Please review and respond.`,
          scheduledFor: new Date()
        }
      });
    } catch (error) {
      console.error('Error sending violation reported notification:', error);
    }
  }

  // Send system maintenance notification
  static async sendSystemMaintenanceNotification(customerId: bigint, maintenanceTime: string) {
    try {
      await prisma.notification.create({
        data: {
          recipientId: customerId,
          recipientType: 'user',
          type: NotificationType.SYSTEM_MAINTENANCE,
          title: 'Scheduled Maintenance',
          message: `System maintenance is scheduled for ${maintenanceTime}. Services may be temporarily unavailable.`,
          scheduledFor: new Date()
        }
      });
    } catch (error) {
      console.error('Error sending system maintenance notification:', error);
    }
  }

  // Send feature update notification
  static async sendFeatureUpdateNotification(customerId: bigint, featureName: string) {
    try {
      await prisma.notification.create({
        data: {
          recipientId: customerId,
          recipientType: 'user',
          type: NotificationType.FEATURE_UPDATE,
          title: 'New Feature Available',
          message: `A new feature "${featureName}" is now available in your dashboard. Check it out!`,
          scheduledFor: new Date()
        }
      });
    } catch (error) {
      console.error('Error sending feature update notification:', error);
    }
  }

  // Send general notification
  static async sendGeneralNotification(customerId: bigint, title: string, message: string) {
    try {
      await prisma.notification.create({
        data: {
          recipientId: customerId,
          recipientType: 'user',
          type: NotificationType.GENERAL,
          title,
          message,
          scheduledFor: new Date()
        }
      });
    } catch (error) {
      console.error('Error sending general notification:', error);
    }
  }

  // Send bulk notification to all customers
  static async sendBulkNotification(title: string, message: string, notificationType: string = 'GENERAL') {
    try {
      const customers = await prisma.user.findMany({
        where: { role: 'SUPER_DUPER_ADMIN' },
        select: { id: true }
      });

      const notifications = customers.map(customer => ({
        recipientId: customer.id,
        recipientType: 'user',
        type: notificationType as NotificationType,
        title,
        message,
        scheduledFor: new Date()
      }));

      await prisma.notification.createMany({
        data: notifications
      });

      console.log(`Bulk notification sent to ${customers.length} customers`);
    } catch (error) {
      console.error('Error sending bulk notification:', error);
    }
  }

  // Process scheduled notifications
  static async processScheduledNotifications() {
    try {
      const scheduledNotifications = await prisma.notification.findMany({
        where: {
          scheduledFor: {
            lte: new Date()
          },
          sentAt: null,
          isActive: true
        },
        take: 100 // Process in batches
      });

      for (const notification of scheduledNotifications) {
        // Here you would integrate with email/SMS services
        // For now, we'll just mark as sent
        await prisma.notification.update({
          where: { id: notification.id },
          data: {
            sentAt: new Date()
          }
        });

        console.log(`Processed notification: ${notification.title}`);
      }

      console.log(`Processed ${scheduledNotifications.length} scheduled notifications`);
    } catch (error) {
      console.error('Error processing scheduled notifications:', error);
    }
  }

  // Check and send subscription expiry notifications
  static async checkSubscriptionExpiry() {
    try {
      const expiringSubscriptions = await prisma.subscription.findMany({
        where: {
          status: 'ACTIVE',
          endDate: {
            lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
            gte: new Date() // Not expired yet
          }
        },
        include: {
          customer: {
            select: { id: true }
          }
        }
      });

      for (const subscription of expiringSubscriptions) {
        const daysLeft = Math.ceil((subscription.endDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysLeft <= 7 && daysLeft > 0) {
          await this.sendSubscriptionExpiryNotification(subscription.customer.id, daysLeft);
        }
      }

      console.log(`Checked ${expiringSubscriptions.length} expiring subscriptions`);
    } catch (error) {
      console.error('Error checking subscription expiry:', error);
    }
  }

  // Check and send trial ending notifications
  static async checkTrialEnding() {
    try {
      const endingTrials = await prisma.subscription.findMany({
        where: {
          status: 'TRIAL',
          trialEndDate: {
            lte: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
            gte: new Date() // Not ended yet
          }
        },
        include: {
          customer: {
            select: { id: true }
          }
        }
      });

      for (const subscription of endingTrials) {
        const daysLeft = Math.ceil((subscription.trialEndDate!.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysLeft <= 3 && daysLeft > 0) {
          await this.sendTrialEndingNotification(subscription.customer.id, daysLeft);
        }
      }

      console.log(`Checked ${endingTrials.length} ending trials`);
    } catch (error) {
      console.error('Error checking trial ending:', error);
    }
  }
}

// Export for use in cron jobs or scheduled tasks
export default NotificationService;
