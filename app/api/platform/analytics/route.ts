import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';


// Get platform analytics
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: BigInt(session.user.id) },
      select: { role: true, id: true }
    });

    if (!user || !['PLATFORM_OWNER', 'MODERATOR', 'SUPER_DUPER_ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const period = searchParams.get('period') || '30'; // days
    const metric = searchParams.get('metric') || 'overview';

    // Pass user ID for isolation
    const analytics = await generatePlatformAnalytics(parseInt(period), metric, user.id);

    return NextResponse.json({ analytics });

  } catch (error) {
    console.error('Platform analytics error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  } finally {
  }
}

// Generate comprehensive platform analytics with user isolation
async function generatePlatformAnalytics(periodDays: number, metric: string, userId: bigint) {
  const startDate = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);
  const endDate = new Date();
  
  console.log('🔒 Platform analytics with user isolation for user:', userId.toString());

  switch (metric) {
    case 'overview':
      return await generateOverviewAnalytics(startDate, endDate, userId);
    case 'revenue':
      return await generateRevenueAnalytics(startDate, endDate, userId);
    case 'customers':
      return await generateCustomerAnalytics(startDate, endDate, userId);
    case 'subscriptions':
      return await generateSubscriptionAnalytics(startDate, endDate, userId);
    case 'usage':
      return await generateUsageAnalytics(startDate, endDate, userId);
    case 'violations':
      return await generateViolationAnalytics(startDate, endDate, userId);
    default:
      return await generateOverviewAnalytics(startDate, endDate, userId);
  }
}

// Overview analytics with user isolation
async function generateOverviewAnalytics(startDate: Date, endDate: Date, userId: bigint) {
  // Get user's customers (users created by this SUPER_DUPER_ADMIN)
  const userCustomers = await prisma.user.findMany({
    where: {
      createdBy: userId,
      isActive: true
    },
    select: { id: true }
  });
  
  const customerIds = userCustomers.map(customer => customer.id);
  const [
    totalCustomers,
    activeSubscriptions,
    trialSubscriptions,
    suspendedSubscriptions,
    totalRevenue,
    monthlyRecurringRevenue,
    newCustomersThisPeriod,
    churnedCustomersThisPeriod,
    totalViolations,
    activeViolations
  ] = await Promise.all([
    // Total customers (users created by this SUPER_DUPER_ADMIN)
    prisma.user.count({
      where: { 
        role: 'SUPER_DUPER_ADMIN',
        createdBy: userId,
        isActive: true
      }
    }),
    
    // Active subscriptions for this user's customers
    prisma.subscription.count({
      where: { 
        status: 'ACTIVE',
        customerId: { in: customerIds }
      }
    }),
    
    // Trial subscriptions for this user's customers
    prisma.subscription.count({
      where: { 
        status: 'TRIAL',
        customerId: { in: customerIds }
      }
    }),
    
    // Suspended subscriptions for this user's customers
    prisma.subscription.count({
      where: { 
        status: 'SUSPENDED',
        customerId: { in: customerIds }
      }
    }),
    
    // Total revenue from this user's customers
    prisma.subscriptionPayment.aggregate({
      where: {
        paymentStatus: 'COMPLETED',
        subscription: {
          customerId: { in: customerIds }
        }
      },
      _sum: { amount: true }
    }),
    
    // Monthly recurring revenue from this user's customers
    prisma.subscriptionPayment.aggregate({
      where: {
        paymentStatus: 'COMPLETED',
        subscription: {
          customerId: { in: customerIds }
        },
        paymentDate: {
          gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
        }
      },
      _sum: { amount: true }
    }),
    
    // New customers this period (users created by this SUPER_DUPER_ADMIN)
    prisma.user.count({
      where: {
        createdBy: userId,
        createdAt: {
          gte: startDate,
          lte: endDate
        }
      }
    }),
    
    // Churned customers this period (cancelled subscriptions for this user's customers)
    prisma.subscription.count({
      where: {
        status: 'CANCELLED',
        customerId: { in: customerIds },
        updatedAt: {
          gte: startDate,
          lte: endDate
        }
      }
    }),
    
    // Total violations for this user's customers
    prisma.violation.count({
      where: {
        customerId: { in: customerIds }
      }
    }),
    
    // Active violations for this user's customers
    prisma.violation.count({
      where: {
        customerId: { in: customerIds },
        status: { in: ['REPORTED', 'UNDER_REVIEW'] }
      }
    })
  ]);

  // Calculate growth rates
  const previousPeriodStart = new Date(startDate.getTime() - (endDate.getTime() - startDate.getTime()));
  const previousPeriodEnd = startDate;
  
  const previousPeriodCustomers = await prisma.user.count({
    where: {
      createdBy: userId,
      createdAt: {
        gte: previousPeriodStart,
        lte: previousPeriodEnd
      }
    }
  });

  const customerGrowthRate = previousPeriodCustomers > 0 
    ? ((newCustomersThisPeriod - previousPeriodCustomers) / previousPeriodCustomers) * 100 
    : 0;

  return {
    overview: {
      totalCustomers,
      activeSubscriptions,
      trialSubscriptions,
      suspendedSubscriptions,
      totalRevenue: totalRevenue._sum.amount || 0,
      monthlyRecurringRevenue: monthlyRecurringRevenue._sum.amount || 0,
      newCustomersThisPeriod,
      churnedCustomersThisPeriod,
      customerGrowthRate: Math.round(customerGrowthRate * 100) / 100,
      totalViolations,
      activeViolations,
      churnRate: totalCustomers > 0 ? (churnedCustomersThisPeriod / totalCustomers) * 100 : 0
    }
  };
}

