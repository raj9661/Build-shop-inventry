import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';


// Platform Admin Dashboard Data
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is platform owner or moderator
    const user = await prisma.user.findUnique({
      where: { id: BigInt(session.user.id) },
      select: { role: true }
    });

    if (!user || !['PLATFORM_OWNER', 'MODERATOR'].includes(user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Get platform overview data
    const [
      totalCustomers,
      activeSubscriptions,
      trialSubscriptions,
      suspendedSubscriptions,
      monthlyRevenue,
      recentCustomers,
      recentViolations,
      platformAnalytics
    ] = await Promise.all([
      // Total customers (SUPER_DUPER_ADMIN users)
      prisma.user.count({
        where: { role: 'SUPER_DUPER_ADMIN' }
      }),
      
      // Active subscriptions
      prisma.subscription.count({
        where: { status: 'ACTIVE' }
      }),
      
      // Trial subscriptions
      prisma.subscription.count({
        where: { status: 'TRIAL' }
      }),
      
      // Suspended subscriptions
      prisma.subscription.count({
        where: { status: 'SUSPENDED' }
      }),
      
      // Monthly revenue calculation
      prisma.subscriptionPayment.aggregate({
        where: {
          paymentStatus: 'COMPLETED',
          paymentDate: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
          }
        },
        _sum: { amount: true }
      }),
      
      // Recent customers
      prisma.user.findMany({
        where: { role: 'SUPER_DUPER_ADMIN' },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          name: true,
          email: true,
          createdAt: true,
          isActive: true,
          customerSubscription: {
            select: {
              plan: true,
              status: true,
              endDate: true
            }
          }
        }
      }),
      
      // Recent violations
      prisma.violation.findMany({
        where: { status: { in: ['REPORTED', 'UNDER_REVIEW'] } },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          customer: {
            select: { name: true, email: true }
          }
        }
      }),
      
      // Platform analytics
      prisma.platformAnalytics.findMany({
        orderBy: { recordedAt: 'desc' },
        take: 5
      })
    ]);

    const overview = {
      totalCustomers,
      activeSubscriptions,
      trialSubscriptions,
      suspendedSubscriptions,
      monthlyRevenue: monthlyRevenue._sum.amount || 0,
      recentCustomers,
      recentViolations,
      platformAnalytics
    };

    return NextResponse.json({ overview });

  } catch (error) {
    console.error('Platform admin API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  } finally {
  }
}

// Create new customer subscription
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: BigInt(session.user.id) },
      select: { role: true }
    });

    if (!user || user.role !== 'PLATFORM_OWNER') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await req.json();
    const { customerData, subscriptionData } = body;

    // Create customer user
    const customer = await prisma.user.create({
      data: {
        name: customerData.name,
        username: customerData.username,
        email: customerData.email,
        password: customerData.password, // Should be hashed
        role: 'SUPER_DUPER_ADMIN',
        phone: customerData.phone,
        isActive: true,
        emailVerified: true
      }
    });

    // Create subscription
    const subscription = await prisma.subscription.create({
      data: {
        customerId: customer.id,
        plan: subscriptionData.plan,
        status: subscriptionData.status || 'TRIAL',
        startDate: new Date(subscriptionData.startDate),
        endDate: new Date(subscriptionData.endDate),
        trialEndDate: subscriptionData.trialEndDate ? new Date(subscriptionData.trialEndDate) : null,
        price: subscriptionData.price,
        currency: subscriptionData.currency || 'USD',
        autoRenew: subscriptionData.autoRenew !== false,
        createdBy: BigInt(session.user.id)
      }
    });

    // Create welcome notification
    await prisma.notification.create({
      data: {
        recipientId: customer.id,
        recipientType: 'user',
        type: 'GENERAL',
        title: 'Welcome to Your SaaS Platform!',
        message: 'Your account has been created successfully. Explore all the features available to you.',
        createdBy: BigInt(session.user.id)
      }
    });

    return NextResponse.json({
      customer: {
        id: customer.id.toString(),
        name: customer.name,
        email: customer.email,
        role: customer.role
      },
      subscription: {
        id: subscription.id.toString(),
        plan: subscription.plan,
        status: subscription.status
      }
    });

  } catch (error) {
    console.error('Create customer error:', error);
    return NextResponse.json(
      { error: 'Failed to create customer' },
      { status: 500 }
    );
  } finally {
  }
}
