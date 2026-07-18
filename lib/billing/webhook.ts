import type Stripe from "stripe"
import { hashWebhookPayload } from "@/lib/billing/hash"
import {
  planSubscriptionEntitlementReconciliation,
  resolveUserIdFromSubscriptionMetadata,
} from "@/lib/billing/reconcile"
import type { BillingStores } from "@/lib/billing/stores"
import {
  toSubscriptionSnapshot,
  verifyStripeWebhookEvent,
  type StripeWebhookVerifier,
} from "@/lib/billing/stripe-adapters"
import {
  BILLING_USER_METADATA_KEY,
  type EntitlementUpsert,
} from "@/lib/billing/types"

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
  retrieveSubscription: (subscriptionId: string) => Promise<Stripe.Subscription | null>
  now?: Date
}

type PlannedWebhook = {
  result: ProcessWebhookResult
  entitlementUpserts: EntitlementUpsert[]
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
): Promise<PlannedWebhook> {
  const object = event.data.object as Stripe.Subscription
  const payloadSnapshot = toSubscriptionSnapshot(object)
  const authoritative = await deps.retrieveSubscription(payloadSnapshot.id)
  const snapshot = authoritative
    ? toSubscriptionSnapshot(authoritative)
    : {
        ...payloadSnapshot,
        status: "canceled",
        cancelAtPeriodEnd: false,
        currentPeriodEnd: null,
        canceledAt: deps.now ?? new Date(),
      }
  const userId = await resolveUserIdForSubscription(snapshot, deps)
    ?? await resolveUserIdForSubscription(payloadSnapshot, deps)
  if (!userId) {
    return {
      result: { status: "ignored", eventId: event.id, type: event.type },
      entitlementUpserts: [],
    }
  }

  const plan = await planSubscriptionEntitlementReconciliation({
    snapshot,
    userId,
    eventCreatedAt: eventCreatedAt(event),
    prices: deps.prices,
    entitlements: deps.entitlements,
    now: deps.now,
  })

  return {
    result: {
      status: "processed",
      eventId: event.id,
      type: event.type,
      applied: plan.applied,
      skippedStale: plan.skippedStale,
      skippedUnknownPrice: plan.skippedUnknownPrice,
    },
    entitlementUpserts: plan.upserts,
  }
}

async function processCheckoutSessionCompleted(
  event: Stripe.Event,
  deps: WebhookProcessorDeps,
): Promise<PlannedWebhook> {
  const session = event.data.object as Stripe.Checkout.Session
  if (session.mode !== "subscription") {
    return {
      result: { status: "ignored", eventId: event.id, type: event.type },
      entitlementUpserts: [],
    }
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
  if (!subscriptionId) {
    return {
      result: {
        status: "processed",
        eventId: event.id,
        type: event.type,
        applied: [],
        skippedStale: [],
        skippedUnknownPrice: [],
      },
      entitlementUpserts: [],
    }
  }

  const subscription = await deps.retrieveSubscription(subscriptionId)
  if (!subscription) {
    return {
      result: {
        status: "processed",
        eventId: event.id,
        type: event.type,
        applied: [],
        skippedStale: [],
        skippedUnknownPrice: [],
      },
      entitlementUpserts: [],
    }
  }
  const snapshot = toSubscriptionSnapshot(subscription)
  if (!userId) {
    return {
      result: { status: "ignored", eventId: event.id, type: event.type },
      entitlementUpserts: [],
    }
  }

  const plan = await planSubscriptionEntitlementReconciliation({
    snapshot,
    userId,
    eventCreatedAt: eventCreatedAt(event),
    prices: deps.prices,
    entitlements: deps.entitlements,
    now: deps.now,
  })

  return {
    result: {
      status: "processed",
      eventId: event.id,
      type: event.type,
      applied: plan.applied,
      skippedStale: plan.skippedStale,
      skippedUnknownPrice: plan.skippedUnknownPrice,
    },
    entitlementUpserts: plan.upserts,
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

  let planned: PlannedWebhook
  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      planned = await processSubscriptionEvent(event, input.deps)
      break
    case "checkout.session.completed":
      planned = await processCheckoutSessionCompleted(event, input.deps)
      break
    default:
      planned = {
        result: { status: "ignored", eventId: event.id, type: event.type },
        entitlementUpserts: [],
      }
      break
  }

  const commit = await input.deps.atomicWebhooks.commit({
    eventId: event.id,
    type: event.type,
    payloadHash,
    entitlementUpserts: planned.entitlementUpserts,
  })
  if (commit.status === "duplicate") {
    return { status: "duplicate", eventId: event.id }
  }

  if (planned.result.status === "processed") {
    const appliedIds = new Set(commit.appliedServiceIds)
    const applied = planned.entitlementUpserts
      .filter((upsert) => appliedIds.has(upsert.serviceId))
      .map((upsert) => upsert.serviceKey)
    const concurrentStale = planned.entitlementUpserts
      .filter((upsert) => !appliedIds.has(upsert.serviceId))
      .map((upsert) => upsert.serviceKey)
    return {
      ...planned.result,
      applied,
      skippedStale: [...planned.result.skippedStale, ...concurrentStale],
    }
  }

  return planned.result
}
