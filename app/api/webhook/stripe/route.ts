import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { ServerOwnershipService } from '@/lib/server-ownership';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-02-24-preview' as any,
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(req: Request) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature');

  let event: Stripe.Event;

  try {
    if (!sig || !webhookSecret) {
      // If no secret, we might be in a dev environment without it configured
      // For demo purposes, we might want to skip verification if secret is missing,
      // but let's stick to the secure way.
      throw new Error('Missing stripe-signature or webhook secret');
    }
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err: any) {
    console.error(`Webhook Error: ${err.message}`);
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  // Handle the event
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    
    const contractId = session.metadata?.contractId;
    const userId = session.metadata?.userId;
    const amount = parseFloat(session.metadata?.amount || '0');
    const stripeId = session.id;

    if (contractId && userId && amount > 0) {
      try {
        await ServerOwnershipService.processSuccessfulPayment({
          contractId,
          userId,
          amount,
          stripeId,
        });
        console.log(`Payment processed for contract ${contractId}`);
      } catch (error) {
        console.error(`Failed to process payment for contract ${contractId}:`, error);
        // Notify admin of processing failure
        await ServerOwnershipService.notifyAdmin('PAYMENT_FAILED', {
          contractId,
          userId,
          message: `Stripe payment ${stripeId} succeeded but database update failed. Manual intervention required.`
        });
      }
    }
  }

  return NextResponse.json({ received: true });
}
