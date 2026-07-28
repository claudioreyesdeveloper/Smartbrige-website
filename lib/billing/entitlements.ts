import { auth } from "@clerk/nextjs/server"
import { eq } from "drizzle-orm"
import { requireDb } from "@/lib/db"
import { subscriptions } from "@/lib/db/schema"
import type { Subscription } from "@/lib/db/schema"
import { isClerkFullyConfigured } from "@/lib/billing/clerk-config"
import { isDevBypassActive, warnDevBypass } from "@/lib/billing/dev-bypass"

/** A product a user can be entitled to independently of which plan they bought it through. */
export type Product = "style-maker" | "jam-player"

/** A Stripe-billed plan tier. One `subscriptions` row per user holds exactly one of these. */
export type Plan = "style_maker" | "jam_player" | "all_access"

export const PLANS: readonly Plan[] = ["style_maker", "jam_player", "all_access"]

/**
 * Which products each plan tier unlocks. `all_access` is a genuine superset,
 * not a separate SKU with its own logic — this is the single source of
 * truth other code should read instead of hand-rolling plan comparisons.
 */
export const PLAN_ENTITLEMENTS: Record<Plan, readonly Product[]> = {
  style_maker: ["style-maker"],
  jam_player: ["jam-player"],
  all_access: ["style-maker", "jam-player"],
}

const ACTIVE_STATUSES = new Set(["active", "trialing"])

const clerkConfigured = isClerkFullyConfigured()

export async function getAuthUserId(): Promise<string | null> {
  if (!clerkConfigured) {
    // Local-only escape hatch. Production / live Stripe must use real Clerk.
    if (isDevBypassActive()) {
      warnDevBypass("getAuthUserId (Clerk not configured)")
      return "local-dev-user"
    }
    return null
  }
  const session = await auth()
  return session.userId
}

/** Raw subscription row for a user, or null if none exists / DB is unreachable. */
export async function getSubscription(userId: string): Promise<Subscription | null> {
  try {
    const db = requireDb()
    const rows = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .limit(1)
    return rows[0] || null
  } catch {
    return null
  }
}

function planEntitlesProduct(plan: string, product: Product): boolean {
  const entitlements = PLAN_ENTITLEMENTS[plan as Plan]
  return entitlements ? entitlements.includes(product) : false
}

/** Whether `userId` currently has active/trialing billing access to `product`. */
export async function userHasProduct(userId: string, product: Product): Promise<boolean> {
  // isDevBypassActive() already implies Stripe/DATABASE_URL are not fully
  // configured, so this subsumes the old "Stripe or DB unset" check.
  if (isDevBypassActive()) {
    warnDevBypass(`userHasProduct(${product})`)
    return true
  }
  if (!process.env.STRIPE_SECRET_KEY || !process.env.DATABASE_URL) return false

  const sub = await getSubscription(userId)
  if (!sub || !ACTIVE_STATUSES.has(sub.status)) return false
  return planEntitlesProduct(sub.plan, product)
}

/** Server helper for gating Jam Player content. Free tier stays reachable either way. */
export async function getJamPlayerEntitlement(): Promise<{ hasFullAccess: boolean }> {
  const userId = await getAuthUserId()
  if (!userId) return { hasFullAccess: false }
  const hasFullAccess = await userHasProduct(userId, "jam-player")
  return { hasFullAccess }
}
