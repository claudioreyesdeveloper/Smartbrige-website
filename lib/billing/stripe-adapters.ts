import type Stripe from "stripe"
import type { StripeSubscriptionSnapshot } from "@/lib/billing/types"

function unixToDate(value: number | null | undefined): Date | null {
  if (value == null) {
    return null
  }
  return new Date(value * 1000)
}

function asMetadata(metadata: Stripe.Metadata | null | undefined): Record<string, string> {
  if (!metadata) {
    return {}
  }
  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(metadata)) {
    if (typeof value === "string") {
      result[key] = value
    }
  }
  return result
}

export function toSubscriptionSnapshot(
  subscription: Stripe.Subscription,
): StripeSubscriptionSnapshot {
  const items = subscription.items.data.map((item) => {
    const price = item.price
    const productId =
      typeof price.product === "string" ? price.product : (price.product?.id ?? null)
    return {
      id: item.id,
      priceId: price.id,
      productId,
      metadata: asMetadata(item.metadata),
    }
  })

  // Stripe API 2026-06-24.dahlia stores billing periods on subscription items.
  const periodStarts = subscription.items.data
    .map((item) => item.current_period_start)
    .filter((value): value is number => typeof value === "number")
  const periodEnds = subscription.items.data
    .map((item) => item.current_period_end)
    .filter((value): value is number => typeof value === "number")

  return {
    id: subscription.id,
    status: subscription.status,
    customerId: typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    currentPeriodStart: unixToDate(
      periodStarts.length > 0 ? Math.min(...periodStarts) : subscription.created,
    ),
    currentPeriodEnd: unixToDate(periodEnds.length > 0 ? Math.max(...periodEnds) : null),
    canceledAt: unixToDate(subscription.canceled_at),
    created: unixToDate(subscription.created) ?? new Date(0),
    metadata: asMetadata(subscription.metadata),
    items,
  }
}

export type StripeWebhookVerifier = {
  constructEvent(payload: string | Buffer, signature: string, secret: string): Stripe.Event
}

export function verifyStripeWebhookEvent(input: {
  payload: string | Buffer
  signature: string | null
  secret: string
  stripe: StripeWebhookVerifier
}): Stripe.Event {
  if (!input.signature) {
    throw new Error("Missing Stripe-Signature header")
  }
  return input.stripe.constructEvent(input.payload, input.signature, input.secret)
}
