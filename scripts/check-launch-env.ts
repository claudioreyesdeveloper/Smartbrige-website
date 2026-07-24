/**
 * Verify env vars required to publish Style Maker + marketing site.
 * Usage: npx tsx scripts/check-launch-env.ts
 * Loads .env.local then .env.vercel.local (does not print secret values).
 */

import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"

function loadEnvFile(path: string) {
  if (!existsSync(path)) return
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eq = trimmed.indexOf("=")
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq)
    let value = trimmed.slice(eq + 1)
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (!(key in process.env) || !process.env[key]) {
      process.env[key] = value
    }
  }
}

const root = resolve(import.meta.dirname, "..")
loadEnvFile(resolve(root, ".env.local"))
loadEnvFile(resolve(root, ".env.vercel.local"))

const required = [
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
  "CLERK_SECRET_KEY",
  "DATABASE_URL",
  "STRIPE_SECRET_KEY",
  "STRIPE_PRICE_ID",
  "STRIPE_WEBHOOK_SECRET",
  "ADMIN_PASSWORD",
] as const

const missing = required.filter((key) => !process.env[key]?.trim())
const present = required.filter((key) => !!process.env[key]?.trim())

console.log("Launch env check (local files)")
for (const key of present) console.log(`  OK  ${key}`)
for (const key of missing) console.log(`  MISSING  ${key}`)

if (process.env.NEXT_PUBLIC_APP_URL) {
  const url = process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")
  console.log(`\nApp URL: ${url}`)
  console.log(`Webhook endpoint: ${url}/api/style-maker/webhook`)
  console.log(
    "Stripe events to enable: checkout.session.completed, customer.subscription.created, customer.subscription.updated, customer.subscription.deleted",
  )
}

if (missing.length) {
  console.log(
    `\n${missing.length} required key(s) missing locally. Set the same keys in Vercel Production before go-live.`,
  )
  process.exit(1)
}

console.log("\nAll required keys present in local env files.")
