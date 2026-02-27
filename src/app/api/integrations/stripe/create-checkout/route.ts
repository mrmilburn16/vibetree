import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getIntegrationsBaseUrl } from "@/lib/integrationsBaseUrl";

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key);
}

export async function POST(request: NextRequest) {
  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json(
      { error: "Stripe integration is not configured. Set STRIPE_SECRET_KEY." },
      { status: 503 }
    );
  }

  try {
    const body = (await request.json()) as {
      projectId: string;
      amountCents?: number;
      currency?: string;
      successUrl?: string;
      cancelUrl?: string;
      metadata?: Record<string, string>;
      description?: string;
    };

    const {
      projectId,
      amountCents = 0,
      currency = "usd",
      successUrl,
      cancelUrl,
      metadata = {},
      description,
    } = body;

    if (!projectId) {
      return NextResponse.json(
        { error: "projectId is required" },
        { status: 400 }
      );
    }

    const baseUrl = getIntegrationsBaseUrl();
    const defaultSuccess = `${baseUrl}/?stripe=success`;
    const defaultCancel = `${baseUrl}/?stripe=cancel`;

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: amountCents > 0 ? "payment" : "payment",
      payment_method_types: ["card"],
      success_url: successUrl ?? defaultSuccess,
      cancel_url: cancelUrl ?? defaultCancel,
      metadata: {
        projectId,
        ...metadata,
      },
    };

    if (amountCents > 0) {
      sessionParams.line_items = [
        {
          price_data: {
            currency: currency.toLowerCase(),
            unit_amount: amountCents,
            product_data: {
              name: description ?? "Payment",
              description: `Project: ${projectId}`,
            },
          },
          quantity: 1,
        },
      ];
    } else {
      return NextResponse.json(
        { error: "amountCents must be greater than 0" },
        { status: 400 }
      );
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    return NextResponse.json({
      url: session.url,
      sessionId: session.id,
    });
  } catch (e) {
    const err = e as { message?: string };
    console.error("[integrations/stripe/create-checkout]", e);
    return NextResponse.json(
      { error: err.message ?? "Failed to create checkout" },
      { status: 500 }
    );
  }
}
