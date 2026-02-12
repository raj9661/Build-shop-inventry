import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Stripe webhook handler
export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const signature = req.headers.get('stripe-signature');
    
    if (!signature) {
      return NextResponse.json({ error: 'No signature' }, { status: 400 });
    }

    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET);

    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentSuccess(event.data.object);
        break;
      case 'payment_intent.payment_failed':
        await handlePaymentFailure(event.data.object);
        break;
      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSuccess(event.data.object);
        break;
      case 'invoice.payment_failed':
        await handleInvoicePaymentFailure(event.data.object);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionCancelled(event.data.object);
        break;
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });

  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 400 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

async function handlePaymentSuccess(paymentIntent: any) {
  const subscriptionId = paymentIntent.metadata?.subscriptionId;
  
  if (!subscriptionId) return;

  // Update payment status
  await prisma.subscriptionPayment.updateMany({
    where: {
      transactionId: paymentIntent.id,
      paymentStatus: 'PENDING'
    },
    data: {
      paymentStatus: 'COMPLETED',
      paymentDate: new Date(),
      gatewayResponse: JSON.stringify(paymentIntent)
    }
  });

  // Update subscription status
  await prisma.subscription.update({
    where: { id: BigInt(subscriptionId) },
    data: {
      status: 'ACTIVE',
      lastPaymentDate: new Date(),
      nextPaymentDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
    }
  });

  // Send success notification
  const subscription = await prisma.subscription.findUnique({
    where: { id: BigInt(subscriptionId) },
    select: { customerId: true }
  });

  if (subscription) {
    await prisma.notification.create({
      data: {
        recipientId: subscription.customerId,
        recipientType: 'user',
        type: 'GENERAL',
        title: 'Payment Successful',
        message: 'Your subscription payment has been processed successfully.',
        sentAt: new Date()
      }
    });
  }
}

async function handlePaymentFailure(paymentIntent: any) {
  const subscriptionId = paymentIntent.metadata?.subscriptionId;
  
  if (!subscriptionId) return;

  // Update payment status
  await prisma.subscriptionPayment.updateMany({
    where: {
      transactionId: paymentIntent.id,
      paymentStatus: 'PENDING'
    },
    data: {
      paymentStatus: 'FAILED',
      failureReason: paymentIntent.last_payment_error?.message || 'Payment failed',
      gatewayResponse: JSON.stringify(paymentIntent)
    }
  });

  // Send failure notification
  const subscription = await prisma.subscription.findUnique({
    where: { id: BigInt(subscriptionId) },
    select: { customerId: true }
  });

  if (subscription) {
    await prisma.notification.create({
      data: {
        recipientId: subscription.customerId,
        recipientType: 'user',
        type: 'PAYMENT_DUE',
        title: 'Payment Failed',
        message: 'Your subscription payment failed. Please update your payment method.',
        sentAt: new Date()
      }
    });
  }
}

async function handleInvoicePaymentSuccess(invoice: any) {
  // Handle recurring subscription payments
  console.log('Invoice payment succeeded:', invoice.id);
}

async function handleInvoicePaymentFailure(invoice: any) {
  // Handle recurring subscription payment failures
  console.log('Invoice payment failed:', invoice.id);
}

async function handleSubscriptionCancelled(subscription: any) {
  // Handle subscription cancellations
  console.log('Subscription cancelled:', subscription.id);
}
