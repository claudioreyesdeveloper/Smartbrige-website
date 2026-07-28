import { NextResponse } from "next/server"
import { startOrChangeSubscription } from "@/lib/billing/checkout"
import { getAuthUserId } from "@/lib/billing/entitlements"
import type { Plan } from "@/lib/billing/entitlements"

const ALLOWED_PLANS: readonly Plan[] = ["jam_player", "all_access"]

/**
 * Stripe Checkout for the Jam Player product. Mirrors
 * app/api/style-maker/checkout/route.ts — see that file for the shared
 * plan-change-vs-new-subscription logic in lib/billing/checkout.ts.
 *
 * Defaults to the `jam_player` plan. Accepts an optional
 * `{ "plan": "all_access" }` JSON body for the All Access upsell.
 *
 * Jam Player's free tier requires no signup and no card (see
 * docs/jam-player-product-plan.md §5) — this route is only hit when a
 * signed-in user chooses to upgrade past it, never to reach the app itself.
 */
export async function POST(request: Request) {
  const userId = await getAuthUserId()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let plan: Plan = "jam_player"
  try {
    const body = await request.json()
    if (body && typeof body.plan === "string") {
      if (!ALLOWED_PLANS.includes(body.plan as Plan)) {
        return NextResponse.json(
          { error: `Invalid plan for this endpoint. Allowed: ${ALLOWED_PLANS.join(", ")}.` },
          { status: 400 },
        )
      }
      plan = body.plan as Plan
    }
  } catch {
    // No/invalid JSON body — fall back to the default plan.
  }

  try {
    const result = await startOrChangeSubscription({
      userId,
      plan,
      successPath: "/jam-player/app?checkout=success",
      cancelPath: "/jam-player?checkout=cancel",
    })
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }
    return NextResponse.json({ url: result.url })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Checkout failed",
      },
      { status: 500 },
    )
  }
}
