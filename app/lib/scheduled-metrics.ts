import { prisma } from "@/lib/prisma";
import { calculateDailyMetrics, calculateInventoryAnalytics } from "@/server/jobs/calculateMetrics";
import dayjs from "dayjs";

class ScheduledMetricsService {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;

  async start() {
    if (this.isRunning) return;
    this.isRunning = true;

    // Run once at startup
    await this.runForAllShopsSafely();

    // Then schedule daily
    this.intervalId = setInterval(async () => {
      await this.runForAllShopsSafely();
    }, 24 * 60 * 60 * 1000);
  }

  async stop() {
    if (this.intervalId) clearInterval(this.intervalId);
    this.intervalId = null;
    this.isRunning = false;
  }

  private async runForAllShopsSafely() {
    try {
      // Ensure we use start-of-day date in calculateDailyMetrics
      const shops = await prisma.shop.findMany({ select: { id: true } });
      for (const s of shops) {
        await calculateDailyMetrics(BigInt(s.id as unknown as number));
        await calculateInventoryAnalytics(BigInt(s.id as unknown as number));
      }
    } catch (err) {
      console.error("Scheduled metrics run failed", err);
    }
  }

  getStatus() {
    return { isRunning: this.isRunning, hasInterval: this.intervalId !== null };
  }
}

export const scheduledMetricsService = new ScheduledMetricsService();

if (process.env.NODE_ENV === "production" && typeof window === "undefined") {
  scheduledMetricsService.start().catch(console.error);
}


