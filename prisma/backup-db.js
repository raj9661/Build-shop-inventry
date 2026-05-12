/**
 * ============================================================
 * FULL DATABASE BACKUP SCRIPT
 * ============================================================
 * Exports ALL data from every Prisma model to a timestamped
 * JSON backup file in backups/full-db-backup/.
 *
 * Usage:  node prisma/backup-db.js
 * ============================================================
 */

const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const path = require("path");

const prisma = new PrismaClient();

// ── All 37 models in safe export order ──────────────────────
const MODELS = [
  // Platform administration
  { name: "PlatformOwner",        fn: () => prisma.platformOwner.findMany() },
  { name: "Subscription",         fn: () => prisma.subscription.findMany() },
  { name: "SubscriptionPayment",  fn: () => prisma.subscriptionPayment.findMany() },
  { name: "SubscriptionUsage",    fn: () => prisma.subscriptionUsage.findMany() },
  { name: "Violation",            fn: () => prisma.violation.findMany() },
  { name: "Notification",         fn: () => prisma.notification.findMany() },
  { name: "WebsiteSetting",       fn: () => prisma.websiteSetting.findMany() },
  { name: "PlatformAnalytics",    fn: () => prisma.platformAnalytics.findMany() },

  // Users & auth
  { name: "User",                 fn: () => prisma.user.findMany() },
  { name: "TrustedDevice",        fn: () => prisma.trustedDevice.findMany() },
  { name: "User2FASetting",       fn: () => prisma.user2FASetting.findMany() },
  { name: "UserShopAssignment",   fn: () => prisma.userShopAssignment.findMany() },
  { name: "LoginLog",             fn: () => prisma.loginLog.findMany() },
  { name: "ActivityLog",          fn: () => prisma.activityLog.findMany() },

  // Shop (tenant root)
  { name: "Shop",                 fn: () => prisma.shop.findMany() },

  // Product catalog
  { name: "ProductCategory",      fn: () => prisma.productCategory.findMany() },
  { name: "ProductType",          fn: () => prisma.productType.findMany() },
  { name: "Product",              fn: () => prisma.product.findMany() },
  { name: "DailyProductPrice",    fn: () => prisma.dailyProductPrice.findMany() },
  { name: "ProductUnitConversion",fn: () => prisma.productUnitConversion.findMany() },

  // Suppliers & stock
  { name: "Supplier",             fn: () => prisma.supplier.findMany() },
  { name: "StockEntry",           fn: () => prisma.stockEntry.findMany() },
  { name: "SupplierPayment",      fn: () => prisma.supplierPayment.findMany() },
  { name: "SupplierWeeklyReport", fn: () => prisma.supplierWeeklyReport.findMany() },
  { name: "StockLedger",          fn: () => prisma.stockLedger.findMany() },

  // Employees & payroll
  { name: "Employee",             fn: () => prisma.employee.findMany() },
  { name: "EmployeePayment",      fn: () => prisma.employeePayment.findMany() },
  { name: "EmployeeSalaryDue",    fn: () => prisma.employeeSalaryDue.findMany() },
  { name: "EmployeeAttendance",   fn: () => prisma.employeeAttendance.findMany() },

  // Customers & sales
  { name: "Customer",             fn: () => prisma.customer.findMany() },
  { name: "CustomerSpecialPrice", fn: () => prisma.customerSpecialPrice.findMany() },
  { name: "CustomerLedgerEntry",  fn: () => prisma.customerLedgerEntry.findMany() },
  { name: "Sale",                 fn: () => prisma.sale.findMany() },
  { name: "SaleItem",             fn: () => prisma.saleItem.findMany() },
  { name: "Payment",              fn: () => prisma.payment.findMany() },
  { name: "Expense",              fn: () => prisma.expense.findMany() },
  { name: "SaleDocument",         fn: () => prisma.saleDocument.findMany() },

  // Analytics
  { name: "AnalyticsSummary",       fn: () => prisma.analyticsSummary.findMany() },
  { name: "ProductSalesAnalytics",  fn: () => prisma.productSalesAnalytics.findMany() },
  { name: "BusinessMetric",         fn: () => prisma.businessMetric.findMany() },
  { name: "InventoryAnalytics",     fn: () => prisma.inventoryAnalytics.findMany() },
  { name: "BusinessGoal",           fn: () => prisma.businessGoal.findMany() },

  // TMT system
  { name: "TmtCompany",        fn: () => prisma.tmtCompany.findMany() },
  { name: "TmtSize",           fn: () => prisma.tmtSize.findMany() },
  { name: "TmtProduct",        fn: () => prisma.tmtProduct.findMany() },
  { name: "TmtPurchase",       fn: () => prisma.tmtPurchase.findMany() },
  { name: "TmtPurchaseItem",   fn: () => prisma.tmtPurchaseItem.findMany() },
  { name: "TmtInventory",      fn: () => prisma.tmtInventory.findMany() },
  { name: "TmtSale",           fn: () => prisma.tmtSale.findMany() },
  { name: "TmtSaleItem",       fn: () => prisma.tmtSaleItem.findMany() },

  // Audit
  { name: "AdminAuditLog",     fn: () => prisma.adminAuditLog.findMany() },
];

// ── BigInt serializer ────────────────────────────────────────
function replacer(key, value) {
  if (typeof value === "bigint") return value.toString();
  return value;
}

async function main() {
  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .slice(0, 19);

  const backupDir = path.join(__dirname, "..", "backups", "full-db-backup");
  const backupFile = path.join(backupDir, `backup-${timestamp}.json`);

  fs.mkdirSync(backupDir, { recursive: true });

  console.log("=".repeat(60));
  console.log(" FULL DATABASE BACKUP");
  console.log(`  Timestamp : ${timestamp}`);
  console.log(`  Output    : ${backupFile}`);
  console.log("=".repeat(60));

  const backup = {
    meta: {
      timestamp: new Date().toISOString(),
      version: "1.0",
      source: "CockroachDB — build-shop-inventry",
      totalModels: MODELS.length,
    },
    tables: {},
    summary: {},
  };

  let grandTotal = 0;
  const errors = [];

  for (const model of MODELS) {
    process.stdout.write(`  Exporting ${model.name.padEnd(28, ".")} `);
    try {
      const rows = await model.fn();
      backup.tables[model.name] = rows;
      backup.summary[model.name] = rows.length;
      grandTotal += rows.length;
      console.log(`${rows.length} rows`);
    } catch (err) {
      console.log(`ERROR: ${err.message}`);
      errors.push({ model: model.name, error: err.message });
      backup.tables[model.name] = [];
      backup.summary[model.name] = 0;
    }
  }

  // Write backup file
  const json = JSON.stringify(backup, replacer, 2);
  fs.writeFileSync(backupFile, json, "utf8");

  const fileSizeMB = (fs.statSync(backupFile).size / 1024 / 1024).toFixed(2);

  console.log("=".repeat(60));
  console.log(`  Total rows backed up : ${grandTotal.toLocaleString()}`);
  console.log(`  File size            : ${fileSizeMB} MB`);
  console.log(`  Backup file          : ${backupFile}`);

  if (errors.length > 0) {
    console.log(`\n  ⚠ ERRORS (${errors.length} models failed):`);
    for (const e of errors) {
      console.log(`    - ${e.model}: ${e.error}`);
    }
    process.exit(1);
  } else {
    console.log("\n  ✅ Backup completed successfully — NO errors");
  }

  console.log("=".repeat(60));
}

main()
  .catch((err) => {
    console.error("\nFATAL backup error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
