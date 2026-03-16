import { prisma } from "@/lib/prisma";
import dayjs from "dayjs";

export async function calculateDailyMetrics(shopId: bigint) {
  const today = dayjs().startOf("day").toDate();

  const analytics = await prisma.analyticsSummary.findUnique({
    where: { date_shopId: { date: today, shopId } },
  });

  if (!analytics) return;

  const { totalSales, totalExpenses, netProfit } = analytics;

  const roi = Number(totalExpenses) > 0 ? (Number(netProfit) / Number(totalExpenses)) * 100 : 0;
  const ros = Number(totalSales) > 0 ? (Number(netProfit) / Number(totalSales)) * 100 : 0;
  const grossMargin = Number(totalSales) > 0
    ? ((Number(totalSales) - Number(totalExpenses)) / Number(totalSales)) * 100
    : 0;

  await prisma.businessMetric.createMany({
    data: [
      { shopId, metricName: "ROI", value: roi as any, period: "daily" },
      { shopId, metricName: "ROS", value: ros as any, period: "daily" },
      { shopId, metricName: "Gross Margin", value: grossMargin as any, period: "daily" },
    ],
    skipDuplicates: true
  });
}

export async function calculateInventoryAnalytics(shopId: bigint) {
  try {
    // Get all active products for this shop
    const products = await prisma.product.findMany({
      where: {
        shopId,
        isActive: true
      },
      select: {
        id: true,
        name: true,
        stockQuantity: true,
        costPrice: true,
        stockEntries: {
          select: { conversionCft: true },
          where: { conversionCft: { not: null } },
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });

    // Calculate inventory analytics for each product
    const inventoryData = await Promise.all(
      products.map(async (product) => {
        // Get average stock over last 30 days
        const thirtyDaysAgo = dayjs().subtract(30, 'days').startOf('day').toDate();
        
        // Get stock entries for last 30 days to calculate avg stock
        const stockEntries = await prisma.stockEntry.findMany({
          where: {
            productId: product.id,
            entryDate: {
              gte: thirtyDaysAgo
            },
            isActive: true
          },
          orderBy: { entryDate: 'desc' },
          take: 100
        });

        // Calculate average stock from stock entries
        let avgStock = Number(product.stockQuantity || 0);
        if (stockEntries.length > 0) {
          const avgStockSum = stockEntries.reduce((sum, entry) => sum + Number(entry.quantity || 0), 0);
          avgStock = Math.abs(avgStockSum / stockEntries.length);
        }

        // Get total sales for this product in last 30 days
        const totalSales = await prisma.saleItem.aggregate({
          where: {
            productId: product.id,
            sale: {
              saleDate: {
                gte: thirtyDaysAgo
              },
              isActive: true
            }
          },
          _sum: {
            quantity: true,
            totalPrice: true
          }
        });

        const totalQtySold = Number(totalSales._sum.quantity || 0);
        const totalSalesAmount = Number(totalSales._sum.totalPrice || 0);
        
        // Calculate true COGS. If product is sold in fractional units (e.g. CFTs from a Highwa)
        // calculate the per-CFT cost before multiplying by sold fractional quantity.
        const conversionFactor = product.stockEntries?.[0]?.conversionCft 
          ? Number(product.stockEntries[0].conversionCft) 
          : 1;
        const normalizedUnitCost = Number(product.costPrice || 0) / (conversionFactor > 0 ? conversionFactor : 1);
        
        // COGS = true cost of single fractional unit * total fractional units sold
        const cogs = totalQtySold * normalizedUnitCost;

        // Calculate turnover ratio = total quantity sold / average stock
        const turnoverRatio = avgStock > 0 ? totalQtySold / avgStock : 0;

        // Calculate days in inventory = 365 / turnover ratio (if turnover > 0)
        const daysInInventory = turnoverRatio > 0 ? 365 / turnoverRatio : 999; // High value if no turnover

        return {
          shopId,
          productId: product.id,
          avgStock,
          cogs,
          turnoverRatio,
          daysInInventory
        };
      })
    );

    // Insert inventory analytics
    if (inventoryData.length > 0) {
      await prisma.inventoryAnalytics.createMany({
        data: inventoryData,
        skipDuplicates: true
      });
    }

    console.log(`✅ Calculated inventory analytics for ${inventoryData.length} products in shop ${shopId}`);
  } catch (error) {
    console.error(`❌ Error calculating inventory analytics for shop ${shopId}:`, error);
  }
}


