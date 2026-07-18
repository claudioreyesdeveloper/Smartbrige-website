import type Stripe from "stripe"
import { hashWebhookPayload } from "@/lib/billing/hash"
import {
  reconcileSubscriptionEntitlements,
  resolveUserIdFromSubscriptionMetadata,
} from "@/lib/billing/reconcile"
import type { BillingStores } from "@/lib/billing/stores"
import {
  toSubscriptionSnapshot,
  verifyStripeWebhookEvent,
  type StripeWebhookVerifier,
} from "@/lib/billing/stripe-adapters"
import { BILLING_USER_METADATA_KEY } from "@/lib/billing/types"

export type ProcessWebhookResult =
  | { status: "duplicate"; eventId: string }
  | { status: "ignored"; eventId: string; type: string }
  | {
      status: "processed"
      eventId: string
      type: string
      applied: string[]
      skippedStale: string[]
      skippedUnknownPrice: string[]
    }

export type WebhookProcessorDeps = BillingStores & {
  stripeVerifier: StripeWebhookVerifier
  webhookSecret: string
  retrieveSubscription?: (subscriptionId: string) => Promise<Stripe.Subscription>
  runInTransaction?: <T>(operation: () => Promise<T>) => Promise<T>
  now?: Date
}

async function defaultTransaction<T>(operation: () => Promise<T>): Promise<T> {
  return operation()
}

function eventCreatedAt(event: Stripe.Event): Date {
  return new Date(event.created * 1000)
}

async function resolveUserIdForSubscription(
  snapshot: ReturnType<typeof toSubscriptionSnapshot>,
  stores: BillingStores,
): Promise<string | null> {
  const fromMetadata = resolveUserIdFromSubscriptionMetadata(snapshot.metadata)
  if (fromMetadata) {
    await stores.customers.upsert({
      userId: fromMetadata,
      stripeCustomerId: snapshot.customerId,
      email: "",
    })
    return fromMetadata
  }

  const mapped = await stores.customers.getByStripeCustomerId(snapshot.customerId)
  return mapped?.userId ?? null
}

async function processSubscriptionEvent(
  event: Stripe.Event,
  deps: WebhookProcessorDeps,
): Promise<ProcessWebhookResult> {
  const object = event.data.object as Stripe.Subscription
  const snapshot = toSubscriptionSnapshot(object)
  const userId = await resolveUserIdForSubscription(snapshot, deps)
  if (!userId) {
    return { status: "ignored", eventId: event.id, type: event.type }
  }

  const result = await reconcileSubscriptionEntitlements({
    snapshot,
    userId,
    eventCreatedAt: eventCreatedAt(event),
    prices: deps.prices,
    entitlements: deps.entitlements,
    now: deps.now,
  })

  return {
    status: "processed",
    eventId: event.id,
    type: event.type,
    applied: result.applied,
    skippedStale: result.skippedStale,
    skippedUnknownPrice: result.skippedUnknownPrice,
  }
}

async function processCheckoutSessionCompleted(
  event: Stripe.Event,
  deps: WebhookProcessorDeps,
): Promise<ProcessWebhookResult> {
  const session = event.data.object as Stripe.Checkout.Session
  if (session.mode !== "subscription") {
    return { status: "ignored", eventId: event.id, type: event.type }
  }

  const userId =
    session.metadata?.[BILLING_USER_METADATA_KEY] ||
    session.client_reference_id ||
    null
  const customerId =
    typeof session.customer === "string" ? session.customer : session.customer?.id
  if (userId && customerId) {
    await deps.customers.upsert({
      userId,
      stripeCustomerId: customerId,
      email: session.customer_details?.email ?? session.customer_email ?? "",
    })
  }

  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id
  if (!subscriptionId || !deps.retrieveSubscription) {
    return {
      status: "processed",
      eventId: event.id,
      type: event.type,
      applied: [],
      skippedStale: [],
      skippedUnknownPrice: [],
    }
  }

  const subscription = await deps.retrieveSubscription(subscriptionId)
  const snapshot = toSubscriptionSnapshot(subscription)
  if (!userId) {
    return { status: "ignored", eventId: event.id, type: event.type }
  }

  const result = await reconcileSubscriptionEntitlements({
    snapshot,
    userId,
    eventCreatedAt: eventCreatedAt(event),
    prices: deps.prices,
    entitlements: deps.entitlements,
    now: deps.now,
  })

  return {
    status: "processed",
    eventId: event.id,
    type: event.type,
    applied: result.applied,
    skippedStale: result.skippedStale,
    skippedUnknownPrice: result.skippedUnknownPrice,
  }
}

export async function processStripeWebhook(input: {
  payload: string
  signature: string | null
  deps: WebhookProcessorDeps
}): Promise<ProcessWebhookResult> {
  const event = verifyStripeWebhookEvent({
    payload: input.payload,
    signature: input.signature,
    secret: input.deps.webhookSecret,
    stripe: input.deps.stripeVerifier,
  })

  const payloadHash = hashWebhookPayload(input.payload)
  const runInTransaction = input.deps.runInTransaction ?? defaultTransaction

  return runInTransaction(async () => {
    if (await input.deps.webhookEvents.hasProcessed(event.id)) {
      return { status: "duplicate", eventId: event.id }
    }

    let result: ProcessWebhookResult
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        result = await processSubscriptionEvent(event, input.deps)
        break
      case "checkout.session.completed":
        result = await processCheckoutSessionCompleted(event, input.deps)
        break
      default:
        result = { status: "ignored", eventId: event.id, type: event.type }
        break
    }

    const mark = await input.deps.webhookEvents.markProcessed(
      event.id,
      event.type,
      payloadHash,
    )
    if (mark === "duplicate") {
      return { status: "duplicate", eventId: event.id }
    }

    return result
  })
}
