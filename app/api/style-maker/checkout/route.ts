import { NextResponse } from "next/server"
import { startOrChangeSubscription } from "@/lib/billing/checkout"
import { getAuthUserId } from "@/lib/style-maker/entitlements"
import type { Plan } from "@/lib/billing/entitlements"

const ALLOWED_PLANS: readonly Plan[] = ["style_maker", "all_access"]

/**
 * Stripe Checkout for the Style Maker product.
 *
 * Defaults to the `style_maker` plan. Accepts an optional
 * `{ "plan": "all_access" }` JSON body for the All Access upsell — any
 * other plan value is rejected. If the user already has an active
 * subscription on a different plan, this changes the plan on the existing
 * Stripe subscription (proration) instead of starting a second one; see
 * lib/billing/checkout.ts.
 *
 * Uses Managed Payments (merchant of record) as enabled on the Stripe account:
 * product must have an eligible tax_code (SaaS txcd_10103000), and Checkout
 * sets managed_payments.enabled = true per Stripe docs.
 * https://docs.stripe.com/payments/managed-payments/set-up
 */
export async function POST(request: Request) {
  const userId = await getAuthUserId()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let plan: Plan = "style_maker"
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
      successPath: "/style-maker/app?checkout=success",
      cancelPath: "/style-maker?checkout=cancel",
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
