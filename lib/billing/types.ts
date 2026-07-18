import type { EntitlementStatus } from "@/lib/auth/entitlement-logic"
import type { ServiceAvailability, ServiceKey } from "@/lib/services/catalog"

export const BILLING_USER_METADATA_KEY = "smartbridge_user_id"
export const BILLING_SERVICE_METADATA_KEY = "service_key"

export type BillingInterval = "month" | "year"

export type ServicePriceMapping = {
  serviceKey: ServiceKey
  serviceId: string
  availability: ServiceAvailability
  stripeProductId: string
  stripePriceId: string
  billingInterval: string
  active: boolean
}

export type StoredEntitlement = {
  userId: string
  serviceId: string
  serviceKey: ServiceKey
  status: EntitlementStatus
  source: "stripe" | "manual" | "promo"
  stripeSubscriptionId: string | null
  stripeSubscriptionItemId: string | null
  validFrom: Date
  validUntil: Date | null
  updatedAt: Date
}

export type EntitlementUpsert = {
  userId: string
  serviceId: string
  serviceKey: ServiceKey
  status: EntitlementStatus
  source: "stripe"
  stripeSubscriptionId: string | null
  stripeSubscriptionItemId: string | null
  validFrom: Date
  validUntil: Date | null
  eventCreatedAt: Date
  replaceOnlySubscriptionId: string | null
}

export type StripeSubscriptionSnapshot = {
  id: string
  status: string
  customerId: string
  cancelAtPeriodEnd: boolean
  currentPeriodStart: Date | null
  currentPeriodEnd: Date | null
  canceledAt: Date | null
  created: Date
  metadata: Record<string, string>
  items: Array<{
    id: string
    priceId: string
    productId: string | null
    metadata: Record<string, string>
  }>
}

export type CheckoutRequest = {
  userId: string
  email: string
  serviceKey: ServiceKey
}

export type CheckoutResult = {
  checkoutUrl: string
  sessionId: string
}

export type PortalResult = {
  portalUrl: string
}
