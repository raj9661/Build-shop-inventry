/**
 * ============================================================
 * DATABASE INTEGRITY VERIFICATION
 * ============================================================
 * Compares live DB row counts against the latest backup.
 * Reports any table where counts differ (data loss indicator).
 * ============================================================
 */

const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const path = require("path");

const prisma = new PrismaClient();

const MODELS = [
  { name: "PlatformOwner",         fn: () => prisma.platformOwner.count() },
  { name: "Subscription",          fn: () => prisma.subscription.count() },
  { name: "SubscriptionPayment",   fn: () => prisma.subscriptionPayment.count() },
  { name: "SubscriptionUsage",     fn: () => prisma.subscriptionUsage.count() },
  { name: "Violation",             fn: () => prisma.violation.count() },
  { name: "Notification",          fn: () => prisma.notification.count() },
  { name: "WebsiteSetting",        fn: () => prisma.websiteSetting.count() },
  { name: "PlatformAnalytics",     fn: () => prisma.platformAnalytics.count() },
  { name: "User",                  fn: () => prisma.user.count() },
  { name: "TrustedDevice",         fn: () => prisma.trustedDevice.count() },
  { name: "User2FASetting",        fn: () => prisma.user2FASetting.count() },
  { name: "UserShopAssignment",    fn: () => prisma.userShopAssignment.count() },
  { name: "LoginLog",              fn: () => prisma.loginLog.count() },
  { name: "ActivityLog",           fn: () => prisma.activityLog.count() },
  { name: "Shop",                  fn: () => prisma.shop.count() },
  { name: "ProductCategory",       fn: () => prisma.productCategory.count() },
  { name: "ProductType",           fn: () => prisma.productType.count() },
  { name: "Product",               fn: () => prisma.product.count() },
  { name: "DailyProductPrice",     fn: () => prisma.dailyProductPrice.count() },
  { name: "ProductUnitConversion", fn: () => prisma.productUnitConversion.count() },
  { name: "Supplier",              fn: () => prisma.supplier.count() },
  { name: "StockEntry",            fn: () => prisma.stockEntry.count() },
  { name: "SupplierPayment",       fn: () => prisma.supplierPayment.count() },
  { name: "SupplierWeeklyReport",  fn: () => prisma.supplierWeeklyReport.count() },
  { name: "StockLedger",           fn: () => prisma.stockLedger.count() },
  { name: "Employee",              fn: () => prisma.employee.count() },
  { name: "EmployeePayment",       fn: () => prisma.employeePayment.count() },
  { name: "EmployeeSalaryDue",     fn: () => prisma.employeeSalaryDue.count() },
  { name: "EmployeeAttendance",    fn: () => prisma.employeeAttendance.count() },
  { name: "Customer",              fn: () => prisma.customer.count() },
  { name: "CustomerSpecialPrice",  fn: () => prisma.customerSpecialPrice.count() },
  { name: "CustomerLedgerEntry",   fn: () => prisma.customerLedgerEntry.count() },
  { name: "Sale",                  fn: () => prisma.sale.count() },
  { name: "SaleItem",              fn: () => prisma.saleItem.count() },
  { name: "Payment",               fn: () => prisma.payment.count() },
  { name: "Expense",               fn: () => prisma.expense.count() },
  { name: "SaleDocument",          fn: () => prisma.saleDocument.count() },
  { name: "AnalyticsSummary",      fn: () => prisma.analyticsSummary.count() },
  { name: "ProductSalesAnalytics", fn: () => prisma.productSalesAnalytics.count() },
  { name: "BusinessMetric",        fn: () => prisma.businessMetric.count() },
  { name: "InventoryAnalytics",    fn: () => prisma.inventoryAnalytics.count() },
  { name: "BusinessGoal",          fn: () => prisma.businessGoal.count() },
  { name: "TmtCompany",            fn: () => prisma.tmtCompany.count() },
  { name: "TmtSize",               fn: () => prisma.tmtSize.count() },
  { name: "TmtProduct",            fn: () => prisma.tmtProduct.count() },
  { name: "TmtPurchase",           fn: () => prisma.tmtPurchase.count() },
  { name: "TmtPurchaseItem",       fn: () => prisma.tmtPurchaseItem.count() },
  { name: "TmtInventory",          fn: () => prisma.tmtInventory.count() },
  { name: "TmtSale",               fn: () => prisma.tmtSale.count() },
  { name: "TmtSaleItem",           fn: () => prisma.tmtSaleItem.count() },
  { name: "AdminAuditLog",         fn: () => prisma.adminAuditLog.count() },
];

