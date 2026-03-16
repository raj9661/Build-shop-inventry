const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function backup() {
  const backupDir = path.join(process.cwd(), 'backups', new Date().toISOString().replace(/[:.]/g, '-'));
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const models = [
    'User', 'Shop', 'ProductCategory', 'ProductType', 'Product', 
    'Supplier', 'StockEntry', 'Customer', 'Sale', 'SaleItem', 
    'CustomerLedgerEntry', 'SupplierPayment', 'TmtProduct', 'TmtInventory'
  ];

  for (const model of models) {
    try {
      console.log(`Backing up ${model}...`);
      const data = await prisma[model.charAt(0).toLowerCase() + model.slice(1)].findMany();
      
      // Serialize BigInt and Decimal
      const serializedData = JSON.stringify(data, (key, value) => {
        if (typeof value === 'bigint') return value.toString();
        if (value && value.constructor && value.constructor.name === 'Decimal') return value.toString();
        return value;
      }, 2);

      fs.writeFileSync(path.join(backupDir, `${model}.json`), serializedData);
    } catch (e) {
      console.error(`Failed to backup ${model}:`, e.message);
    }
  }

  console.log(`Backup completed successfully in ${backupDir}`);
  await prisma.$disconnect();
}

backup();
