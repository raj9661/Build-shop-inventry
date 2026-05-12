import { backupService } from './backup-service';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

class ScheduledBackupService {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;

  async start() {
    if (this.isRunning) {
      console.log('Scheduled backup service is already running');
      return;
    }

    this.isRunning = true;
    console.log('Starting scheduled backup service...');

    // Check every hour if we need to run a backup
    this.intervalId = setInterval(async () => {
      try {
        await this.checkAndRunBackup();
      } catch (error) {
        console.error('Error in scheduled backup check:', error);
      }
    }, 60 * 60 * 1000); // Check every hour

    // Also run cleanup daily for all users
    setInterval(async () => {
      try {
        await this.runCleanupForAllUsers();
      } catch (error) {
        console.error('Error in scheduled cleanup:', error);
      }
    }, 24 * 60 * 60 * 1000); // Run daily

    // Initial check
    await this.checkAndRunBackup();
  }

  async stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('Scheduled backup service stopped');
  }

  private async checkAndRunBackup() {
    try {
      const shouldRun = await backupService.shouldRunBackup();
      
      if (shouldRun) {
        console.log('Scheduled backup triggered for all users');
        await this.runBackupForAllUsers();
        console.log('Scheduled backup completed for all users');
      }
    } catch (error) {
      console.error('Failed to run scheduled backup:', error);
    }
  }

  private async runBackupForAllUsers() {
    try {
      // Get all SUPER_DUPER_ADMIN users
      const users = await prisma.user.findMany({
        where: { role: 'SUPER_DUPER_ADMIN' },
        select: { id: true, name: true, email: true }
      });

      console.log(`Running scheduled backup for ${users.length} users`);

      for (const user of users) {
        try {
          await backupService.createBackup(Number(user.id));
          console.log(`Scheduled backup completed for user ${user.name} (${user.email})`);
        } catch (error) {
          console.error(`Failed to create backup for user ${user.name} (${user.email}):`, error);
        }
      }
    } catch (error) {
      console.error('Failed to run backup for all users:', error);
    }
  }

  private async runCleanupForAllUsers() {
    try {
      // Get all SUPER_DUPER_ADMIN users
      const users = await prisma.user.findMany({
        where: { role: 'SUPER_DUPER_ADMIN' },
        select: { id: true, name: true, email: true }
      });

      console.log(`Running scheduled cleanup for ${users.length} users`);

      for (const user of users) {
        try {
          await backupService.cleanupOldBackups(Number(user.id));
          console.log(`Scheduled cleanup completed for user ${user.name} (${user.email})`);
        } catch (error) {
          console.error(`Failed to cleanup backups for user ${user.name} (${user.email}):`, error);
        }
      }
    } catch (error) {
      console.error('Failed to run cleanup for all users:', error);
    }
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      hasInterval: this.intervalId !== null
    };
  }
}

export const scheduledBackupService = new ScheduledBackupService();

// Start the service when this module is imported (in production)
// Only start if we're in a server environment
if (process.env.NODE_ENV === 'production' && typeof window === 'undefined') {
  scheduledBackupService.start().catch(console.error);
} 