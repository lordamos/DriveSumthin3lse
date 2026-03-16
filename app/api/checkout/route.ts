import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-02-24-preview' as any,
});

export async function POST(req: Request) {
  try {
    const { contractId, amount, userId, userEmail, vehicleName } = await req.json();

    if (!contractId || !amount || !userId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Payment for ${vehicleName}`,
              description: `Contract ID: ${contractId}`,
            },
            unit_amount: Math.round(amount * 100), // Stripe expects cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.APP_URL || 'http://localhost:3000'}/?success=true&contractId=${contractId}`,
      cancel_url: `${process.env.APP_URL || 'http://localhost:3000'}/?canceled=true`,
      customer_email: userEmail,
      metadata: {
        contractId,
        userId,
        amount: amount.toString(),
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error('Stripe Checkout Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
