import Stripe from "stripe"
import type { Plan } from "@/lib/billing/entitlements"

let stripe: Stripe | null = null

export function getStripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not configured.")
  }
  if (!stripe) {
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
  }
  return stripe
}

export function appUrl(path = ""): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(
    /\/$/,
    "",
  )
  return `${base}${path.startsWith("/") ? path : `/${path}`}`
}

/**
 * Stripe price id for a given plan tier.
 *
 * `style_maker` falls back to the original `STRIPE_PRICE_ID` env var so
 * existing deployments that only set that variable keep working unchanged;
 * `STRIPE_PRICE_STYLE_MAKER` is the preferred name going forward.
 */
export function priceIdForPlan(plan: Plan): string | null {
  switch (plan) {
    case "style_maker":
      return process.env.STRIPE_PRICE_STYLE_MAKER || process.env.STRIPE_PRICE_ID || null
    case "jam_player":
      return process.env.STRIPE_PRICE_JAM_PLAYER || null
    case "all_access":
      return process.env.STRIPE_PRICE_ALL_ACCESS || null
    default: {
      const _exhaustive: never = plan
      return _exhaustive
    }
  }
}

/**
 * Reverse lookup used by the webhook to derive `plan` from the Stripe price
 * id on the subscription/invoice line item. Returns null when the price id
 * doesn't match any configured plan (e.g. a stale/removed price, or Stripe
 * running against different env vars than this deploy) — callers should
 * fall back to the subscription's existing plan rather than guessing.
 */
export function planForPriceId(priceId: string | null | undefined): Plan | null {
  if (!priceId) return null
  if (priceId === process.env.STRIPE_PRICE_ALL_ACCESS) return "all_access"
  if (priceId === process.env.STRIPE_PRICE_JAM_PLAYER) return "jam_player"
  if (priceId === process.env.STRIPE_PRICE_STYLE_MAKER || priceId === process.env.STRIPE_PRICE_ID) {
    return "style_maker"
  }
  return null
}
