import { prisma } from '@/lib/prisma';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import os from 'os';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface BackupSettings {
  backupFrequency: string;
  retentionDays: number;
  autoBackup: boolean;
}

interface BackupRecord {
  id: string;
  filename: string;
  size: number;
  createdAt: Date;
  status: 'success' | 'failed';
  error?: string;
}

class BackupService {
  private baseBackupDir: string;
  private settings: BackupSettings;

  constructor() {
    // In serverless environments like Vercel, the filesystem is read-only
    // except for the /tmp directory.
    const cwd = process.cwd();
    const isServerless = process.env.VERCEL === '1' || process.env.AWS_REGION || cwd.includes('/var/task') || cwd.includes('/opt');
    const basePath = isServerless ? os.tmpdir() : cwd;

    this.baseBackupDir = path.join(basePath, 'backups');
    this.settings = {
      backupFrequency: 'daily',
      retentionDays: 30,
      autoBackup: true
    };
    // Only ensure directory exists if we're in a server context
    if (typeof window === 'undefined') {
      try {
        this.ensureBaseBackupDirectory();
      } catch (error) {
        console.error('Failed to initialize backup directory:', error);
      }
    }
  }

  private ensureBaseBackupDirectory() {
    if (!fs.existsSync(this.baseBackupDir)) {
      fs.mkdirSync(this.baseBackupDir, { recursive: true });
    }
  }

  private getUserBackupDir(userId: number): string {
    return path.join(this.baseBackupDir, `user-${userId}`);
  }

  private ensureUserBackupDirectory(userId: number) {
    const userBackupDir = this.getUserBackupDir(userId);
    if (!fs.existsSync(userBackupDir)) {
      fs.mkdirSync(userBackupDir, { recursive: true });
    }
  }

  private bigIntReplacer(key: string, value: any): any {
    // Convert BigInt values to strings for JSON serialization
    if (typeof value === 'bigint') {
      return value.toString();
    }
    return value;
  }

  private bigIntReviver(key: string, value: any): any {
    // Convert string values back to BigInt for database operations
    // Only convert fields that are typically BigInt in the database
    const bigIntFields = ['id', 'userId', 'shopId', 'productId', 'supplierId', 'customerId', 'saleId', 'purchaseId', 'paymentId', 'employeeId', 'categoryId', 'typeId', 'companyId', 'sizeId', 'subscriptionId', 'platformOwnerId', 'violationId', 'notificationId', 'analyticsId', 'expenseId', 'reportId', 'priceId', 'specialPriceId', 'ledgerId', 'sessionId', 'deviceId', 'assignmentId', 'logId', 'settingId', 'createdBy', 'updatedBy', 'assignedTo', 'createdById', 'updatedById', 'assignedToId'];

    if (bigIntFields.includes(key) && typeof value === 'string' && /^\d+$/.test(value)) {
      return BigInt(value);
    }
    return value;
  }

  private async backupTable(tableName: string, queryFn: () => Promise<any[]>): Promise<any[]> {
    try {
      console.log(`Backing up ${tableName}...`);
      const data = await queryFn();
      console.log(`✅ ${tableName}: ${data.length} records`);
      return data;
    } catch (error) {
      console.error(`❌ Failed to backup ${tableName}:`, error);
      // Return empty array to continue backup process
      return [];
    }
  }

  private async deleteTable(tableName: string): Promise<void> {
    try {
      console.log(`Deleting ${tableName}...`);
      const result = await (prisma as any)[tableName].deleteMany();
      console.log(`✅ ${tableName}: ${result.count} records deleted`);
    } catch (error) {
      console.error(`❌ Failed to delete ${tableName}:`, error);
      // Continue with other tables even if one fails
    }
  }

  private async restoreTable(tableName: string, data: any[], restoreFn: () => Promise<any>): Promise<void> {
    try {
      if (data && data.length > 0) {
        console.log(`Restoring ${tableName}...`);
        await restoreFn();
        console.log(`✅ ${tableName}: ${data.length} records restored`);
      } else {
        console.log(`⏭️ ${tableName}: No data to restore`);
      }
    } catch (error) {
      console.error(`❌ Failed to restore ${tableName}:`, error);
      // Continue with other tables even if one fails
    }
  }

