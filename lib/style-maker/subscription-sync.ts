/**
 * Generalised into lib/billing/subscription-sync.ts to also cover Jam
 * Player. Re-exported here so existing imports keep working unchanged.
 */
export {
  upsertFromSubscription,
  syncSubscriptionsFromStripe,
  syncUserSubscriptionFromStripe,
} from "@/lib/billing/subscription-sync"
export type { StripeCustomerProfile } from "@/lib/billing/subscription-sync"
