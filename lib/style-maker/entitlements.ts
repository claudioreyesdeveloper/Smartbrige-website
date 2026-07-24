import { auth } from "@clerk/nextjs/server"
import { eq } from "drizzle-orm"
import { requireDb } from "@/lib/db"
import { subscriptions } from "@/lib/db/schema"

const ACTIVE = new Set(["active", "trialing"])

const clerkConfigured = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY,
)

export async function getAuthUserId(): Promise<string | null> {
  if (!clerkConfigured) {
    // Local-only escape hatch. Production / live Stripe must use real Clerk.
    const allowLocalBypass =
      process.env.NODE_ENV === "development" &&
      !process.env.STRIPE_SECRET_KEY?.startsWith("sk_live_")
    return allowLocalBypass ? "local-dev-user" : null
  }
  const session = await auth()
  return session.userId
}

export async function getSubscriptionStatus(userId: string) {
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

export async function userHasActiveSubscription(userId: string): Promise<boolean> {
  // Until Stripe + DB are configured, allow local/dev use after sign-in (or local-dev-user).
  if (!process.env.STRIPE_SECRET_KEY || !process.env.DATABASE_URL) {
    return process.env.NODE_ENV === "development"
  }
  const sub = await getSubscriptionStatus(userId)
  return !!sub && ACTIVE.has(sub.status)
}
