import { createServiceCheckoutSession } from "@/lib/billing/checkout"
import {
  createDrizzleEntitlementStore,
  createDrizzlePriceStore,
  createDrizzleWebhookEventStore,
  createStripeMetadataCustomerStore,
} from "@/lib/billing/drizzle-stores"
import { getAppUrl, getStripeWebhookSecret } from "@/lib/billing/env"
import { createBillingPortalSession } from "@/lib/billing/portal"
import { getStripeClient } from "@/lib/billing/stripe-client"
import type { BillingStores } from "@/lib/billing/stores"
import type { CheckoutRequest, CheckoutResult, PortalResult } from "@/lib/billing/types"
import { processStripeWebhook, type ProcessWebhookResult } from "@/lib/billing/webhook"
import type { ServiceKey } from "@/lib/services/catalog"

export function createProductionBillingStores(): BillingStores {
  const stripe = getStripeClient()
  return {
    customers: createStripeMetadataCustomerStore(stripe),
    prices: createDrizzlePriceStore(),
    entitlements: createDrizzleEntitlementStore(),
    webhookEvents: createDrizzleWebhookEventStore(),
  }
}

export async function startServiceCheckout(
  request: CheckoutRequest,
): Promise<CheckoutResult> {
  const stripe = getStripeClient()
  const stores = createProductionBillingStores()
  return createServiceCheckoutSession(request, {
    stripe,
    prices: stores.prices,
    customers: stores.customers,
    appUrl: getAppUrl(),
  })
}

export async function startBillingPortal(input: {
  userId: string
  email: string
}): Promise<PortalResult> {
  const stripe = getStripeClient()
  const stores = createProductionBillingStores()

  // Ensure mapping exists (Stripe metadata) before opening the portal.
  const { ensureStripeCustomer } = await import("@/lib/billing/customers")
  await ensureStripeCustomer({
    userId: input.userId,
    email: input.email,
    stripe,
    customers: stores.customers,
  })

  return createBillingPortalSession(input.userId, {
    stripe,
    customers: stores.customers,
    appUrl: getAppUrl(),
  })
}

export async function handleStripeWebhookRequest(input: {
  payload: string
  signature: string | null
}): Promise<ProcessWebhookResult> {
  const stripe = getStripeClient()
  const stores = createProductionBillingStores()

  return processStripeWebhook({
    payload: input.payload,
    signature: input.signature,
    deps: {
      ...stores,
      stripeVerifier: stripe.webhooks,
      webhookSecret: getStripeWebhookSecret(),
      retrieveSubscription: (subscriptionId) => stripe.subscriptions.retrieve(subscriptionId),
    },
  })
}

export function billingUpgradePath(serviceKey: ServiceKey): string {
  return `/app/billing?service=${serviceKey}`
}
