import { prisma } from '@/lib/prisma';
import { emailService } from './emailService';


interface NotificationSettings {
  emailNotifications: boolean;
  notificationEmail: string;
  shopSpecificNotifications: boolean;
  lowStockAlerts: boolean;
  salesReports: boolean;
  dailyReports: boolean;
  weeklyReports: boolean;
  monthlyReports: boolean;
  criticalAlerts: boolean;
}

interface ShopInfo {
  id: number;
  name: string;
  location: string;
}

class NotificationService {
  private async getNotificationSettings(): Promise<NotificationSettings> {
    try {
      const systemSetting = await prisma.systemSetting.findUnique({ where: { id: 1 } });
      if (systemSetting && systemSetting.data) {
        const data = systemSetting.data as any;
        return {
          emailNotifications: data.notifications?.emailNotifications || false,
          notificationEmail: data.notifications?.notificationEmail || '',
          shopSpecificNotifications: data.notifications?.shopSpecificNotifications || false,
          lowStockAlerts: data.notifications?.lowStockAlerts || false,
          salesReports: data.notifications?.salesReports || false,
          dailyReports: data.notifications?.dailyReports || false,
          weeklyReports: data.notifications?.weeklyReports || false,
          monthlyReports: data.notifications?.monthlyReports || false,
          criticalAlerts: data.notifications?.criticalAlerts || false
        };
      }
      return {
        emailNotifications: false,
        notificationEmail: '',
        shopSpecificNotifications: false,
        lowStockAlerts: false,
        salesReports: false,
        dailyReports: false,
        weeklyReports: false,
        monthlyReports: false,
        criticalAlerts: false
      };
    } catch (error) {
      console.error('Failed to load notification settings:', error);
      return {
        emailNotifications: false,
        notificationEmail: '',
        shopSpecificNotifications: false,
        lowStockAlerts: false,
        salesReports: false,
        dailyReports: false,
        weeklyReports: false,
        monthlyReports: false,
        criticalAlerts: false
      };
    }
  }

  private async logNotification(shopId: number, type: string, details: string): Promise<void> {
    try {
      await prisma.activityLog.create({
        data: {
          userId: 1,
          action: 'notification_sent',
          resource: 'notification',
          resourceId: shopId,
          details: `${type}: ${details}`,
          ipAddress: 'system',
          userAgent: 'notification-service'
        }
      });
    } catch (error) {
      console.error('Failed to log notification:', error);
    }
  }

  // Send test notification
  async sendTestNotification(email: string, shopName: string): Promise<boolean> {
    try {
      const success = await emailService.sendTestNotification(email, shopName);
      if (success) {
        await this.logNotification(1, 'test', `Test notification sent to ${email} for ${shopName}`);
      }
      return success;
    } catch (error) {
      console.error('Failed to send test notification:', error);
      return false;
    }
  }

  // Check and send low stock alerts
  async checkAndSendLowStockAlerts(): Promise<void> {
    try {
      const settings = await this.getNotificationSettings();
      
      if (!settings.emailNotifications || !settings.lowStockAlerts || !settings.notificationEmail) {
        return;
      }

      // Get all shops
      const shops = await prisma.shop.findMany({ where: { isActive: true } });
      
      for (const shop of shops) {
        // Get products with low stock for this shop
        const lowStockProducts = await prisma.product.findMany({
          where: {
            shopId: shop.id,
            AND: [
              {
                stockQuantity: {
                  gt: 0
                }
              },
              {
                minStockLevel: {
                  gt: 0
                }
              }
            ]
          },
          select: {
            id: true,
            name: true,
            stockQuantity: true,
            minStockLevel: true
          }
        });

        // Filter products that are at or below minimum stock level
        const actualLowStockProducts = lowStockProducts.filter(product => 
          product.stockQuantity <= product.minStockLevel
        );

        if (actualLowStockProducts.length > 0) {
          const products = actualLowStockProducts.map(product => ({
            name: product.name,
            currentStock: product.stockQuantity,
            minStock: product.minStockLevel
          }));

          const success = await emailService.sendLowStockAlert(
            settings.notificationEmail,
            shop.name,
            products
          );

          if (success) {
            await this.logNotification(
              shop.id,
              'low_stock_alert',
              `Low stock alert sent for ${products.length} products in ${shop.name}`
            );
          }
        }
      }
    } catch (error) {
      console.error('Failed to check and send low stock alerts:', error);
    }
  }

