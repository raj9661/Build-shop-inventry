import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';

export async function GET() {
  try {
    const start = Date.now();
    
    // Get system metrics
    const memoryUsage = process.memoryUsage();
    const uptime = process.uptime();
    
    // Get database metrics
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const dbResponseTime = Date.now() - dbStart;
    
    // Get Redis metrics
    const redisStart = Date.now();
    await redis.exists('__ping__');
    const redisResponseTime = Date.now() - redisStart;
    
    // Get platform metrics (run in parallel)
    const [totalCustomers, activeSubscriptions, trialSubscriptions, performanceMetrics] = await Promise.all([
      prisma.user.count({ where: { role: 'SUPER_DUPER_ADMIN' } }),
      prisma.subscription.count({ where: { status: 'ACTIVE' } }),
      prisma.subscription.count({ where: { status: 'TRIAL' } }),
      redis.get<Record<string, unknown>>('performance_metrics'),
    ]);
    
    const response = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      system: {
        uptime: Math.round(uptime),
        memory: {
          rss: Math.round(memoryUsage.rss / 1024 / 1024),
          heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
          heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
          external: Math.round(memoryUsage.external / 1024 / 1024),
        },
        cpu: process.cpuUsage(),
      },
      services: {
        database: { status: 'connected', responseTime: `${dbResponseTime}ms` },
        redis:    { status: 'connected', responseTime: `${redisResponseTime}ms` },
      },
      platform: {
        totalCustomers,
        activeSubscriptions,
        trialSubscriptions,
        totalRevenue: await calculateTotalRevenue(),
      },
      performance: {
        ...(performanceMetrics ?? { avgResponseTime: 0, totalRequests: 0, errorRate: 0 }),
        currentResponseTime: `${Date.now() - start}ms`,
      },
    };
    
    return NextResponse.json(response);
  } catch (error: any) {
    console.error('Performance monitoring error:', error);
    return NextResponse.json(
      { status: 'unhealthy', error: error.message, timestamp: new Date().toISOString() },
      { status: 500 },
    );
  }
}

async function calculateTotalRevenue() {
  try {
    const result = await prisma.subscriptionPayment.aggregate({
      where: { paymentStatus: 'COMPLETED' },
      _sum: { amount: true },
    });
    return result._sum.amount || 0;
  } catch {
    return 0;
  }
}
