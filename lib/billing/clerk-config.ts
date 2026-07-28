/**
 * Whether Clerk should run in this process.
 *
 * Production (`pk_live_` / `sk_live_`) keys are bound to thesmartbridge.io.
 * Wrapping the app in <ClerkProvider> on localhost with those keys makes
 * clerk-js throw into the Next error overlay and can leave Jam Player /
 * Style Maker looking "dead" even though the audio engine is fine.
 *
 * Local `next dev` therefore treats live keys as unset. Use a Clerk
 * Development instance (pk_test_ / sk_test_) if you need auth locally.
 */

export type ClerkEnv = Partial<
  Pick<
    NodeJS.ProcessEnv,
    | "NODE_ENV"
    | "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"
    | "CLERK_SECRET_KEY"
    | "NEXT_PUBLIC_APP_URL"
  >
>

function isLocalDevHost(env: ClerkEnv): boolean {
  if (env.NODE_ENV === "development") return true
  const appUrl = env.NEXT_PUBLIC_APP_URL ?? ""
  return /localhost|127\.0\.0\.1/.test(appUrl)
}

/** True when the publishable key is safe to mount <ClerkProvider> with. */
export function isClerkPublishableEnabled(env: ClerkEnv = process.env): boolean {
  const pub = env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim()
  if (!pub) return false
  if (pub.startsWith("pk_live_") && isLocalDevHost(env)) return false
  return true
}

/** True when both keys are present and safe for middleware / server auth. */
export function isClerkFullyConfigured(env: ClerkEnv = process.env): boolean {
  if (!isClerkPublishableEnabled(env)) return false
  return Boolean(env.CLERK_SECRET_KEY?.trim())
}
