import type Stripe from "stripe"
import { requireMappedCustomer } from "@/lib/billing/customers"
import { getAppUrl } from "@/lib/billing/env"
import { BillingError } from "@/lib/billing/errors"
import type { BillingCustomerStore } from "@/lib/billing/stores"
import type { PortalResult } from "@/lib/billing/types"

export type CreatePortalDeps = {
  stripe: Pick<Stripe, "billingPortal">
  customers: BillingCustomerStore
  appUrl?: string
}

export async function createBillingPortalSession(
  userId: string,
  deps: CreatePortalDeps,
): Promise<PortalResult> {
  if (!userId) {
    throw new BillingError("unauthenticated", "Authentication is required.")
  }

  const stripeCustomerId = await requireMappedCustomer(userId, deps.customers)
  const appUrl = deps.appUrl ?? getAppUrl()

  const session = await deps.stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: `${appUrl}/app/billing`,
  })

  return { portalUrl: session.url }
}
