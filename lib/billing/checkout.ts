import { eq } from "drizzle-orm"
import { requireDb } from "@/lib/db"
import { subscriptions } from "@/lib/db/schema"
import type { Plan } from "@/lib/billing/entitlements"
import { appUrl, getStripe, priceIdForPlan } from "@/lib/billing/stripe"

const ACTIVE_STATUSES = new Set(["active", "trialing"])

export type StartCheckoutParams = {
  userId: string
  plan: Plan
  successPath: string
  cancelPath: string
}

export type StartCheckoutResult =
  | { url: string }
  | { error: string; status: number }

/**
 * Start (or change into) a plan for `userId`.
 *
 * Because `subscriptions.userId` is unique — one row/one Stripe subscription
 * per user by design (see docs/jam-player-product-plan.md §9) — a user who
 * already has an active/trialing subscription on a *different* plan must
 * never end up with a second concurrent Stripe subscription. Instead this
 * updates the existing subscription's price in place, which Stripe prorates
 * automatically. Only a user with no active subscription goes through
 * Checkout to create one.
 */
export async function startOrChangeSubscription(
  params: StartCheckoutParams,
): Promise<StartCheckoutResult> {
  const priceId = priceIdForPlan(params.plan)
  if (!priceId || !process.env.STRIPE_SECRET_KEY) {
    return {
      error: `Stripe is not configured for plan "${params.plan}". Set STRIPE_SECRET_KEY and its price env var.`,
      status: 503,
    }
  }

  const stripe = getStripe()
  const db = requireDb()
  const existing = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, params.userId))
    .limit(1)
  const row = existing[0]

  // Existing active/trialing subscription: change the plan on it (Stripe
  // prorates), never create a second concurrent subscription.
  if (row?.stripeSubscriptionId && ACTIVE_STATUSES.has(row.status)) {
    const currentSub = await stripe.subscriptions.retrieve(row.stripeSubscriptionId)
    const currentItem = currentSub.items.data[0]

    if (currentItem?.price?.id === priceId) {
      // Already on the requested plan — nothing to do, just send them back in.
      return { url: appUrl(params.successPath) }
    }

    if (currentItem) {
      await stripe.subscriptions.update(row.stripeSubscriptionId, {
        items: [{ id: currentItem.id, price: priceId }],
        proration_behavior: "create_prorations",
        metadata: { clerkUserId: params.userId },
      })
      // The webhook (customer.subscription.updated) will persist the new
      // plan/price from Stripe's event, keeping Postgres as a read-through
      // cache of Stripe rather than a second place plan changes are decided.
      return { url: appUrl(params.successPath) }
    }
    // No line item on the existing subscription (shouldn't happen) — fall
    // through to Checkout as a last resort.
  }

  let customerId = row?.stripeCustomerId || undefined
  if (!customerId) {
    const customer = await stripe.customers.create({
      metadata: { clerkUserId: params.userId },
    })
    customerId = customer.id
    if (row) {
      await db
        .update(subscriptions)
        .set({ stripeCustomerId: customerId, updatedAt: new Date() })
        .where(eq(subscriptions.userId, params.userId))
    } else {
      await db.insert(subscriptions).values({
        id: `sub_pending_${params.userId}`,
        userId: params.userId,
        stripeCustomerId: customerId,
        status: "inactive",
        plan: params.plan,
      })
    }
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: appUrl(params.successPath),
    cancel_url: appUrl(params.cancelPath),
    // Force English Checkout UI (otherwise Stripe follows browser locale).
    locale: "en",
    metadata: { clerkUserId: params.userId, plan: params.plan },
    subscription_data: {
      metadata: { clerkUserId: params.userId, plan: params.plan },
      // Card collected at checkout; first charge after 14 free days.
      trial_period_days: 14,
    },
    managed_payments: {
      enabled: true,
    },
  })

  if (!session.url) {
    return { error: "Stripe did not return a Checkout URL.", status: 500 }
  }
  return { url: session.url }
}
