import type Stripe from "stripe"
import { ensureStripeCustomer } from "@/lib/billing/customers"
import { getAppUrl } from "@/lib/billing/env"
import { BillingError } from "@/lib/billing/errors"
import { assertServicePurchasable } from "@/lib/billing/service-resolution"
import type { BillingCustomerStore, ServicePriceStore } from "@/lib/billing/stores"
import {
  BILLING_SERVICE_METADATA_KEY,
  BILLING_USER_METADATA_KEY,
  type CheckoutRequest,
  type CheckoutResult,
} from "@/lib/billing/types"
import { getSharedServiceCatalogEntry, isServiceKey } from "@/lib/services/catalog"

export type CreateCheckoutDeps = {
  stripe: Pick<Stripe, "checkout" | "customers">
  prices: ServicePriceStore
  customers: BillingCustomerStore
  appUrl?: string
}

export async function createServiceCheckoutSession(
  request: CheckoutRequest,
  deps: CreateCheckoutDeps,
): Promise<CheckoutResult> {
  if (!request.userId) {
    throw new BillingError("unauthenticated", "Authentication is required.")
  }
  if (!isServiceKey(request.serviceKey)) {
    throw new BillingError("invalid_request", "Unknown service key.")
  }

  const catalog = getSharedServiceCatalogEntry(request.serviceKey)
  if (catalog.availability !== "active") {
    throw new BillingError(
      "unavailable_service",
      `Service "${request.serviceKey}" is not available for purchase.`,
    )
  }

  const mapping = await deps.prices.getByServiceKey(request.serviceKey)
  if (!mapping) {
    throw new BillingError(
      "unavailable_service",
      `No Stripe price is configured for "${request.serviceKey}".`,
    )
  }
  assertServicePurchasable(mapping)

  const { stripeCustomerId } = await ensureStripeCustomer({
    userId: request.userId,
    email: request.email,
    stripe: deps.stripe,
    customers: deps.customers,
  })

  const appUrl = deps.appUrl ?? getAppUrl()
  const metadata = {
    [BILLING_USER_METADATA_KEY]: request.userId,
    [BILLING_SERVICE_METADATA_KEY]: request.serviceKey,
  }

  const session = await deps.stripe.checkout.sessions.create({
    mode: "subscription",
    customer: stripeCustomerId,
    client_reference_id: request.userId,
    line_items: [{ price: mapping.stripePriceId, quantity: 1 }],
    success_url: `${appUrl}/app/billing/return?status=success&service=${request.serviceKey}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/app/billing/return?status=cancelled&service=${request.serviceKey}`,
    metadata,
    subscription_data: {
      metadata,
    },
  })

  if (!session.url) {
    throw new BillingError("stripe", "Stripe Checkout did not return a session URL.")
  }

  return {
    checkoutUrl: session.url,
    sessionId: session.id,
  }
}