// Revenue analytics with user isolation
async function generateRevenueAnalytics(startDate: Date, endDate: Date, userId: bigint) {
  // Get user's customers for filtering
  const userCustomers = await prisma.user.findMany({
    where: {
      createdBy: userId,
      isActive: true
    },
    select: { id: true }
  });
  
  const customerIds = userCustomers.map(customer => customer.id);
  const [
    totalRevenue,
    revenueByPlan,
    revenueByMonth,
    averageRevenuePerUser,
    paymentSuccessRate
  ] = await Promise.all([
    // Total revenue from this user's customers
    prisma.subscriptionPayment.aggregate({
      where: {
        paymentStatus: 'COMPLETED',
        subscription: {
          customerId: { in: customerIds }
        },
        paymentDate: {
          gte: startDate,
          lte: endDate
        }
      },
      _sum: { amount: true }
    }),
    
    // Revenue by plan for this user's customers
    prisma.subscriptionPayment.groupBy({
      by: ['subscriptionId'],
      where: {
        paymentStatus: 'COMPLETED',
        subscription: {
          customerId: { in: customerIds }
        },
        paymentDate: {
          gte: startDate,
          lte: endDate
        }
      },
      _sum: { amount: true },
      _count: true
    }),
    
    // Revenue by month for this user's customers
    prisma.$queryRaw`
      SELECT 
        DATE_TRUNC('month', sp."paymentDate") as month,
        SUM(sp.amount) as revenue
      FROM "SubscriptionPayment" sp
      INNER JOIN "Subscription" s ON sp."subscriptionId" = s.id
      WHERE sp."paymentStatus" = 'COMPLETED'
        AND s."customerId" = ANY(${customerIds})
        AND sp."paymentDate" >= ${startDate}
        AND sp."paymentDate" <= ${endDate}
      GROUP BY DATE_TRUNC('month', sp."paymentDate")
      ORDER BY month
    `,
    
    // Average revenue per user for this user's customers
    prisma.subscriptionPayment.aggregate({
      where: {
        paymentStatus: 'COMPLETED',
        subscription: {
          customerId: { in: customerIds }
        },
        paymentDate: {
          gte: startDate,
          lte: endDate
        }
      },
      _avg: { amount: true }
    }),
    
    // Payment success rate for this user's customers
    prisma.subscriptionPayment.groupBy({
      by: ['paymentStatus'],
      where: {
        subscription: {
          customerId: { in: customerIds }
        }
      },
      _count: true
    })
  ]);

  const totalPayments = paymentSuccessRate.reduce((sum, item) => sum + item._count, 0);
  const successfulPayments = paymentSuccessRate.find(item => item.paymentStatus === 'COMPLETED')?._count || 0;
  const successRate = totalPayments > 0 ? (successfulPayments / totalPayments) * 100 : 0;

  return {
    revenue: {
      totalRevenue: totalRevenue._sum.amount || 0,
      averageRevenuePerUser: averageRevenuePerUser._avg.amount || 0,
      paymentSuccessRate: Math.round(successRate * 100) / 100,
      revenueByPlan,
      revenueByMonth
    }
  };
}

// Customer analytics with user isolation
async function generateCustomerAnalytics(startDate: Date, endDate: Date, userId: bigint) {
  // Get user's customers for filtering
  const userCustomers = await prisma.user.findMany({
    where: {
      createdBy: userId,
      isActive: true
    },
    select: { id: true }
  });
  
  const customerIds = userCustomers.map(customer => customer.id);
  const [
    totalCustomers,
    newCustomers,
    activeCustomers,
    customerByPlan,
    customerRetentionRate
  ] = await Promise.all([
    // Total customers
    prisma.user.count({
      where: { role: 'SUPER_DUPER_ADMIN' }
    }),
    
    // New customers
    prisma.user.count({
      where: {
        role: 'SUPER_DUPER_ADMIN',
        createdAt: {
          gte: startDate,
          lte: endDate
        }
      }
    }),
    
    // Active customers (with active subscriptions)
    prisma.user.count({
      where: {
        role: 'SUPER_DUPER_ADMIN',
        customerSubscription: {
          status: 'ACTIVE'
        }
      }
    }),
    
    // Customers by plan
    prisma.subscription.groupBy({
      by: ['plan'],
      _count: true,
      where: {
        status: { in: ['ACTIVE', 'TRIAL'] }
      }
    }),
    
    // Customer retention (simplified calculation)
    prisma.user.count({
      where: {
        role: 'SUPER_DUPER_ADMIN',
        createdAt: {
          lt: startDate
        },
        customerSubscription: {
          status: { in: ['ACTIVE', 'TRIAL'] }
        }
      }
    })
  ]);

  const retentionRate = totalCustomers > 0 ? (activeCustomers / totalCustomers) * 100 : 0;

  return {
    customers: {
      totalCustomers,
      newCustomers,
      activeCustomers,
      customerByPlan,
      retentionRate: Math.round(retentionRate * 100) / 100
    }
  };
}

