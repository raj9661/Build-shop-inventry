const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const sales = await prisma.sale.findMany({
    where: {
      saleDate: { gte: today, lt: tomorrow }
    },
    include: {
      items: {
        include: {
          product: true
        }
      }
    }
  });

  let totalRev = 0;
  let totalCost = 0;

  for (const s of sales) {
    totalRev += Number(s.finalAmount);
    let sCost = 0;
    for (const item of s.items) {
      sCost += Number(item.quantity) * Number(item.product.costPrice);
      console.log(`- Item: ${item.product.name}, Qty: ${item.quantity}, CostPrice: ${item.product.costPrice}, SellPrice: ${item.unitPrice}`);
    }
    totalCost += sCost;
    console.log(`Sale ID ${s.id}: Revenue=${s.finalAmount}, Cost=${sCost}`);
  }

  const expenses = await prisma.expense.findMany({
    where: {
      date: { gte: today, lt: tomorrow }
    }
  });
  
  let totalExp = 0;
  for (const e of expenses) {
    totalExp += Number(e.amount);
  }

  console.log(`\nTODAY: Revenue=${totalRev}, Cost=${totalCost}, Expenses=${totalExp}`);
  console.log(`PROFIT: ${totalRev - totalCost - totalExp}`);
}

check().catch(console.error).finally(() => prisma.$disconnect());
