/**
 * Style Maker entitlement helpers.
 *
 * Generalised into lib/billing/entitlements.ts to also cover Jam Player
 * (see docs/jam-player-product-plan.md §9). Re-exported here so existing
 * imports of `@/lib/style-maker/entitlements` keep working unchanged.
 */

import { getSubscription, userHasProduct } from "@/lib/billing/entitlements"

export { getAuthUserId, getJamPlayerEntitlement, PLAN_ENTITLEMENTS } from "@/lib/billing/entitlements"
export type { Plan, Product } from "@/lib/billing/entitlements"

/** @deprecated use `getSubscription` from `@/lib/billing/entitlements` */
export const getSubscriptionStatus = getSubscription

/** @deprecated use `userHasProduct(userId, "style-maker")` from `@/lib/billing/entitlements` */
export async function userHasActiveSubscription(userId: string): Promise<boolean> {
  return userHasProduct(userId, "style-maker")
}
