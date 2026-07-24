/**
 * Upsert Style Maker entitlement rows from Stripe Subscription objects.
 * Used by webhooks and by pull-sync when webhooks are not configured (local).
 */

import { eq } from "drizzle-orm"
import type Stripe from "stripe"
import { requireDb } from "@/lib/db"
import { subscriptions } from "@/lib/db/schema"
import { getStripe } from "@/lib/style-maker/stripe"

export async function upsertFromSubscription(
  sub: Stripe.Subscription,
  userId: string,
) {
  const db = requireDb()
  const customerId =
    typeof sub.customer === "string" ? sub.customer : sub.customer.id
  const priceId = sub.items.data[0]?.price?.id || null
  const periodEnd =
    "current_period_end" in sub && typeof sub.current_period_end === "number"
      ? new Date(sub.current_period_end * 1000)
      : null

  const existing = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .limit(1)

  const values = {
    userId,
    stripeCustomerId: customerId,
    stripeSubscriptionId: sub.id,
    stripePriceId: priceId,
    status: sub.status,
    currentPeriodEnd: periodEnd,
    updatedAt: new Date(),
  }

  if (existing[0]) {
    await db
      .update(subscriptions)
      .set(values)
      .where(eq(subscriptions.userId, userId))
  } else {
    await db.insert(subscriptions).values({
      id: sub.id,
      ...values,
    })
  }
}

export type StripeCustomerProfile = {
  email: string | null
  name: string | null
  phone: string | null
  country: string | null
}

function customerProfile(
  customer: Stripe.Customer | Stripe.DeletedCustomer | string | null,
): StripeCustomerProfile | null {
  if (!customer || typeof customer === "string" || customer.deleted) return null
  return {
    email: customer.email || null,
    name: customer.name || null,
    phone: customer.phone || null,
    country: customer.address?.country || null,
  }
}

/** Pull recent Stripe subscriptions into Postgres (metadata.clerkUserId required). */
export async function syncSubscriptionsFromStripe(options?: {
  limit?: number
}): Promise<{
  synced: number
  profilesByUserId: Map<string, StripeCustomerProfile>
}> {
  const profilesByUserId = new Map<string, StripeCustomerProfile>()
  if (!process.env.STRIPE_SECRET_KEY || !process.env.DATABASE_URL) {
    return { synced: 0, profilesByUserId }
  }

  const stripe = getStripe()
  const limit = Math.min(100, Math.max(1, options?.limit || 50))
  const list = await stripe.subscriptions.list({
    status: "all",
    limit,
    expand: ["data.customer"],
  })

  let synced = 0
  for (const sub of list.data) {
    const userId = sub.metadata?.clerkUserId
    if (!userId) continue
    await upsertFromSubscription(sub, userId)
    const profile = customerProfile(sub.customer)
    if (profile) profilesByUserId.set(userId, profile)
    synced += 1
  }
  return { synced, profilesByUserId }
}

/** Sync one user’s Stripe subscription (by customer or subscription metadata). */
export async function syncUserSubscriptionFromStripe(
  userId: string,
): Promise<boolean> {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.DATABASE_URL) {
    return false
  }

  const stripe = getStripe()
  const db = requireDb()
  const existing = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .limit(1)

  if (existing[0]?.stripeSubscriptionId) {
    const sub = await stripe.subscriptions.retrieve(
      existing[0].stripeSubscriptionId,
    )
    await upsertFromSubscription(sub, userId)
    return true
  }

  if (existing[0]?.stripeCustomerId) {
    const list = await stripe.subscriptions.list({
      customer: existing[0].stripeCustomerId,
      status: "all",
      limit: 5,
    })
    const sub =
      list.data.find((row) =>
        ["active", "trialing", "past_due"].includes(row.status),
      ) || list.data[0]
    if (sub) {
      await upsertFromSubscription(sub, userId)
      return true
    }
  }

  const list = await stripe.subscriptions.list({ status: "all", limit: 50 })
  const match = list.data.find(
    (sub) => sub.metadata?.clerkUserId === userId,
  )
  if (match) {
    await upsertFromSubscription(match, userId)
    return true
  }
  return false
}
