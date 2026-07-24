import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { requireDb } from "@/lib/db"
import { subscriptions } from "@/lib/db/schema"
import { getAuthUserId } from "@/lib/style-maker/entitlements"
import { appUrl, getStripe } from "@/lib/style-maker/stripe"

/**
 * Stripe Checkout for Style Maker subscription.
 *
 * Uses Managed Payments (merchant of record) as enabled on the Stripe account:
 * product must have an eligible tax_code (SaaS txcd_10103000), and Checkout
 * sets managed_payments.enabled = true per Stripe docs.
 * https://docs.stripe.com/payments/managed-payments/set-up
 */
export async function POST() {
  const userId = await getAuthUserId()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const priceId = process.env.STRIPE_PRICE_ID
  if (!priceId || !process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json(
      { error: "Stripe is not configured. Set STRIPE_SECRET_KEY and STRIPE_PRICE_ID." },
      { status: 503 },
    )
  }

  try {
    const stripe = getStripe()
    const db = requireDb()
    const existing = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .limit(1)

    let customerId = existing[0]?.stripeCustomerId || undefined
    if (!customerId) {
      const customer = await stripe.customers.create({
        metadata: { clerkUserId: userId },
      })
      customerId = customer.id
      if (existing[0]) {
        await db
          .update(subscriptions)
          .set({ stripeCustomerId: customerId, updatedAt: new Date() })
          .where(eq(subscriptions.userId, userId))
      } else {
        await db.insert(subscriptions).values({
          id: `sub_pending_${userId}`,
          userId,
          stripeCustomerId: customerId,
          status: "inactive",
        })
      }
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: appUrl("/style-maker/app?checkout=success"),
      cancel_url: appUrl("/style-maker?checkout=cancel"),
      // Force English Checkout UI (otherwise Stripe follows browser locale).
      locale: "en",
      metadata: { clerkUserId: userId },
      subscription_data: {
        metadata: { clerkUserId: userId },
        // Card collected at checkout; first charge after 14 free days.
        trial_period_days: 14,
      },
      managed_payments: {
        enabled: true,
      },
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Checkout failed",
      },
      { status: 500 },
    )
  }
}
