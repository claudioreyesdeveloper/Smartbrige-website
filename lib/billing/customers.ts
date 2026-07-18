import type Stripe from "stripe"
import { BillingError } from "@/lib/billing/errors"
import type { BillingCustomerStore } from "@/lib/billing/stores"
import { BILLING_USER_METADATA_KEY } from "@/lib/billing/types"

export type EnsureCustomerInput = {
  userId: string
  email: string
  stripe: Pick<Stripe, "customers">
  customers: BillingCustomerStore
}

/**
 * Durable customer mapping: local store first, then Stripe customer metadata
 * keyed by smartbridge_user_id. Never trusts a client-supplied customer id.
 */
export async function ensureStripeCustomer(
  input: EnsureCustomerInput,
): Promise<{ stripeCustomerId: string }> {
  const existing = await input.customers.getByUserId(input.userId)
  if (existing) {
    return { stripeCustomerId: existing.stripeCustomerId }
  }

  const listed = await input.stripe.customers.list({
    email: input.email,
    limit: 100,
  })
  const matched = listed.data.find(
    (customer) => customer.metadata?.[BILLING_USER_METADATA_KEY] === input.userId,
  )

  if (matched) {
    await input.customers.upsert({
      userId: input.userId,
      stripeCustomerId: matched.id,
      email: input.email,
    })
    return { stripeCustomerId: matched.id }
  }

  const created = await input.stripe.customers.create({
    email: input.email,
    metadata: {
      [BILLING_USER_METADATA_KEY]: input.userId,
    },
  })

  await input.customers.upsert({
    userId: input.userId,
    stripeCustomerId: created.id,
    email: input.email,
  })

  return { stripeCustomerId: created.id }
}

export async function requireMappedCustomer(
  userId: string,
  customers: BillingCustomerStore,
): Promise<string> {
  const record = await customers.getByUserId(userId)
  if (!record) {
    throw new BillingError(
      "invalid_request",
      "No Stripe customer is mapped for this account yet. Start a checkout first.",
    )
  }
  return record.stripeCustomerId
}
