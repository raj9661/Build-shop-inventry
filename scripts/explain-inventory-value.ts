import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      unit: true,
      price: true,
      costPrice: true,
      stockQuantity: true,
      categoryId: true,
      typeId: true,
      shopId: true,
      stockEntries: {
        select: { conversionCft: true },
        where: { conversionCft: { not: null } },
        orderBy: { createdAt: 'desc' },
        take: 1
      }
    }
  });

  let totalValue = 0;

  console.log("--- INVENTORY VALUE BREAKDOWN ---");
  for (const prod of products) {
    const stockQty = Number(prod.stockQuantity) || 0;
    if (stockQty <= 0) continue;

    const price = Number(prod.price) || 0;
    const costPrice = Number(prod.costPrice) || 0;
    const latestConversionCft = prod.stockEntries?.[0]?.conversionCft 
      ? Number(prod.stockEntries[0].conversionCft) 
      : 1;

    // Logic from inventory/page.tsx
    const costBasis = costPrice > 0 ? costPrice : price;
    const conversionFactor = latestConversionCft > 0 ? latestConversionCft : 1;
    const valuePerUnit = costBasis / conversionFactor;
    const productTotal = valuePerUnit * stockQty;

    totalValue += productTotal;

    console.log(`\nProduct: ${prod.name} (Shop: ${prod.shopId})`);
    console.log(`- Stock Quantity: ${stockQty} ${prod.unit}`);
    console.log(`- Cost Price: ₹${costPrice} / Selling Price: ₹${price} => Using Cost Basis: ₹${costBasis}`);
    console.log(`- Latest Conversion CFT: ${latestConversionCft} => Value Per Unit: ₹${costBasis} / ${conversionFactor} = ₹${valuePerUnit.toFixed(2)}`);
    console.log(`- Product Total Value: ₹${valuePerUnit.toFixed(2)} * ${stockQty} = ₹${productTotal.toFixed(2)}`);
  }

  console.log(`\n===================================`);
  console.log(`GRAND TOTAL VALUE: ₹${totalValue.toFixed(2)}`);
  console.log(`===================================`);
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