async function main() {
  // ── Load latest backup ──────────────────────────────────────
  const backupDir = path.join(__dirname, "..", "backups", "full-db-backup");
  const files = fs.readdirSync(backupDir)
    .filter((f) => f.startsWith("backup-") && f.endsWith(".json"))
    .sort()
    .reverse();

  if (files.length === 0) {
    console.error("No backup files found in", backupDir);
    process.exit(1);
  }

  const latestFile = path.join(backupDir, files[0]);
  console.log("=".repeat(68));
  console.log(" DATA INTEGRITY VERIFICATION");
  console.log(`  Backup  : ${files[0]}`);
  console.log(`  Live DB : CockroachDB (defaultdb)`);
  console.log(`  Checked : ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST`);
  console.log("=".repeat(68));

  const backup = JSON.parse(fs.readFileSync(latestFile, "utf8"));
  const backupSummary = backup.summary || {};

  let allOk = true;
  let totalBackup = 0;
  let totalLive = 0;
  const issues = [];

  const COL1 = 28, COL2 = 10, COL3 = 10;

  console.log(
    `  ${"Table".padEnd(COL1)} ${"Backup".padStart(COL2)} ${"Live DB".padStart(COL3)}  Status`
  );
  console.log("  " + "-".repeat(COL1 + COL2 + COL3 + 12));

  for (const model of MODELS) {
    const backupCount = backupSummary[model.name] ?? "N/A";
    let liveCount;

    try {
      liveCount = await model.fn();
    } catch (err) {
      liveCount = "ERR";
    }

    const backupNum = typeof backupCount === "number" ? backupCount : 0;
    const liveNum   = typeof liveCount   === "number" ? liveCount   : 0;

    totalBackup += backupNum;
    totalLive   += liveNum;

    let status;
    if (liveCount === "ERR") {
      status = "⚠ QUERY ERR";
      allOk = false;
      issues.push({ table: model.name, backup: backupCount, live: liveCount, issue: "Query error" });
    } else if (liveNum < backupNum) {
      status = "❌ DATA LOSS";
      allOk = false;
      issues.push({ table: model.name, backup: backupCount, live: liveCount, issue: `Missing ${backupNum - liveNum} rows` });
    } else if (liveNum > backupNum) {
      status = "✚ NEW ROWS";  // new data added after backup — expected
    } else {
      status = "✅ MATCH";
    }

    console.log(
      `  ${model.name.padEnd(COL1)} ${String(backupCount).padStart(COL2)} ${String(liveCount).padStart(COL3)}  ${status}`
    );
  }

  console.log("  " + "-".repeat(COL1 + COL2 + COL3 + 12));
  console.log(
    `  ${"TOTAL".padEnd(COL1)} ${String(totalBackup).padStart(COL2)} ${String(totalLive).padStart(COL3)}`
  );
  console.log("=".repeat(68));

  if (!allOk) {
    console.log("\n  ❌ ISSUES DETECTED:\n");
    for (const issue of issues) {
      console.log(`  ► ${issue.table}`);
      console.log(`    Backup: ${issue.backup}  |  Live: ${issue.live}  |  ${issue.issue}`);
    }
    console.log("");
    process.exit(1);
  } else {
    console.log("\n  ✅ ZERO DATA LOSS — All table counts match or have new rows only.");
    console.log(`  ✅ Live DB has ${totalLive - totalBackup >= 0 ? "+" : ""}${totalLive - totalBackup} rows vs backup (new writes after backup).`);
    console.log("=".repeat(68) + "\n");
  }
}

main()
  .catch((err) => {
    console.error("\nFATAL verification error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
