import { BillingError } from "@/lib/billing/errors"

/** Environment variable names used by billing (values never logged here). */
export const BILLING_ENV = {
  stripeSecretKey: "STRIPE_SECRET_KEY",
  stripeWebhookSecret: "STRIPE_WEBHOOK_SECRET",
  stripePublishableKey: "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
  appUrl: "APP_URL",
} as const

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new BillingError("configuration", `${name} is not configured`)
  }
  return value
}

export function getStripeSecretKey(): string {
  return requireEnv(BILLING_ENV.stripeSecretKey)
}

export function getStripeWebhookSecret(): string {
  return requireEnv(BILLING_ENV.stripeWebhookSecret)
}

export function getAppUrl(): string {
  return requireEnv(BILLING_ENV.appUrl).replace(/\/$/, "")
}
