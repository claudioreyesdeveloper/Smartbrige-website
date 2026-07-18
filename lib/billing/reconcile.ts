import { BillingError } from "@/lib/billing/errors"
import {
  entitlementWindowFromSubscription,
  isStaleEntitlementUpdate,
  mapStripeSubscriptionStatus,
} from "@/lib/billing/subscription-status"
import { resolveServiceFromPrice } from "@/lib/billing/service-resolution"
import type { EntitlementStore, ServicePriceStore } from "@/lib/billing/stores"
import type { EntitlementUpsert, StripeSubscriptionSnapshot } from "@/lib/billing/types"
import { BILLING_USER_METADATA_KEY } from "@/lib/billing/types"
import type { ServiceKey } from "@/lib/services/catalog"

export type ReconcileResult = {
  applied: ServiceKey[]
  skippedStale: ServiceKey[]
  skippedUnknownPrice: string[]
}

export type ReconcilePlan = ReconcileResult & {
  upserts: EntitlementUpsert[]
}

export async function planSubscriptionEntitlementReconciliation(input: {
  snapshot: StripeSubscriptionSnapshot
  userId: string
  eventCreatedAt: Date
  prices: ServicePriceStore
  entitlements: EntitlementStore
  now?: Date
}): Promise<ReconcilePlan> {
  const now = input.now ?? new Date()
  const mappings = await input.prices.listActiveMappings()
  const priceMap = new Map(mappings.map((row) => [row.stripePriceId, row]))

  const applied: ServiceKey[] = []
  const skippedStale: ServiceKey[] = []
  const skippedUnknownPrice: string[] = []
  const upserts: EntitlementUpsert[] = []

  if (input.snapshot.items.length === 0) {
    return { applied, skippedStale, skippedUnknownPrice, upserts }
  }

  for (const item of input.snapshot.items) {
    let mapping
    try {
      mapping = resolveServiceFromPrice({
        priceId: item.priceId,
        priceMappings: priceMap,
        itemMetadata: item.metadata,
        subscriptionMetadata: input.snapshot.metadata,
      })
    } catch (error) {
      if (error instanceof BillingError && error.code === "unknown_price") {
        skippedUnknownPrice.push(item.priceId)
        continue
      }
      throw error
    }

    const existing = await input.entitlements.getByUserAndService(
      input.userId,
      mapping.serviceKey,
    )
    if (isStaleEntitlementUpdate(existing?.updatedAt, input.eventCreatedAt)) {
      skippedStale.push(mapping.serviceKey)
      continue
    }

    const status = mapStripeSubscriptionStatus(input.snapshot, now)
    const window = entitlementWindowFromSubscription(input.snapshot)
    const upsert: EntitlementUpsert = {
      userId: input.userId,
      serviceId: mapping.serviceId,
      serviceKey: mapping.serviceKey,
      status,
      source: "stripe",
      stripeSubscriptionId: input.snapshot.id,
      stripeSubscriptionItemId: item.id,
      validFrom: window.validFrom,
      validUntil: window.validUntil,
      eventCreatedAt: input.eventCreatedAt,
    }
    upserts.push(upsert)
    applied.push(mapping.serviceKey)
  }

  return { applied, skippedStale, skippedUnknownPrice, upserts }
}

export async function reconcileSubscriptionEntitlements(input: {
  snapshot: StripeSubscriptionSnapshot
  userId: string
  eventCreatedAt: Date
  prices: ServicePriceStore
  entitlements: EntitlementStore
  now?: Date
}): Promise<ReconcileResult> {
  const plan = await planSubscriptionEntitlementReconciliation(input)
  for (const upsert of plan.upserts) {
    await input.entitlements.upsert(upsert)
  }
  return {
    applied: plan.applied,
    skippedStale: plan.skippedStale,
    skippedUnknownPrice: plan.skippedUnknownPrice,
  }
}

export function resolveUserIdFromSubscriptionMetadata(
  metadata: Record<string, string>,
): string | null {
  const userId = metadata[BILLING_USER_METADATA_KEY]
  return userId && userId.length > 0 ? userId : null
}
