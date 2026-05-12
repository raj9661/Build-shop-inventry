import { NextRequest, NextResponse } from 'next/server';

// GET - Get available subscription plans
export async function GET(req: NextRequest) {
  try {
    const plans = {
      TRIAL_30_DAYS: {
        id: 'TRIAL_30_DAYS',
        name: '30-Day Free Trial',
        price: 0,
        currency: 'USD',
        period: '30 days',
        features: [
          '1 Shop',
          'Up to 100 products',
          'Basic TMT inventory',
          '1 user account',
          'Email support'
        ],
        popular: false,
        limits: {
          shops: 1,
          products: 100,
          users: 1
        }
      },
      BASIC_MONTHLY: {
        id: 'BASIC_MONTHLY',
        name: 'Basic Monthly',
        price: 29,
        currency: 'USD',
        period: 'month',
        features: [
          '2 Shops',
          'Up to 500 products',
          'Complete inventory management',
          'Up to 3 user accounts',
          'Basic analytics',
          'Email support'
        ],
        popular: false,
        limits: {
          shops: 2,
          products: 500,
          users: 3
        }
      },
      BASIC_YEARLY: {
        id: 'BASIC_YEARLY',
        name: 'Basic Yearly',
        price: 290,
        currency: 'USD',
        period: 'year',
        features: [
          '2 Shops',
          'Up to 500 products',
          'Complete inventory management',
          'Up to 3 user accounts',
          'Basic analytics',
          'Email support',
          '2 months free'
        ],
        popular: true,
        limits: {
          shops: 2,
          products: 500,
          users: 3
        }
      },
      PROFESSIONAL_MONTHLY: {
        id: 'PROFESSIONAL_MONTHLY',
        name: 'Professional Monthly',
        price: 79,
        currency: 'USD',
        period: 'month',
        features: [
          '5 Shops',
          'Up to 2,000 products',
          'Advanced inventory management',
          'Up to 10 user accounts',
          'Advanced analytics',
          'Priority support',
          'API access'
        ],
        popular: false,
        limits: {
          shops: 5,
          products: 2000,
          users: 10
        }
      },
      PROFESSIONAL_YEARLY: {
        id: 'PROFESSIONAL_YEARLY',
        name: 'Professional Yearly',
        price: 790,
        currency: 'USD',
        period: 'year',
        features: [
          '5 Shops',
          'Up to 2,000 products',
          'Advanced inventory management',
          'Up to 10 user accounts',
          'Advanced analytics',
          'Priority support',
          'API access',
          '2 months free'
        ],
        popular: false,
        limits: {
          shops: 5,
          products: 2000,
          users: 10
        }
      },
      ENTERPRISE_MONTHLY: {
        id: 'ENTERPRISE_MONTHLY',
        name: 'Enterprise Monthly',
        price: 199,
        currency: 'USD',
        period: 'month',
        features: [
          'Unlimited Shops',
          'Unlimited products',
          'Complete inventory management',
          'Unlimited user accounts',
          'Advanced analytics',
          'Dedicated support',
          'Custom integrations',
          'SLA'
        ],
        popular: false,
        limits: {
          shops: -1, // Unlimited
          products: -1, // Unlimited
          users: -1 // Unlimited
        }
      },
      ENTERPRISE_YEARLY: {
        id: 'ENTERPRISE_YEARLY',
        name: 'Enterprise Yearly',
        price: 1990,
        currency: 'USD',
        period: 'year',
        features: [
          'Unlimited Shops',
          'Unlimited products',
          'Complete inventory management',
          'Unlimited user accounts',
          'Advanced analytics',
          'Dedicated support',
          'Custom integrations',
          'SLA',
          '2 months free'
        ],
        popular: false,
        limits: {
          shops: -1, // Unlimited
          products: -1, // Unlimited
          users: -1 // Unlimited
        }
      }
    };

    return NextResponse.json({
      success: true,
      data: Object.values(plans)
    });

  } catch (error) {
    console.error('Subscription plans error:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Failed to fetch subscription plans' 
    }, { status: 500 });
  }
}
