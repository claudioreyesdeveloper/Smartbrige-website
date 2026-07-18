import type { EntitlementStatus } from "@/lib/auth/entitlement-logic"
import type { StripeSubscriptionSnapshot } from "@/lib/billing/types"

export function mapStripeSubscriptionStatus(
  snapshot: Pick<
    StripeSubscriptionSnapshot,
    "status" | "cancelAtPeriodEnd" | "currentPeriodEnd" | "canceledAt"
  >,
  now: Date = new Date(),
): EntitlementStatus {
  switch (snapshot.status) {
    case "active":
      return "active"
    case "trialing":
      return "trialing"
    case "canceled":
    case "unpaid":
    case "incomplete_expired":
      if (snapshot.currentPeriodEnd && snapshot.currentPeriodEnd > now) {
        return "canceled"
      }
      return "expired"
    case "past_due":
    case "incomplete":
    case "paused":
      return "canceled"
    default:
      return "expired"
  }
}

export function entitlementWindowFromSubscription(
  snapshot: StripeSubscriptionSnapshot,
): { validFrom: Date; validUntil: Date | null } {
  const validFrom = snapshot.currentPeriodStart ?? snapshot.created
  const validUntil =
    snapshot.status === "canceled" || snapshot.cancelAtPeriodEnd
      ? snapshot.currentPeriodEnd
      : snapshot.currentPeriodEnd
  return { validFrom, validUntil }
}

/** Skip applying an event when a newer entitlement write already landed. */
export function isStaleEntitlementUpdate(
  existingUpdatedAt: Date | null | undefined,
  eventCreatedAt: Date,
): boolean {
  if (!existingUpdatedAt) {
    return false
  }
  return existingUpdatedAt.getTime() > eventCreatedAt.getTime()
}
