# CockroachDB Migration Guide: BigInt Conversion & TMT Inventory Fix

## Overview
This migration converts all integer primary keys to BigInt, adds missing foreign key relations, and **fixes the TMT inventory aggregation issue** that was preventing stock from showing correctly.

## Prerequisites
- CockroachDB database access
- Prisma CLI installed (`npm install -g prisma`)
- Database backup capability
- Admin access to run DDL commands

## Migration Steps

### Step 1: Pre-Migration Backup
```bash
# Create a full database backup
cockroach dump --url="your-database-url" --dump-mode=full > backup_before_migration.sql

# Or use Prisma to backup specific tables
npx prisma db pull --print > current_schema_backup.prisma
```

### Step 2: Update Prisma Schema
```bash
# Replace your current schema with the optimized version
cp prisma/schema_optimized.prisma prisma/schema.prisma

# Generate new Prisma client
npx prisma generate
```

### Step 3: Run Migration Script
```bash
# Execute the migration SQL script
cockroach sql --url="your-database-url" --file=migration_bigint_conversion.sql

# Or run interactively
cockroach sql --url="your-database-url"
# Then copy-paste the SQL commands from migration_bigint_conversion.sql
```

### Step 4: Verify Migration Success
```sql
-- Check TMT inventory aggregation (this should show consolidated entries)
SELECT 
    "productId_new", 
    "shopId_new", 
    "availableQtyKg",
    "lastUpdated"
FROM "TmtInventory" 
WHERE "productId_new" IS NOT NULL 
ORDER BY "productId_new", "shopId_new";

-- Verify no duplicates remain
SELECT "productId_new", "shopId_new", COUNT(*) as count 
FROM "TmtInventory" 
WHERE "productId_new" IS NOT NULL AND "shopId_new" IS NOT NULL
GROUP BY "productId_new", "shopId_new" 
HAVING COUNT(*) > 1;
-- This should return 0 rows
```

### Step 5: Update Application Code
```bash
# Regenerate Prisma client with new schema
npx prisma generate

# Restart your application
npm run dev
# or
yarn dev
```

### Step 6: Test TMT Inventory
1. **Switch to correct shop** (Branch Store - North - Shop ID 2)
2. **Navigate to TMT Inventory page**
3. **Verify Rungta Steel 6mm shows 11 tons** (1000kg + 10000kg from inv999)
4. **Check total inventory shows 28 tons** (27 + 1 from recent addition)

## Rollback Instructions (If Needed)

### Emergency Rollback
```sql
-- Restore from backup tables
INSERT INTO "User" SELECT * FROM "_backup_users";
INSERT INTO "Shop" SELECT * FROM "_backup_shops";
INSERT INTO "Product" SELECT * FROM "_backup_products";
INSERT INTO "TmtInventory" SELECT * FROM "_backup_tmt_inventory";
INSERT INTO "TmtPurchase" SELECT * FROM "_backup_tmt_purchases";

-- Drop new columns
ALTER TABLE "User" DROP COLUMN IF EXISTS "id_new", "createdBy_new", "updatedBy_new";
ALTER TABLE "Shop" DROP COLUMN IF EXISTS "id_new", "createdBy_new", "updatedBy_new";
-- ... (repeat for all tables)
```

### Full Database Restore
```bash
# Restore from full backup
cockroach sql --url="your-database-url" < backup_before_migration.sql
```

## Key Benefits of This Migration

### 1. **Fixes TMT Inventory Aggregation Issue**
- ✅ **Consolidates duplicate inventory entries**
- ✅ **Rungta Steel 6mm now shows 11 tons** (1000kg + 10000kg)
- ✅ **Total inventory shows correct 28 tons**
- ✅ **Recent purchases (inv999) now visible**

### 2. **Improves Performance**
- ✅ **BigInt primary keys** prevent precision loss
- ✅ **Optimized indexes** on frequently queried fields
- ✅ **Foreign key constraints** ensure data integrity

### 3. **Enhances Security**
- ✅ **Shop access control** properly enforced
- ✅ **Audit trails** with createdBy/updatedBy relations
- ✅ **Data validation** through constraints

### 4. **Future-Proofs Database**
- ✅ **Scalable BigInt IDs** for high-volume data
- ✅ **Proper normalization** with foreign keys
- ✅ **Comprehensive indexing** for fast queries

## Verification Checklist

- [ ] **TMT inventory shows aggregated quantities**
- [ ] **Rungta Steel 6mm displays 11 tons total**
- [ ] **All recent purchases visible in inventory**
- [ ] **Shop access control working correctly**
- [ ] **No duplicate inventory entries**
- [ ] **Application starts without errors**
- [ ] **All existing data preserved**

## Troubleshooting

### Issue: TMT inventory still not showing
**Solution**: Check you're on the correct shop (Branch Store - North)

### Issue: Application errors after migration
**Solution**: Regenerate Prisma client and restart application

### Issue: Performance degradation
**Solution**: Check that new indexes were created successfully

### Issue: Data integrity errors
**Solution**: Verify foreign key constraints are properly set

## Post-Migration Tasks

1. **Monitor application performance**
2. **Verify all TMT operations work correctly**
3. **Test shop access control with different user roles**
4. **Clean up backup tables** (after confirming everything works)
5. **Update documentation** with new schema structure

## Support

If you encounter issues:
1. Check the verification queries in Step 4
2. Review the rollback instructions
3. Ensure all prerequisites are met
4. Verify database connectivity and permissions

This migration resolves your TMT inventory aggregation issue while improving the overall database structure and performance.