// Subscription analytics with user isolation
async function generateSubscriptionAnalytics(startDate: Date, endDate: Date, userId: bigint) {
  // Get user's customers for filtering
  const userCustomers = await prisma.user.findMany({
    where: {
      createdBy: userId,
      isActive: true
    },
    select: { id: true }
  });
  
  const customerIds = userCustomers.map(customer => customer.id);
  const [
    totalSubscriptions,
    subscriptionsByStatus,
    subscriptionsByPlan,
    trialConversionRate,
    subscriptionGrowth
  ] = await Promise.all([
    // Total subscriptions
    prisma.subscription.count(),
    
    // Subscriptions by status
    prisma.subscription.groupBy({
      by: ['status'],
      _count: true
    }),
    
    // Subscriptions by plan
    prisma.subscription.groupBy({
      by: ['plan'],
      _count: true
    }),
    
    // Trial conversion rate
    prisma.subscription.count({
      where: {
        status: 'ACTIVE',
        plan: { not: 'TRIAL_30_DAYS' }
      }
    }),
    
    // Subscription growth
    prisma.subscription.count({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate
        }
      }
    })
  ]);

  const totalTrials = await prisma.subscription.count({
    where: { plan: 'TRIAL_30_DAYS' }
  });

  const conversionRate = totalTrials > 0 ? (trialConversionRate / totalTrials) * 100 : 0;

  return {
    subscriptions: {
      totalSubscriptions,
      subscriptionsByStatus,
      subscriptionsByPlan,
      trialConversionRate: Math.round(conversionRate * 100) / 100,
      subscriptionGrowth
    }
  };
}

// Usage analytics with user isolation
async function generateUsageAnalytics(startDate: Date, endDate: Date, userId: bigint) {
  // Get user's customers for filtering
  const userCustomers = await prisma.user.findMany({
    where: {
      createdBy: userId,
      isActive: true
    },
    select: { id: true }
  });
  
  const customerIds = userCustomers.map(customer => customer.id);
  const [
    totalUsageRecords,
    usageByMetric,
    topUsersByUsage,
    usageTrends
  ] = await Promise.all([
    // Total usage records
    prisma.subscriptionUsage.count({
      where: {
        recordedAt: {
          gte: startDate,
          lte: endDate
        }
      }
    }),
    
    // Usage by metric
    prisma.subscriptionUsage.groupBy({
      by: ['metric'],
      _sum: { usage: true },
      _avg: { usage: true }
    }),
    
    // Top users by usage
    prisma.subscriptionUsage.groupBy({
      by: ['subscriptionId'],
      _sum: { usage: true },
      orderBy: {
        _sum: {
          usage: 'desc'
        }
      },
      take: 10
    }),
    
    // Usage trends over time
    prisma.$queryRaw`
      SELECT 
        DATE_TRUNC('day', "recordedAt") as day,
        metric,
        SUM(usage) as total_usage
      FROM "SubscriptionUsage"
      WHERE "recordedAt" >= ${startDate}
        AND "recordedAt" <= ${endDate}
      GROUP BY DATE_TRUNC('day', "recordedAt"), metric
      ORDER BY day, metric
    `
  ]);

  return {
    usage: {
      totalUsageRecords,
      usageByMetric,
      topUsersByUsage,
      usageTrends
    }
  };
}

// Violation analytics with user isolation
async function generateViolationAnalytics(startDate: Date, endDate: Date, userId: bigint) {
  // Get user's customers for filtering
  const userCustomers = await prisma.user.findMany({
    where: {
      createdBy: userId,
      isActive: true
    },
    select: { id: true }
  });
  
  const customerIds = userCustomers.map(customer => customer.id);
  const [
    totalViolations,
    violationsByType,
    violationsByStatus,
    violationsBySeverity,
    resolutionTime
  ] = await Promise.all([
    // Total violations
    prisma.violation.count({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate
        }
      }
    }),
    
    // Violations by type
    prisma.violation.groupBy({
      by: ['type'],
      _count: true
    }),
    
    // Violations by status
    prisma.violation.groupBy({
      by: ['status'],
      _count: true
    }),
    
    // Violations by severity
    prisma.violation.groupBy({
      by: ['severity'],
      _count: true
    }),
    
    // Average resolution time
    prisma.violation.aggregate({
      where: {
        status: 'RESOLVED',
        resolvedAt: { not: null },
        createdAt: {
          gte: startDate,
          lte: endDate
        }
      },
      _avg: {
        // This would need a computed field for resolution time
      }
    })
  ]);

  return {
    violations: {
      totalViolations,
      violationsByType,
      violationsByStatus,
      violationsBySeverity,
      resolutionTime
    }
  };
}
