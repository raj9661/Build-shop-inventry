import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { validateToken } from '@/app/lib/tokenUtils';

const prisma = new PrismaClient();

// GET - Get current user's subscription status
export async function GET(req: NextRequest) {
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

    // Convert userId to BigInt if needed (make it available throughout the function)
    const userId = typeof decoded.userId === 'bigint' ? decoded.userId : BigInt(decoded.userId);

    console.log('🔍 [Subscription API] User ID from token:', Number(userId), 'Email:', decoded.email, 'Role:', decoded.role);

    // First verify the user exists (quick check before querying subscriptions)
    let userVerified = false;
    try {
      const userCheck = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true }
      });
      userVerified = !!userCheck;
      
      if (!userVerified && decoded.email) {
        // Try finding by email
        const userByEmail = await prisma.user.findUnique({
          where: { email: decoded.email },
          select: { id: true }
        });
        userVerified = !!userByEmail;
        if (userByEmail) {
          console.log('⚠️ [Subscription API] User ID mismatch - Token ID:', Number(userId), 'Actual DB ID:', Number(userByEmail.id));
        }
      }
    } catch (userCheckError) {
      console.error('❌ [Subscription API] Error checking user existence:', userCheckError);
    }

    // Get user's subscription with error handling
    let subscription;
    let isInherited = false;
    try {
      
      // First, try to get user's own subscription
      subscription = await prisma.subscription.findUnique({
        where: { customerId: userId },
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

      // If user is not SUPER_DUPER_ADMIN, check for inherited subscription
      // (This will override any direct trial subscription with inherited benefits)
      if (decoded.role !== 'SUPER_DUPER_ADMIN') {
        console.log('🔍 Checking for inherited subscription from SUPER_DUPER_ADMIN...');
        
        // Find the SUPER_DUPER_ADMIN who created this user
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { createdBy: true, role: true }
        });

        if (user?.createdBy) {
          console.log('🔍 User created by:', user.createdBy, 'checking their subscription...');
          
          // Get the SUPER_DUPER_ADMIN's subscription
          const parentSubscription = await prisma.subscription.findUnique({
            where: { customerId: user.createdBy },
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

          if (parentSubscription) {
            console.log('✅ Found inherited subscription from SUPER_DUPER_ADMIN:', parentSubscription.plan);
            console.log('🔄 Overriding direct subscription with inherited benefits');
            subscription = parentSubscription;
            isInherited = true;
          } else {
            console.log('❌ No subscription found for SUPER_DUPER_ADMIN, using direct subscription');
          }
        } else {
          console.log('❌ No SUPER_DUPER_ADMIN found for user, using direct subscription');
        }
      }
    } catch (dbError) {
      console.error('❌ Database error in subscription status:', dbError);
      
      // Return a fallback response when database is unavailable
      return NextResponse.json({
        success: false,
        message: 'Database temporarily unavailable. Please try again later.',
        data: null
      }, { status: 503 });
    }

    console.log('🔍 Subscription status API - User ID:', decoded.userId, 'Role:', decoded.role);
    console.log('🔍 Subscription found:', subscription ? 'Yes' : 'No', isInherited ? '(Inherited)' : '(Direct)');
    if (subscription) {
      console.log('🔍 Current subscription plan:', subscription.plan);
      console.log('🔍 Current subscription status:', subscription.status);
      console.log('🔍 Subscription details:', {
        plan: subscription.plan,
        status: subscription.status,
        startDate: subscription.startDate,
        endDate: subscription.endDate,
        trialEndDate: subscription.trialEndDate,
        price: subscription.price,
        isInherited: isInherited
      });
    }

    // If no subscription exists (and user is SUPER_DUPER_ADMIN), create a trial subscription
    if (!subscription && decoded.role === 'SUPER_DUPER_ADMIN') {
      try {
        // First, verify that the user exists in the database
        let userExists = await prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, name: true, email: true, role: true }
        });

        // If user not found by ID, try finding by email (fallback for data integrity issues)
        if (!userExists && decoded.email) {
          console.log('⚠️ [Subscription API] User not found by ID:', Number(userId), 'Trying to find by email:', decoded.email);
          try {
            userExists = await prisma.user.findUnique({
              where: { email: decoded.email },
              select: { id: true, name: true, email: true, role: true }
            });
          } catch (emailQueryError) {
            console.error('❌ [Subscription API] Error querying user by email:', emailQueryError);
          }
          
          if (userExists) {
            console.log('✅ [Subscription API] User found by email with different ID. Token ID:', Number(userId), 'Database ID:', Number(userExists.id));
            // Update userId to match the actual database ID
            // Note: This is a data integrity issue - token and database are out of sync
            // For now, we'll use the found user's ID
            const actualUserId = userExists.id;
            
            // Check if subscription exists for the actual user ID
            const existingSubscription = await prisma.subscription.findUnique({
              where: { customerId: actualUserId }
            });
            
            if (existingSubscription) {
              // Subscription exists for the actual user, return it
              subscription = await prisma.subscription.findUnique({
                where: { customerId: actualUserId },
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
              
              return NextResponse.json({
                success: true,
                data: formatSubscriptionData(subscription)
              });
            }
            
            // Create subscription with the actual user ID
            const trialEndDate = new Date();
            trialEndDate.setDate(trialEndDate.getDate() + 30);
            
            const newSubscription = await prisma.subscription.create({
              data: {
                customerId: actualUserId,
                plan: 'TRIAL_30_DAYS',
                status: 'TRIAL',
                startDate: new Date(),
                endDate: trialEndDate,
                trialEndDate: trialEndDate,
                price: 0,
                currency: 'USD',
                autoRenew: false
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

            return NextResponse.json({
              success: true,
              data: formatSubscriptionData(newSubscription)
            });
          }
        }

        if (!userExists) {
          console.error('❌ [Subscription API] User not found in database by ID:', Number(userId), 'or email:', decoded.email);
          console.error('⚠️ [Subscription API] This indicates a data integrity issue - token is valid but user does not exist in database');
          console.error('💡 [Subscription API] User should log out and log in again to get a fresh token');
          return NextResponse.json({
            success: false,
            message: 'Your account could not be found. Please log out and log in again to refresh your session.',
            data: null,
            errorCode: 'USER_NOT_FOUND'
          }, { status: 404 });
        }

        const trialEndDate = new Date();
        trialEndDate.setDate(trialEndDate.getDate() + 30); // 30 days trial
        
        const newSubscription = await prisma.subscription.create({
          data: {
            customerId: userId,
            plan: 'TRIAL_30_DAYS',
            status: 'TRIAL',
            startDate: new Date(),
            endDate: trialEndDate,
            trialEndDate: trialEndDate,
            price: 0,
            currency: 'USD',
            autoRenew: false
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

        return NextResponse.json({
          success: true,
          data: formatSubscriptionData(newSubscription)
        });
      } catch (createError: any) {
        console.error('❌ Database error creating trial subscription:', createError);
        
        // Check if it's a foreign key constraint error
        if (createError.code === 'P2003') {
          return NextResponse.json({
            success: false,
            message: 'User not found in database. Please contact support.',
            data: null
          }, { status: 404 });
        }
        
        // Return a fallback response when database is unavailable
        return NextResponse.json({
          success: false,
          message: 'Database temporarily unavailable. Please try again later.',
          data: null
        }, { status: 503 });
      }
    }

    // Check if trial has expired (only if subscription exists)
    if (subscription) {
      const now = new Date();
      const isTrialExpired = subscription.status === 'TRIAL' && subscription.trialEndDate && subscription.trialEndDate < now;
      
      if (isTrialExpired) {
        try {
          // Update subscription status to expired
          await prisma.subscription.update({
            where: { id: subscription.id },
            data: { status: 'EXPIRED' }
          });
          
          subscription.status = 'EXPIRED';
        } catch (updateError) {
          console.error('❌ Database error updating subscription status:', updateError);
          // Continue with current status if update fails
        }
      }
    }

    if (!subscription) {
      return NextResponse.json({
        success: false,
        message: 'No subscription found'
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: formatSubscriptionData(subscription, isInherited)
    });

  } catch (error) {
    console.error('Subscription status error:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Failed to fetch subscription status' 
    }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

// Helper function to format subscription data
function formatSubscriptionData(subscription: any, isInherited: boolean = false) {
  const now = new Date();
  const trialEndDate = subscription.trialEndDate ? new Date(subscription.trialEndDate) : null;
  const endDate = new Date(subscription.endDate);
  
  // Calculate days remaining
  let daysRemaining = 0;
  if (subscription.status === 'TRIAL' && trialEndDate) {
    daysRemaining = Math.max(0, Math.ceil((trialEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  } else if (subscription.status === 'ACTIVE') {
    daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  }

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
    isInherited: isInherited,
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
