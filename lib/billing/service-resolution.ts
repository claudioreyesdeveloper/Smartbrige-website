import { BillingError } from "@/lib/billing/errors"
import {
  BILLING_SERVICE_METADATA_KEY,
  type ServicePriceMapping,
} from "@/lib/billing/types"
import { isServiceKey, type ServiceKey } from "@/lib/services/catalog"

export function isPurchasableService(mapping: ServicePriceMapping): boolean {
  return mapping.availability === "active" && mapping.active
}

export function assertServicePurchasable(mapping: ServicePriceMapping): void {
  if (mapping.availability !== "active") {
    throw new BillingError(
      "unavailable_service",
      `Service "${mapping.serviceKey}" is not available for purchase.`,
    )
  }
  if (!mapping.active) {
    throw new BillingError(
      "unavailable_service",
      `No active Stripe price is configured for "${mapping.serviceKey}".`,
    )
  }
}

export function resolveServiceKeyFromMetadata(
  metadata: Record<string, string> | null | undefined,
): ServiceKey | null {
  const raw = metadata?.[BILLING_SERVICE_METADATA_KEY]
  if (!raw || !isServiceKey(raw)) {
    return null
  }
  return raw
}

/**
 * Derive the service for a Stripe price. Prefer DB price mappings; metadata is a
 * secondary check that must agree when both are present.
 */
export function resolveServiceFromPrice(input: {
  priceId: string
  priceMappings: ReadonlyMap<string, ServicePriceMapping>
  itemMetadata?: Record<string, string> | null
  subscriptionMetadata?: Record<string, string> | null
}): ServicePriceMapping {
  const fromDb = input.priceMappings.get(input.priceId)
  const fromMetadata =
    resolveServiceKeyFromMetadata(input.itemMetadata) ??
    resolveServiceKeyFromMetadata(input.subscriptionMetadata)

  if (!fromDb) {
    throw new BillingError(
      "unknown_price",
      `Stripe price "${input.priceId}" is not mapped to a SmartBridge service.`,
    )
  }

  if (fromMetadata && fromMetadata !== fromDb.serviceKey) {
    throw new BillingError(
      "invalid_request",
      `Stripe metadata service "${fromMetadata}" does not match price mapping "${fromDb.serviceKey}".`,
    )
  }

  return fromDb
}
