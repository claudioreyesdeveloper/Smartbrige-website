/**
 * Style Maker admin: list Clerk users + subscription status, grant/revoke free access.
 */

import { eq } from "drizzle-orm"
import { clerkClient } from "@clerk/nextjs/server"
import { requireDb } from "@/lib/db"
import { subscriptions } from "@/lib/db/schema"
import { syncSubscriptionsFromStripe } from "@/lib/style-maker/subscription-sync"

const ENTITLED = new Set(["active", "trialing"])

export type AdminUserRow = {
  id: string
  email: string | null
  name: string | null
  phone: string | null
  country: string | null
  createdAt: number | null
  subscriptionStatus: string | null
  entitled: boolean
  complimentary: boolean
  stripeSubscriptionId: string | null
  currentPeriodEnd: string | null
  updatedAt: string | null
}

function rowFromSubscription(
  userId: string,
  sub: typeof subscriptions.$inferSelect | undefined,
  profile?: {
    email: string | null
    name: string | null
    phone?: string | null
    country?: string | null
    createdAt: number | null
  },
): AdminUserRow {
  const status = sub?.status || null
  const complimentary =
    !!sub &&
    ENTITLED.has(sub.status) &&
    (!sub.stripeSubscriptionId || sub.id.startsWith("comp_"))
  return {
    id: userId,
    email: profile?.email ?? null,
    name: profile?.name ?? (userId === "local-dev-user" ? "Local dev" : null),
    phone: profile?.phone ?? null,
    country: profile?.country ?? null,
    createdAt: profile?.createdAt ?? null,
    subscriptionStatus: status,
    entitled: !!status && ENTITLED.has(status),
    complimentary,
    stripeSubscriptionId: sub?.stripeSubscriptionId || null,
    currentPeriodEnd: sub?.currentPeriodEnd
      ? sub.currentPeriodEnd.toISOString()
      : null,
    updatedAt: sub?.updatedAt ? sub.updatedAt.toISOString() : null,
  }
}

export async function listAdminUsers(options?: {
  query?: string
  limit?: number
}): Promise<AdminUserRow[]> {
  // Local/dev often has no Stripe webhook — pull latest before listing.
  // Also brings Checkout name/email/etc from the Stripe customer.
  let stripeProfiles = new Map<
    string,
    { email: string | null; name: string | null; phone: string | null; country: string | null }
  >()
  try {
    const sync = await syncSubscriptionsFromStripe({ limit: 50 })
    stripeProfiles = sync.profilesByUserId
  } catch {
    // Admin still useful if Stripe is briefly unreachable.
  }

  const limit = Math.min(100, Math.max(1, options?.limit || 50))
  const query = options?.query?.trim()

  const db = requireDb()
  const subRows = await db.select().from(subscriptions)
  const byUser = new Map(subRows.map((row) => [row.userId, row]))

  const clerkConfigured = Boolean(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY,
  )

  const rows: AdminUserRow[] = []
  const seen = new Set<string>()

  if (clerkConfigured) {
    const client = await clerkClient()
    const list = await client.users.getUserList({
      limit,
      orderBy: "-created_at",
      ...(query ? { query } : {}),
    })

    for (const user of list.data) {
      const stripe = stripeProfiles.get(user.id)
      const clerkEmail =
        user.primaryEmailAddress?.emailAddress ||
        user.emailAddresses[0]?.emailAddress ||
        null
      const clerkName =
        [user.firstName, user.lastName].filter(Boolean).join(" ") ||
        user.username ||
        null
      rows.push(
        rowFromSubscription(user.id, byUser.get(user.id), {
          email: clerkEmail || stripe?.email || null,
          name: clerkName || stripe?.name || null,
          phone: stripe?.phone || null,
          country: stripe?.country || null,
          createdAt: user.createdAt ?? null,
        }),
      )
      seen.add(user.id)
    }
  }

  // Subscriptions keyed outside Clerk (e.g. local-dev-user without Clerk).
  for (const sub of subRows) {
    if (seen.has(sub.userId)) continue
    const stripe = stripeProfiles.get(sub.userId)
    const email = stripe?.email || null
    const name =
      stripe?.name || (sub.userId === "local-dev-user" ? "Local dev" : null)
    if (query) {
      const q = query.toLowerCase()
      if (
        !sub.userId.toLowerCase().includes(q) &&
        !(sub.stripeSubscriptionId || "").toLowerCase().includes(q) &&
        !(sub.status || "").toLowerCase().includes(q) &&
        !(email || "").toLowerCase().includes(q) &&
        !(name || "").toLowerCase().includes(q) &&
        !(stripe?.country || "").toLowerCase().includes(q)
      ) {
        continue
      }
    }
    rows.push(
      rowFromSubscription(sub.userId, sub, {
        email,
        name,
        phone: stripe?.phone || null,
        country: stripe?.country || null,
        createdAt: null,
      }),
    )
    seen.add(sub.userId)
  }

  rows.sort((a, b) => {
    if (a.entitled !== b.entitled) return a.entitled ? -1 : 1
    return (b.updatedAt || "").localeCompare(a.updatedAt || "")
  })

  return rows
}

function assertAdminTargetUserId(userId: string) {
  if (!userId.trim() || userId.length > 200) {
    throw new Error("Invalid user id.")
  }
}

export async function grantComplimentaryAccess(userId: string): Promise<void> {
  assertAdminTargetUserId(userId)
  const db = requireDb()
  const existing = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .limit(1)
  const now = new Date()
  if (existing[0]) {
    await db
      .update(subscriptions)
      .set({ status: "active", updatedAt: now })
      .where(eq(subscriptions.userId, userId))
    return
  }
  await db.insert(subscriptions).values({
    id: `comp_${userId}`,
    userId,
    status: "active",
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    stripePriceId: null,
    currentPeriodEnd: null,
    createdAt: now,
    updatedAt: now,
  })
}

export async function revokeAccess(userId: string): Promise<void> {
  assertAdminTargetUserId(userId)
  const db = requireDb()
  const existing = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .limit(1)
  if (!existing[0]) {
    throw new Error("No subscription row for this user.")
  }
  await db
    .update(subscriptions)
    .set({ status: "inactive", updatedAt: new Date() })
    .where(eq(subscriptions.userId, userId))
}