  async loadSettings(): Promise<void> {
    // Use default settings for now
    // In the future, this could be loaded from a settings table or environment variables
    this.settings = {
      backupFrequency: process.env.BACKUP_FREQUENCY || 'daily',
      retentionDays: parseInt(process.env.BACKUP_RETENTION_DAYS || '30'),
      autoBackup: process.env.AUTO_BACKUP !== 'false'
    };
  }

  async createBackup(userId: number): Promise<BackupRecord> {
    this.ensureUserBackupDirectory(userId);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup-${timestamp}.json`;
    const userBackupDir = this.getUserBackupDir(userId);
    const filepath = path.join(userBackupDir, filename);

    try {
      // Create a comprehensive backup using Prisma
      const backupData = await this.createPrismaBackup();

      // Write backup data to file with BigInt serialization
      const backupContent = JSON.stringify(backupData, this.bigIntReplacer, 2);
      await fs.promises.writeFile(filepath, backupContent, 'utf8');

      const stats = fs.statSync(filepath);
      const size = stats.size;

      const backupRecord: BackupRecord = {
        id: timestamp,
        filename,
        size,
        createdAt: new Date(),
        status: 'success'
      };

      await this.logBackup(backupRecord, userId);
      console.log(`Backup created successfully for user ${userId}: ${filename} (${size} bytes)`);

      return backupRecord;
    } catch (error) {
      const backupRecord: BackupRecord = {
        id: timestamp,
        filename,
        size: 0,
        createdAt: new Date(),
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      };

      await this.logBackup(backupRecord, userId);
      console.error('Backup failed:', error);
      throw error;
    }
  }

  private async createPrismaBackup(): Promise<any> {
    console.log('Starting comprehensive database backup...');

    // Create a comprehensive backup of all data
    const backupData = {
      metadata: {
        version: '1.0',
        createdAt: new Date().toISOString(),
        type: 'prisma-backup'
      },
      data: {
        // Core business data
        users: await this.backupTable('users', () => prisma.user.findMany()),
        shops: await this.backupTable('shops', () => prisma.shop.findMany()),
        productCategories: await this.backupTable('productCategories', () => prisma.productCategory.findMany()),
        productTypes: await this.backupTable('productTypes', () => prisma.productType.findMany()),
        products: await this.backupTable('products', () => prisma.product.findMany()),
        suppliers: await this.backupTable('suppliers', () => prisma.supplier.findMany()),
        customers: await this.backupTable('customers', () => prisma.customer.findMany()),

        // Transaction data
        sales: await this.backupTable('sales', () => prisma.sale.findMany()),
        saleItems: await this.backupTable('saleItems', () => prisma.saleItem.findMany()),
        tmtPurchases: await this.backupTable('tmtPurchases', () => prisma.tmtPurchase.findMany()),
        tmtPurchaseItems: await this.backupTable('tmtPurchaseItems', () => prisma.tmtPurchaseItem.findMany()),

        // Inventory data
        stockEntries: await this.backupTable('stockEntries', () => prisma.stockEntry.findMany()),
        tmtInventory: await this.backupTable('tmtInventory', () => prisma.tmtInventory.findMany()),

        // Financial data
        payments: await this.backupTable('payments', () => prisma.payment.findMany()),
        customerLedgerEntries: await this.backupTable('customerLedgerEntries', () => prisma.customerLedgerEntry.findMany()),
        supplierPayments: await this.backupTable('supplierPayments', () => prisma.supplierPayment.findMany()),

        // System data
        activityLogs: await this.backupTable('activityLogs', () => prisma.activityLog.findMany()),
        loginLogs: await this.backupTable('loginLogs', () => prisma.loginLog.findMany()),
        trustedDevices: await this.backupTable('trustedDevices', () => prisma.trustedDevice.findMany()),

        // TMT specific data
        tmtCompanies: await this.backupTable('tmtCompanies', () => prisma.tmtCompany.findMany()),
        tmtSizes: await this.backupTable('tmtSizes', () => prisma.tmtSize.findMany()),
        tmtProducts: await this.backupTable('tmtProducts', () => prisma.tmtProduct.findMany()),
        tmtSales: await this.backupTable('tmtSales', () => prisma.tmtSale.findMany()),
        tmtSaleItems: await this.backupTable('tmtSaleItems', () => prisma.tmtSaleItem.findMany()),

        // Employee data
        employees: await this.backupTable('employees', () => prisma.employee.findMany()),
        employeePayments: await this.backupTable('employeePayments', () => prisma.employeePayment.findMany()),
        employeeSalaryDues: await this.backupTable('employeeSalaryDues', () => prisma.employeeSalaryDue.findMany()),

        // Analytics data
        analyticsSummaries: await this.backupTable('analyticsSummaries', () => prisma.analyticsSummary.findMany()),
        productSalesAnalytics: await this.backupTable('productSalesAnalytics', () => prisma.productSalesAnalytics.findMany()),

        // Platform data
        platformOwners: await this.backupTable('platformOwners', () => prisma.platformOwner.findMany()),
        subscriptions: await this.backupTable('subscriptions', () => prisma.subscription.findMany()),
        subscriptionPayments: await this.backupTable('subscriptionPayments', () => prisma.subscriptionPayment.findMany()),
        subscriptionUsages: await this.backupTable('subscriptionUsages', () => prisma.subscriptionUsage.findMany()),
        violations: await this.backupTable('violations', () => prisma.violation.findMany()),
        notifications: await this.backupTable('notifications', () => prisma.notification.findMany()),
        platformAnalytics: await this.backupTable('platformAnalytics', () => prisma.platformAnalytics.findMany()),

        // Settings and configurations
        websiteSettings: await this.backupTable('websiteSettings', () => prisma.websiteSetting.findMany()),
        user2FASettings: await this.backupTable('user2FASettings', () => prisma.user2FASetting.findMany()),
        userShopAssignments: await this.backupTable('userShopAssignments', () => prisma.userShopAssignment.findMany())
      }
    };

    console.log('✅ Database backup completed successfully');
    return backupData;
  }

  private async logBackup(backupRecord: BackupRecord, userId: number): Promise<void> {
    try {
      await prisma.activityLog.create({
        data: {
          userId: userId,
          action: 'database_backup',
          resource: 'database',
          resourceId: 1,
          details: `Backup ${backupRecord.status}: ${backupRecord.filename} (${backupRecord.size} bytes)`,
          ipAddress: 'system',
          userAgent: 'backup-service'
        }
      });
    } catch (error) {
      console.error('Failed to log backup activity:', error);
    }
  }

  async cleanupOldBackups(userId: number): Promise<{ deletedCount: number; message: string }> {
    try {
      await this.loadSettings();
      const userBackupDir = this.getUserBackupDir(userId);

      console.log('Cleanup settings for user', userId, ':', {
        autoBackup: this.settings.autoBackup,
        retentionDays: this.settings.retentionDays,
        backupDir: userBackupDir
      });

      // Check if backup directory exists
      if (!fs.existsSync(userBackupDir)) {
        console.log('Backup directory does not exist for user', userId, ':', userBackupDir);
        return { deletedCount: 0, message: 'Backup directory does not exist for user' };
      }

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.settings.retentionDays);
      console.log('Cutoff date for cleanup:', cutoffDate.toISOString());

      const files = fs.readdirSync(userBackupDir);
      console.log('Total files in backup directory for user', userId, ':', files.length);

      const jsonFiles = files.filter(file => file.endsWith('.json'));
      console.log('JSON backup files found for user', userId, ':', jsonFiles.length);

      let deletedCount = 0;
      const filesToDelete: string[] = [];

      for (const file of jsonFiles) {
        const filepath = path.join(userBackupDir, file);
        const stats = fs.statSync(filepath);

        console.log(`File: ${file}, Modified: ${stats.mtime.toISOString()}, Older than cutoff: ${stats.mtime < cutoffDate}`);

        if (stats.mtime < cutoffDate) {
          filesToDelete.push(file);
        }
      }

      console.log('Files to delete:', filesToDelete);

      for (const file of filesToDelete) {
        const filepath = path.join(userBackupDir, file);
        fs.unlinkSync(filepath);
        deletedCount++;
        console.log(`Deleted old backup for user ${userId}: ${file}`);
      }

      if (deletedCount > 0) {
        await prisma.activityLog.create({
          data: {
            userId: userId,
            action: 'backup_cleanup',
            resource: 'database',
            resourceId: 1,
            details: `Deleted ${deletedCount} old backups for user ${userId} (older than ${this.settings.retentionDays} days)`,
            ipAddress: 'system',
            userAgent: 'backup-service'
          }
        });
      }

      const message = `Cleanup completed: ${deletedCount} old backups deleted (retention: ${this.settings.retentionDays} days)`;
      console.log(message);

      return { deletedCount, message };
    } catch (error) {
      console.error('Backup cleanup failed:', error);
      throw error;
    }
  }

  async getBackupSchedule(): Promise<{ nextBackup: Date; frequency: string }> {
    await this.loadSettings();

    const now = new Date();
    let nextBackup = new Date(now);

    switch (this.settings.backupFrequency) {
      case 'hourly':
        nextBackup.setHours(now.getHours() + 1, 0, 0, 0);
        break;
      case 'daily':
        nextBackup.setDate(now.getDate() + 1);
        nextBackup.setHours(2, 0, 0, 0);
        break;
      case 'weekly':
        nextBackup.setDate(now.getDate() + 7);
        nextBackup.setHours(2, 0, 0, 0);
        break;
      case 'monthly':
        nextBackup.setMonth(now.getMonth() + 1);
        nextBackup.setDate(1);
        nextBackup.setHours(2, 0, 0, 0);
        break;
      default:
        nextBackup.setDate(now.getDate() + 1);
        nextBackup.setHours(2, 0, 0, 0);
    }

    return {
      nextBackup,
      frequency: this.settings.backupFrequency
    };
  }

  async shouldRunBackup(): Promise<boolean> {
    await this.loadSettings();

    if (!this.settings.autoBackup) {
      return false;
    }

    return true;
  }

  async listBackups(userId: number): Promise<BackupRecord[]> {
    try {
      const userBackupDir = this.getUserBackupDir(userId);

      // Check if directory exists
      if (!fs.existsSync(userBackupDir)) {
        return [];
      }

      const files = fs.readdirSync(userBackupDir);
      const backups: BackupRecord[] = [];

      for (const file of files) {
        if (!file.endsWith('.json')) continue;

        const filepath = path.join(userBackupDir, file);
        const stats = fs.statSync(filepath);

        backups.push({
          id: file.replace('.sql', ''),
          filename: file,
          size: stats.size,
          createdAt: stats.mtime,
          status: 'success'
        });
      }

      return backups.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    } catch (error) {
      console.error('Failed to list backups:', error);
      return [];
    }
  }

  async restoreBackup(filename: string, userId: number): Promise<void> {
    const userBackupDir = this.getUserBackupDir(userId);
    const filepath = path.join(userBackupDir, filename);

    if (!fs.existsSync(filepath)) {
      throw new Error(`Backup file not found for user ${userId}: ${filename}`);
    }

    try {
      // Read and parse the backup file
      const backupContent = await fs.promises.readFile(filepath, 'utf8');
      const backupData = JSON.parse(backupContent, this.bigIntReviver);

      // Validate backup format
      if (!backupData.metadata || !backupData.data) {
        throw new Error('Invalid backup file format');
      }

      // Restore data using Prisma
      await this.restorePrismaBackup(backupData);

      await prisma.activityLog.create({
        data: {
          userId: userId,
          action: 'database_restore',
          resource: 'database',
          resourceId: 1,
          details: `Database restored from backup for user ${userId}: ${filename}`,
          ipAddress: 'system',
          userAgent: 'backup-service'
        }
      });

      console.log(`Database restored successfully from: ${filename}`);
    } catch (error) {
      console.error('Database restore failed:', error);
      throw error;
    }
  }

  private async restorePrismaBackup(backupData: any): Promise<void> {
    const { data } = backupData;

    console.log('Starting database restoration...');

    // Clear existing data (in reverse order of dependencies)
    // Start with the most dependent tables first
    await this.deleteTable('userShopAssignment');
    await this.deleteTable('user2FASetting');
    await this.deleteTable('trustedDevice');
    await this.deleteTable('loginLog');
    await this.deleteTable('activityLog');
    await this.deleteTable('customerLedgerEntry');
    await this.deleteTable('payment');
    await this.deleteTable('saleItem');
    await this.deleteTable('sale');
    await this.deleteTable('tmtSaleItem');
    await this.deleteTable('tmtSale');
    await this.deleteTable('tmtPurchaseItem');
    await this.deleteTable('tmtPurchase');
    await this.deleteTable('stockEntry');
    await this.deleteTable('tmtInventory');
    await this.deleteTable('supplierPayment');
    await this.deleteTable('employeePayment');
    await this.deleteTable('employeeSalaryDue');
    await this.deleteTable('employee');
    await this.deleteTable('customerSpecialPrice');
    await this.deleteTable('customer');
    await this.deleteTable('supplier');
    await this.deleteTable('product');
    await this.deleteTable('productType');
    await this.deleteTable('productCategory');
    await this.deleteTable('shop');

    // Delete subscription-related tables before users
    await this.deleteTable('subscriptionUsage');
    await this.deleteTable('subscriptionPayment');
    await this.deleteTable('subscription');

    // Now safe to delete users
    await this.deleteTable('user');

    // Delete remaining tables
    await this.deleteTable('websiteSetting');
    await this.deleteTable('platformAnalytics');
    await this.deleteTable('notification');
    await this.deleteTable('violation');
    await this.deleteTable('platformOwner');
    await this.deleteTable('productSalesAnalytics');
    await this.deleteTable('analyticsSummary');
    await this.deleteTable('expense');
    await this.deleteTable('supplierWeeklyReport');
    await this.deleteTable('dailyProductPrice');
    await this.deleteTable('tmtProduct');
    await this.deleteTable('tmtSize');
    await this.deleteTable('tmtCompany');

    // Restore data (in order of dependencies)
    console.log('Restoring data from backup...');

    await this.restoreTable('platformOwners', data.platformOwners, () => prisma.platformOwner.createMany({ data: data.platformOwners }));
    await this.restoreTable('users', data.users, () => prisma.user.createMany({ data: data.users }));
    await this.restoreTable('shops', data.shops, () => prisma.shop.createMany({ data: data.shops }));
    await this.restoreTable('productCategories', data.productCategories, () => prisma.productCategory.createMany({ data: data.productCategories }));
    await this.restoreTable('productTypes', data.productTypes, () => prisma.productType.createMany({ data: data.productTypes }));
    await this.restoreTable('products', data.products, () => prisma.product.createMany({ data: data.products }));
    await this.restoreTable('suppliers', data.suppliers, () => prisma.supplier.createMany({ data: data.suppliers }));
    await this.restoreTable('customers', data.customers, () => prisma.customer.createMany({ data: data.customers }));
    await this.restoreTable('customerSpecialPrices', data.customerSpecialPrices, () => prisma.customerSpecialPrice.createMany({ data: data.customerSpecialPrices }));
    await this.restoreTable('employees', data.employees, () => prisma.employee.createMany({ data: data.employees }));
    await this.restoreTable('sales', data.sales, () => prisma.sale.createMany({ data: data.sales }));
    await this.restoreTable('saleItems', data.saleItems, () => prisma.saleItem.createMany({ data: data.saleItems }));
    await this.restoreTable('tmtPurchases', data.tmtPurchases, () => prisma.tmtPurchase.createMany({ data: data.tmtPurchases }));
    await this.restoreTable('tmtPurchaseItems', data.tmtPurchaseItems, () => prisma.tmtPurchaseItem.createMany({ data: data.tmtPurchaseItems }));
    await this.restoreTable('stockEntries', data.stockEntries, () => prisma.stockEntry.createMany({ data: data.stockEntries }));
    await this.restoreTable('tmtInventory', data.tmtInventory, () => prisma.tmtInventory.createMany({ data: data.tmtInventory }));
    await this.restoreTable('payments', data.payments, () => prisma.payment.createMany({ data: data.payments }));
    await this.restoreTable('customerLedgerEntries', data.customerLedgerEntries, () => prisma.customerLedgerEntry.createMany({ data: data.customerLedgerEntries }));
    await this.restoreTable('supplierPayments', data.supplierPayments, () => prisma.supplierPayment.createMany({ data: data.supplierPayments }));
    await this.restoreTable('employeePayments', data.employeePayments, () => prisma.employeePayment.createMany({ data: data.employeePayments }));
    await this.restoreTable('employeeSalaryDues', data.employeeSalaryDues, () => prisma.employeeSalaryDue.createMany({ data: data.employeeSalaryDues }));
    await this.restoreTable('activityLogs', data.activityLogs, () => prisma.activityLog.createMany({ data: data.activityLogs }));
    await this.restoreTable('loginLogs', data.loginLogs, () => prisma.loginLog.createMany({ data: data.loginLogs }));
    await this.restoreTable('trustedDevices', data.trustedDevices, () => prisma.trustedDevice.createMany({ data: data.trustedDevices }));
    await this.restoreTable('tmtCompanies', data.tmtCompanies, () => prisma.tmtCompany.createMany({ data: data.tmtCompanies }));
    await this.restoreTable('tmtSizes', data.tmtSizes, () => prisma.tmtSize.createMany({ data: data.tmtSizes }));
    await this.restoreTable('tmtProducts', data.tmtProducts, () => prisma.tmtProduct.createMany({ data: data.tmtProducts }));
    await this.restoreTable('tmtSales', data.tmtSales, () => prisma.tmtSale.createMany({ data: data.tmtSales }));
    await this.restoreTable('tmtSaleItems', data.tmtSaleItems, () => prisma.tmtSaleItem.createMany({ data: data.tmtSaleItems }));
    await this.restoreTable('analyticsSummaries', data.analyticsSummaries, () => prisma.analyticsSummary.createMany({ data: data.analyticsSummaries }));
    await this.restoreTable('productSalesAnalytics', data.productSalesAnalytics, () => prisma.productSalesAnalytics.createMany({ data: data.productSalesAnalytics }));
    await this.restoreTable('subscriptions', data.subscriptions, () => prisma.subscription.createMany({ data: data.subscriptions }));
    await this.restoreTable('subscriptionPayments', data.subscriptionPayments, () => prisma.subscriptionPayment.createMany({ data: data.subscriptionPayments }));
    await this.restoreTable('subscriptionUsages', data.subscriptionUsages, () => prisma.subscriptionUsage.createMany({ data: data.subscriptionUsages }));
    await this.restoreTable('violations', data.violations, () => prisma.violation.createMany({ data: data.violations }));
    await this.restoreTable('notifications', data.notifications, () => prisma.notification.createMany({ data: data.notifications }));
    await this.restoreTable('platformAnalytics', data.platformAnalytics, () => prisma.platformAnalytics.createMany({ data: data.platformAnalytics }));
    await this.restoreTable('websiteSettings', data.websiteSettings, () => prisma.websiteSetting.createMany({ data: data.websiteSettings }));
    await this.restoreTable('user2FASettings', data.user2FASettings, () => prisma.user2FASetting.createMany({ data: data.user2FASettings }));
    await this.restoreTable('userShopAssignments', data.userShopAssignments, () => prisma.userShopAssignment.createMany({ data: data.userShopAssignments }));

    console.log('✅ Database restoration completed successfully');
  }
}

export const backupService = new BackupService();

