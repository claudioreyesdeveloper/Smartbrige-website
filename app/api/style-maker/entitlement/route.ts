import { NextResponse } from "next/server"
import {
  getAuthUserId,
  getSubscriptionStatus,
  userHasActiveSubscription,
} from "@/lib/style-maker/entitlements"
import { syncUserSubscriptionFromStripe } from "@/lib/style-maker/subscription-sync"

export async function GET() {
  const userId = await getAuthUserId()
  if (!userId) {
    return NextResponse.json({
      authenticated: false,
      entitled: false,
      userId: null,
    })
  }

  // Without a local Stripe webhook, Checkout never updates Postgres — pull once.
  try {
    await syncUserSubscriptionFromStripe(userId)
  } catch {
    // Fall through to whatever is already in the DB.
  }

  const entitled = await userHasActiveSubscription(userId)
  const sub = await getSubscriptionStatus(userId)
  return NextResponse.json({
    authenticated: true,
    entitled,
    userId,
    status: sub?.status || (entitled ? "active" : "inactive"),
    currentPeriodEnd: sub?.currentPeriodEnd || null,
  })
}
