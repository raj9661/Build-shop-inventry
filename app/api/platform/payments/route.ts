import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';


// Stripe configuration
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

// Subscription plans configuration
const SUBSCRIPTION_PLANS = {
  TRIAL_30_DAYS: {
    name: '30-Day Trial',
    price: 0,
    currency: 'USD',
    trialDays: 30,
    features: ['1 Shop', '100 Products', '1 User', 'Email Support']
  },
  BASIC_MONTHLY: {
    name: 'Basic Monthly',
    price: 29,
    currency: 'USD',
    features: ['2 Shops', '500 Products', '3 Users', 'Basic Analytics', 'Email Support']
  },
  BASIC_YEARLY: {
    name: 'Basic Yearly',
    price: 290,
    currency: 'USD',
    features: ['2 Shops', '500 Products', '3 Users', 'Basic Analytics', 'Email Support']
  },
  PROFESSIONAL_MONTHLY: {
    name: 'Professional Monthly',
    price: 79,
    currency: 'USD',
    features: ['5 Shops', '2000 Products', '10 Users', 'Advanced Analytics', 'API Access', 'Priority Support']
  },
  PROFESSIONAL_YEARLY: {
    name: 'Professional Yearly',
    price: 790,
    currency: 'USD',
    features: ['5 Shops', '2000 Products', '10 Users', 'Advanced Analytics', 'API Access', 'Priority Support']
  },
  ENTERPRISE_MONTHLY: {
    name: 'Enterprise Monthly',
    price: 199,
    currency: 'USD',
    features: ['Unlimited Shops', 'Unlimited Products', 'Unlimited Users', 'White-label', 'Custom Integrations', 'Dedicated Support']
  },
  ENTERPRISE_YEARLY: {
    name: 'Enterprise Yearly',
    price: 1990,
    currency: 'USD',
    features: ['Unlimited Shops', 'Unlimited Products', 'Unlimited Users', 'White-label', 'Custom Integrations', 'Dedicated Support']
  }
};

// Create payment intent for subscription
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { subscriptionId, paymentMethod, gateway } = body;

    const subscription = await prisma.subscription.findUnique({
      where: { id: BigInt(subscriptionId) },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    if (!subscription) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
    }

    const plan = SUBSCRIPTION_PLANS[subscription.plan];
    if (!plan) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    }

    let paymentIntent;

    if (gateway === 'stripe' && STRIPE_SECRET_KEY) {
      paymentIntent = await createStripePaymentIntent(subscription, plan);
    } else if (gateway === 'razorpay' && RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET) {
      paymentIntent = await createRazorpayOrder(subscription, plan);
    } else {
      return NextResponse.json({ error: 'Payment gateway not configured' }, { status: 400 });
    }

    // Create payment record
    const payment = await prisma.subscriptionPayment.create({
      data: {
        subscriptionId: BigInt(subscriptionId),
        amount: plan.price,
        currency: plan.currency,
        paymentMethod,
        paymentStatus: 'PENDING',
        transactionId: paymentIntent.id,
        gatewayResponse: JSON.stringify(paymentIntent)
      }
    });

    return NextResponse.json({
      paymentId: payment.id.toString(),
      paymentIntent,
      plan: plan.name,
      amount: plan.price,
      currency: plan.currency
    });

  } catch (error) {
    console.error('Create payment error:', error);
    return NextResponse.json(
      { error: 'Failed to create payment' },
      { status: 500 }
    );
  } finally {
  }
}

// Stripe payment intent creation
async function createStripePaymentIntent(subscription: any, plan: any) {
  const stripe = require('stripe')(STRIPE_SECRET_KEY);
  
  const paymentIntent = await stripe.paymentIntents.create({
    amount: plan.price * 100, // Convert to cents
    currency: plan.currency.toLowerCase(),
    customer: subscription.customer.email,
    metadata: {
      subscriptionId: subscription.id.toString(),
      plan: subscription.plan
    }
  });

  return paymentIntent;
}

// Razorpay order creation
async function createRazorpayOrder(subscription: any, plan: any) {
  const Razorpay = require('razorpay');
  const razorpay = new Razorpay({
    key_id: RAZORPAY_KEY_ID,
    key_secret: RAZORPAY_KEY_SECRET,
  });

  const order = await razorpay.orders.create({
    amount: plan.price * 100, // Convert to paise
    currency: plan.currency,
    receipt: `sub_${subscription.id}`,
    notes: {
      subscriptionId: subscription.id.toString(),
      plan: subscription.plan,
      customerEmail: subscription.customer.email
    }
  });

  return order;
}

// Get subscription plans
export async function GET(req: NextRequest) {
  try {
    return NextResponse.json({
      plans: SUBSCRIPTION_PLANS
    });
  } catch (error) {
    console.error('Get plans error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