  // Send daily sales report
  async sendDailySalesReport(): Promise<void> {
    try {
      const settings = await this.getNotificationSettings();
      
      if (!settings.emailNotifications || !settings.dailyReports || !settings.notificationEmail) {
        return;
      }

      const shops = await prisma.shop.findMany({ where: { isActive: true } });
      
      for (const shop of shops) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const startOfDay = new Date(yesterday.setHours(0, 0, 0, 0));
        const endOfDay = new Date(yesterday.setHours(23, 59, 59, 999));

        // Get sales data for yesterday
        const sales = await prisma.sale.findMany({
          where: {
            shopId: shop.id,
            createdAt: {
              gte: startOfDay,
              lte: endOfDay
            }
          },
          include: {
            items: {
              include: {
                product: true
              }
            }
          }
        });

        if (sales.length > 0) {
          const totalSales = sales.reduce((sum, sale) => sum + Number(sale.totalAmount), 0);
          const totalOrders = sales.length;
          const productsSold = sales.reduce((sum, sale) => 
            sum + sale.items.reduce((itemSum, item) => itemSum + Number(item.quantity), 0), 0
          );
          const averageOrderValue = totalSales / totalOrders;

          // Get top selling products
          const productSales = new Map();
          sales.forEach(sale => {
            sale.items.forEach(item => {
              const productName = item.product.name;
              const existing = productSales.get(productName) || { quantity: 0, revenue: 0 };
              productSales.set(productName, {
                quantity: existing.quantity + Number(item.quantity),
                revenue: existing.revenue + Number(item.totalPrice)
              });
            });
          });

          const topProducts = Array.from(productSales.entries())
            .map(([name, data]: [string, any]) => ({
              name,
              quantity: data.quantity,
              revenue: data.revenue
            }))
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 5);

          const reportData = {
            period: `Daily Report - ${startOfDay.toLocaleDateString()}`,
            totalSales,
            totalOrders,
            productsSold,
            averageOrderValue,
            topProducts
          };

          const success = await emailService.sendSalesReport(
            settings.notificationEmail,
            shop.name,
            reportData,
            'Daily'
          );

          if (success) {
            await this.logNotification(
              shop.id,
              'daily_sales_report',
              `Daily sales report sent for ${shop.name} - ${totalOrders} orders, ₹${totalSales.toLocaleString()} revenue`
            );
          }
        }
      }
    } catch (error) {
      console.error('Failed to send daily sales report:', error);
    }
  }

  // Send weekly sales report
  async sendWeeklySalesReport(): Promise<void> {
    try {
      const settings = await this.getNotificationSettings();
      
      if (!settings.emailNotifications || !settings.weeklyReports || !settings.notificationEmail) {
        return;
      }

      const shops = await prisma.shop.findMany({ where: { isActive: true } });
      
      for (const shop of shops) {
        const lastWeek = new Date();
        lastWeek.setDate(lastWeek.getDate() - 7);
        const startOfWeek = new Date(lastWeek.setHours(0, 0, 0, 0));
        const endOfWeek = new Date(lastWeek.setHours(23, 59, 59, 999));

        // Get sales data for last week
        const sales = await prisma.sale.findMany({
          where: {
            shopId: shop.id,
            createdAt: {
              gte: startOfWeek,
              lte: endOfWeek
            }
          },
          include: {
            items: {
              include: {
                product: true
              }
            }
          }
        });

        if (sales.length > 0) {
          const totalSales = sales.reduce((sum, sale) => sum + Number(sale.totalAmount), 0);
          const totalOrders = sales.length;
          const productsSold = sales.reduce((sum, sale) => 
            sum + sale.items.reduce((itemSum, item) => itemSum + Number(item.quantity), 0), 0
          );
          const averageOrderValue = totalSales / totalOrders;

          const reportData = {
            period: `Weekly Report - ${startOfWeek.toLocaleDateString()} to ${endOfWeek.toLocaleDateString()}`,
            totalSales,
            totalOrders,
            productsSold,
            averageOrderValue,
            topProducts: []
          };

          const success = await emailService.sendSalesReport(
            settings.notificationEmail,
            shop.name,
            reportData,
            'Weekly'
          );

          if (success) {
            await this.logNotification(
              shop.id,
              'weekly_sales_report',
              `Weekly sales report sent for ${shop.name} - ${totalOrders} orders, ₹${totalSales.toLocaleString()} revenue`
            );
          }
        }
      }
    } catch (error) {
      console.error('Failed to send weekly sales report:', error);
    }
  }

  // Send critical alert
  async sendCriticalAlert(shopId: number, alertType: string, details: string): Promise<void> {
    try {
      const settings = await this.getNotificationSettings();
      
      if (!settings.emailNotifications || !settings.criticalAlerts || !settings.notificationEmail) {
        return;
      }

      const shop = await prisma.shop.findUnique({ where: { id: shopId } });
      if (!shop) return;

      const success = await emailService.sendCriticalAlert(
        settings.notificationEmail,
        shop.name,
        alertType,
        details
      );

      if (success) {
        await this.logNotification(
          shopId,
          'critical_alert',
          `Critical alert sent for ${shop.name}: ${alertType} - ${details}`
        );
      }
    } catch (error) {
      console.error('Failed to send critical alert:', error);
    }
  }

  // Trigger notification for specific events
  async triggerNotification(shopId: number, type: string, data: any): Promise<void> {
    try {
      const settings = await this.getNotificationSettings();
      
      if (!settings.emailNotifications || !settings.notificationEmail) {
        return;
      }

      const shop = await prisma.shop.findUnique({ where: { id: shopId } });
      if (!shop) return;

      switch (type) {
        case 'low_stock':
          if (settings.lowStockAlerts) {
            await this.checkAndSendLowStockAlerts();
          }
          break;
        case 'critical_alert':
          if (settings.criticalAlerts) {
            await this.sendCriticalAlert(shopId, data.alertType, data.details);
          }
          break;
        case 'sales_report':
          if (settings.salesReports) {
            await emailService.sendSalesReport(
              settings.notificationEmail,
              shop.name,
              data.reportData,
              data.reportType
            );
          }
          break;
      }
    } catch (error) {
      console.error('Failed to trigger notification:', error);
    }
  }
}

export const notificationService = new NotificationService();
export default notificationService; 