/**
 * Grant or revoke complimentary Style Maker access (no Stripe charge).
 *
 * Usage:
 *   set -a && source .env.vercel.local && set +a   # or .env.local with DATABASE_URL
 *   export DATABASE_URL="${DATABASE_URL_UNPOOLED:-$DATABASE_URL}"
 *
 *   npx tsx scripts/grant-style-maker-access.ts grant user_xxxxxxxx
 *   npx tsx scripts/grant-style-maker-access.ts revoke user_xxxxxxxx
 *   npx tsx scripts/grant-style-maker-access.ts status user_xxxxxxxx
 *
 * Clerk user id: Dashboard → Users → open the user → copy User ID (user_…).
 */

import { eq } from "drizzle-orm"
import { requireDb } from "../lib/db"
import { subscriptions } from "../lib/db/schema"

async function main() {
  const [action, userId] = process.argv.slice(2)
  if (!action || !userId || !userId.startsWith("user_")) {
    console.error(`Usage:
  npx tsx scripts/grant-style-maker-access.ts grant  user_xxx
  npx tsx scripts/grant-style-maker-access.ts revoke user_xxx
  npx tsx scripts/grant-style-maker-access.ts status user_xxx`)
    process.exit(1)
  }
  if (!["grant", "revoke", "status"].includes(action)) {
    console.error('Action must be "grant", "revoke", or "status".')
    process.exit(1)
  }

  const db = requireDb()
  const existing = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .limit(1)

  if (action === "status") {
    if (!existing[0]) {
      console.log(`No subscriptions row for ${userId} → not entitled.`)
      return
    }
    console.log(existing[0])
    return
  }

  if (action === "revoke") {
    if (!existing[0]) {
      console.log(`Nothing to revoke — no row for ${userId}.`)
      return
    }
    await db
      .update(subscriptions)
      .set({ status: "inactive", updatedAt: new Date() })
      .where(eq(subscriptions.userId, userId))
    console.log(`Revoked: ${userId} → status=inactive`)
    return
  }

  // grant
  const now = new Date()
  if (existing[0]) {
    await db
      .update(subscriptions)
      .set({
        status: "active",
        updatedAt: now,
      })
      .where(eq(subscriptions.userId, userId))
    console.log(`Updated: ${userId} → status=active (complimentary)`)
  } else {
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
    console.log(`Created: ${userId} → status=active (complimentary)`)
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
