import { NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { redis } from '@/lib/redis';

export async function GET() {
  try {
    const start = Date.now();
    
    // Get system metrics
    const memoryUsage = process.memoryUsage();
    const uptime = process.uptime();
    
    // Get database metrics
    const dbStart = Date.now();
    await db.getClient().$queryRaw`SELECT 1`;
    const dbResponseTime = Date.now() - dbStart;
    
    // Get Redis metrics
    const redisStart = Date.now();
    await redis.connect();
    const redisResponseTime = Date.now() - redisStart;
    
    // Get platform metrics
    const totalCustomers = await db.getClient().user.count({
      where: { role: 'SUPER_DUPER_ADMIN' }
    });
    
    const activeSubscriptions = await db.getClient().subscription.count({
      where: { status: 'ACTIVE' }
    });
    
    const trialSubscriptions = await db.getClient().subscription.count({
      where: { status: 'TRIAL' }
    });
    
    // Get recent performance metrics from Redis
    const performanceMetrics = await redis.get('performance_metrics') || {
      avgResponseTime: 0,
      totalRequests: 0,
      errorRate: 0
    };
    
    const response = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      system: {
        uptime: Math.round(uptime),
        memory: {
          rss: Math.round(memoryUsage.rss / 1024 / 1024), // MB
          heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
          heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
          external: Math.round(memoryUsage.external / 1024 / 1024),
        },
        cpu: process.cpuUsage(),
      },
      services: {
        database: {
          status: 'connected',
          responseTime: `${dbResponseTime}ms`,
        },
        redis: {
          status: 'connected',
          responseTime: `${redisResponseTime}ms`,
        },
      },
      platform: {
        totalCustomers,
        activeSubscriptions,
        trialSubscriptions,
        totalRevenue: await calculateTotalRevenue(),
      },
      performance: {
        ...performanceMetrics,
        currentResponseTime: `${Date.now() - start}ms`,
      },
    };
    
    return NextResponse.json(response);
  } catch (error) {
    console.error('Performance monitoring error:', error);
    return NextResponse.json(
      { 
        status: 'unhealthy', 
        error: error.message,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

async function calculateTotalRevenue() {
  try {
    const result = await db.getClient().subscriptionPayment.aggregate({
      where: {
        paymentStatus: 'COMPLETED'
      },
      _sum: {
        amount: true
      }
    });
    
    return result._sum.amount || 0;
  } catch (error) {
    console.error('Revenue calculation error:', error);
    return 0;
  }
}
