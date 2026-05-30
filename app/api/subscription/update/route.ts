import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { validateToken } from '@/app/lib/tokenUtils';


// PUT - Update user's subscription plan
export async function PUT(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, message: 'Access token required' }, { status: 401 });
    }
    
    const token = authHeader.substring(7);
    const decoded = await validateToken(token);
    if (!decoded) {
      return NextResponse.json({ success: false, message: 'Invalid or expired token' }, { status: 401 });
    }

    const body = await req.json();
    const { plan, paymentMethod, paymentIntentId, autoRenew } = body;

    // If only updating auto-renewal, plan is not required
    if (!plan && autoRenew === undefined) {
      return NextResponse.json({ success: false, message: 'Plan or autoRenew is required' }, { status: 400 });
    }

    // Validate plan (only if plan is provided)
    if (plan) {
      const validPlans = [
        'TRIAL_30_DAYS', 'BASIC_MONTHLY', 'BASIC_YEARLY',
        'PROFESSIONAL_MONTHLY', 'PROFESSIONAL_YEARLY',
        'ENTERPRISE_MONTHLY', 'ENTERPRISE_YEARLY'
      ];

      if (!validPlans.includes(plan)) {
        return NextResponse.json({ success: false, message: 'Invalid plan' }, { status: 400 });
      }
    }

    // Get plan details (only if plan is provided)
    let planDetails = null;
    let newEndDate = null;
    
    if (plan) {
      planDetails = getPlanDetails(plan);
      
      // Calculate new end date
      newEndDate = new Date();
      if (plan.includes('YEARLY')) {
        newEndDate.setFullYear(newEndDate.getFullYear() + 1);
      } else {
        newEndDate.setMonth(newEndDate.getMonth() + 1);
      }
    }

    // Check if user has existing subscription
    const existingSubscription = await prisma.subscription.findUnique({
      where: { customerId: BigInt(decoded.userId) }
    });

    let updatedSubscription;

    if (existingSubscription) {
      // Update existing subscription
      const updateData: any = {
        updatedAt: new Date()
      };

      // Only update plan-related fields if plan is provided
      if (plan) {
        updateData.plan = plan;
        updateData.status = 'ACTIVE';
        updateData.price = planDetails.price;
        updateData.currency = planDetails.currency;
        updateData.endDate = newEndDate;
      }

      // Update auto-renewal if provided
      if (autoRenew !== undefined) {
        updateData.autoRenew = autoRenew;
      }

      updatedSubscription = await prisma.subscription.update({
        where: { id: existingSubscription.id },
        data: updateData,
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true
            }
          }
        }
      });

      if (plan) {
        console.log('✅ Subscription plan updated:', {
          userId: decoded.userId,
          oldPlan: existingSubscription.plan,
          newPlan: plan,
          status: 'ACTIVE',
          price: planDetails.price
        });
      } else {
        console.log('✅ Subscription auto-renewal updated:', {
          userId: decoded.userId,
          plan: existingSubscription.plan,
          autoRenew: autoRenew
        });
      }
    } else {
      // Create new subscription (only if plan is provided)
      if (!plan) {
        return NextResponse.json({ success: false, message: 'No existing subscription found and no plan provided' }, { status: 400 });
      }

      updatedSubscription = await prisma.subscription.create({
        data: {
          customerId: BigInt(decoded.userId),
          plan: plan,
          status: 'ACTIVE',
          startDate: new Date(),
          endDate: newEndDate,
          price: planDetails.price,
          currency: planDetails.currency,
          autoRenew: autoRenew !== undefined ? autoRenew : true
        },
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true
            }
          }
        }
      });

      console.log('✅ New subscription created:', {
        userId: decoded.userId,
        plan: plan,
        status: 'ACTIVE',
        price: planDetails.price,
        autoRenew: autoRenew !== undefined ? autoRenew : true
      });
    }

    // Format response data
    const responseData = formatSubscriptionData(updatedSubscription);

    return NextResponse.json({
      success: true,
      message: 'Subscription updated successfully',
      data: responseData
    });

  } catch (error) {
    console.error('Subscription update error:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Failed to update subscription' 
    }, { status: 500 });
  } finally {
  }
}

// Helper function to get plan details
function getPlanDetails(plan: string) {
  const plans: { [key: string]: any } = {
    'TRIAL_30_DAYS': { price: 0, currency: 'USD' },
    'BASIC_MONTHLY': { price: 29, currency: 'USD' },
    'BASIC_YEARLY': { price: 290, currency: 'USD' },
    'PROFESSIONAL_MONTHLY': { price: 79, currency: 'USD' },
    'PROFESSIONAL_YEARLY': { price: 790, currency: 'USD' },
    'ENTERPRISE_MONTHLY': { price: 199, currency: 'USD' },
    'ENTERPRISE_YEARLY': { price: 1990, currency: 'USD' }
  };

  return plans[plan] || { price: 0, currency: 'USD' };
}

// Helper function to format subscription data
function formatSubscriptionData(subscription: any) {
  const now = new Date();
  const endDate = new Date(subscription.endDate);
  
  // Calculate days remaining
  const daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

  // Get plan limits based on subscription plan
  const planLimits = getPlanLimits(subscription.plan);

  return {
    id: Number(subscription.id),
    plan: subscription.plan,
    status: subscription.status,
    startDate: subscription.startDate,
    endDate: subscription.endDate,
    trialEndDate: subscription.trialEndDate,
    price: Number(subscription.price),
    currency: subscription.currency,
    autoRenew: subscription.autoRenew,
    daysRemaining,
    isTrial: subscription.status === 'TRIAL',
    isActive: subscription.status === 'ACTIVE',
    isExpired: subscription.status === 'EXPIRED',
    planLimits,
    customer: {
      id: Number(subscription.customer.id),
      name: subscription.customer.name,
      email: subscription.customer.email,
      role: subscription.customer.role
    }
  };
}

// Helper function to get plan limits
function getPlanLimits(plan: string) {
  const limits: { [key: string]: any } = {
    'TRIAL_30_DAYS': {
      shops: 1,
      products: 100,
      users: 1,
      features: ['Basic inventory', 'Basic analytics', 'Email support']
    },
    'BASIC_MONTHLY': {
      shops: 2,
      products: 500,
      users: 3,
      features: ['Complete inventory', 'Basic analytics', 'Email support']
    },
    'BASIC_YEARLY': {
      shops: 2,
      products: 500,
      users: 3,
      features: ['Complete inventory', 'Basic analytics', 'Email support', '2 months free']
    },
    'PROFESSIONAL_MONTHLY': {
      shops: 5,
      products: 2000,
      users: 10,
      features: ['Complete inventory', 'Advanced analytics', 'Priority support', 'API access']
    },
    'PROFESSIONAL_YEARLY': {
      shops: 5,
      products: 2000,
      users: 10,
      features: ['Complete inventory', 'Advanced analytics', 'Priority support', 'API access', '2 months free']
    },
    'ENTERPRISE_MONTHLY': {
      shops: -1, // Unlimited
      products: -1, // Unlimited
      users: -1, // Unlimited
      features: ['Everything', 'Custom integrations', 'Dedicated support', 'SLA']
    },
    'ENTERPRISE_YEARLY': {
      shops: -1, // Unlimited
      products: -1, // Unlimited
      users: -1, // Unlimited
      features: ['Everything', 'Custom integrations', 'Dedicated support', 'SLA', '2 months free']
    }
  };

  return limits[plan] || limits['TRIAL_30_DAYS'];
}
