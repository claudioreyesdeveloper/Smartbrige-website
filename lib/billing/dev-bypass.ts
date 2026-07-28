/**
 * Dev-only entitlement bypass.
 *
 * When Stripe and/or Postgres aren't configured (a fresh local checkout,
 * `next dev` with no `.env.local` secrets), we let a signed-in user (or the
 * `local-dev-user` fallback from lib/billing/entitlements.ts) through as if
 * they were entitled to everything, so the app is usable offline without
 * standing up billing infrastructure.
 *
 * This is a foot-gun by construction — an entitlement check that returns
 * `true` for everyone — so it is isolated here as a single, testable,
 * explicitly-named predicate rather than an inline `NODE_ENV` check
 * scattered across call sites. Every condition below must hold; there is no
 * "any of" branch. In particular:
 *
 *   1. `NODE_ENV` must be exactly "development". This can never be true in
 *      a production build (`next build && next start` sets it to
 *      "production", and Vercel deployments always set it to "production"
 *      regardless of the target environment) or in a Vitest run
 *      ("test"), so this alone rules out prod and CI.
 *   2. `STRIPE_SECRET_KEY` must not look like a live key. Belt-and-braces:
 *      even if NODE_ENV were somehow "development" against a live Stripe
 *      account, refuse to bypass rather than risk granting free access to
 *      what is now a real, chargeable product.
 *   3. Billing must actually be unconfigured (missing Stripe key or missing
 *      DATABASE_URL). If both are present, there is no reason to bypass —
 *      fall through to the real entitlement check instead.
 *
 * Every call site that honours this predicate MUST also call
 * `warnDevBypass` so activation is loud, not silent.
 */

export type BypassEnv = Partial<
  Pick<NodeJS.ProcessEnv, "NODE_ENV" | "STRIPE_SECRET_KEY" | "DATABASE_URL">
>

export function isDevBypassActive(env: BypassEnv = process.env): boolean {
  if (env.NODE_ENV !== "development") return false
  if (env.STRIPE_SECRET_KEY?.startsWith("sk_live_")) return false

  const stripeConfigured = Boolean(env.STRIPE_SECRET_KEY)
  const dbConfigured = Boolean(env.DATABASE_URL)
  return !stripeConfigured || !dbConfigured
}

/**
 * Log loudly whenever the bypass actually grants access, so it shows up in
 * dev server output and can't silently ship unnoticed. `context` should
 * name the call site (e.g. "getAuthUserId", "userHasProduct(style-maker)").
 */
export function warnDevBypass(context: string): void {
  // eslint-disable-next-line no-console -- intentionally loud; this path must never be silent.
  console.warn(
    `[billing] DEV BYPASS ACTIVE (${context}): granting access without a real ` +
      `Stripe subscription because NODE_ENV=development and Stripe/DATABASE_URL ` +
      `are not fully configured. This must NEVER happen when NODE_ENV=production. ` +
      `Set STRIPE_SECRET_KEY and DATABASE_URL to disable.`,
  )
}
