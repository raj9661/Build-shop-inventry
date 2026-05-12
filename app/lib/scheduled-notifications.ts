import { notificationService } from './notification-service';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

class ScheduledNotifications {
  // Run daily tasks
  async runDailyTasks() {
    try {
      console.log('Running daily notification tasks...');
      
      // Send daily sales reports
      await notificationService.sendDailySalesReport();
      
      // Check for low stock alerts
      await notificationService.checkAndSendLowStockAlerts();
      
      console.log('Daily notification tasks completed');
    } catch (error) {
      console.error('Error running daily notification tasks:', error);
    }
  }

  // Run weekly tasks
  async runWeeklyTasks() {
    try {
      console.log('Running weekly notification tasks...');
      
      // Send weekly sales reports
      await notificationService.sendWeeklySalesReport();
      
      console.log('Weekly notification tasks completed');
    } catch (error) {
      console.error('Error running weekly notification tasks:', error);
    }
  }

  // Run monthly tasks
  async runMonthlyTasks() {
    try {
      console.log('Running monthly notification tasks...');
      
      // TODO: Implement monthly sales reports
      // await notificationService.sendMonthlySalesReport();
      
      console.log('Monthly notification tasks completed');
    } catch (error) {
      console.error('Error running monthly notification tasks:', error);
    }
  }

  // Check for critical alerts
  async checkCriticalAlerts() {
    try {
      console.log('Checking for critical alerts...');
      
      // Get all active shops
      const shops = await prisma.shop.findMany({ where: { isActive: true } });
      
      for (const shop of shops) {
        // Check for out of stock products
        const outOfStockProducts = await prisma.product.findMany({
          where: {
            shopId: shop.id,
            stockQuantity: 0
          },
          select: {
            id: true,
            name: true,
            stockQuantity: true
          }
        });

        if (outOfStockProducts.length > 0) {
          await notificationService.sendCriticalAlert(
            shop.id,
            'Out of Stock Products',
            `${outOfStockProducts.length} products are completely out of stock: ${outOfStockProducts.map(p => p.name).join(', ')}`
          );
        }

        // Check for very low stock products (below 10% of min stock)
        const veryLowStockProducts = await prisma.product.findMany({
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

        // Filter products that are below 10% of min stock level
        const criticalLowStockProducts = veryLowStockProducts.filter(product => 
          product.stockQuantity < (product.minStockLevel * 0.1)
        );

        if (criticalLowStockProducts.length > 0) {
          await notificationService.sendCriticalAlert(
            shop.id,
            'Critical Low Stock',
            `${criticalLowStockProducts.length} products have critically low stock (below 10% of minimum): ${criticalLowStockProducts.map(p => `${p.name} (${p.stockQuantity}/${p.minStockLevel})`).join(', ')}`
          );
        }
      }
      
      console.log('Critical alerts check completed');
    } catch (error) {
      console.error('Error checking critical alerts:', error);
    }
  }

  // Start the scheduled notification service
  startScheduledNotifications() {
    console.log('Starting scheduled notification service...');
    
    // Run daily tasks at 9 AM every day
    setInterval(async () => {
      const now = new Date();
      if (now.getHours() === 9 && now.getMinutes() === 0) {
        await this.runDailyTasks();
      }
    }, 60000); // Check every minute

    // Run weekly tasks on Monday at 9 AM
    setInterval(async () => {
      const now = new Date();
      if (now.getDay() === 1 && now.getHours() === 9 && now.getMinutes() === 0) {
        await this.runWeeklyTasks();
      }
    }, 60000); // Check every minute

    // Run monthly tasks on the 1st of each month at 9 AM
    setInterval(async () => {
      const now = new Date();
      if (now.getDate() === 1 && now.getHours() === 9 && now.getMinutes() === 0) {
        await this.runMonthlyTasks();
      }
    }, 60000); // Check every minute

    // Check for critical alerts every 2 hours
    setInterval(async () => {
      await this.checkCriticalAlerts();
    }, 2 * 60 * 60 * 1000); // Every 2 hours

    console.log('Scheduled notification service started');
  }
}

export const scheduledNotifications = new ScheduledNotifications();

// Start the service when this module is imported
if (typeof window === 'undefined') {
  // Only run on server side
  scheduledNotifications.startScheduledNotifications();
}

export default scheduledNotifications; 