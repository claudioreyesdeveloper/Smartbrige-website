import Stripe from "stripe"
import { getStripeSecretKey } from "@/lib/billing/env"

let stripeClient: Stripe | undefined

export function createStripeClient(secretKey: string): Stripe {
  return new Stripe(secretKey, {
    apiVersion: "2026-06-24.dahlia",
    typescript: true,
  })
}

export function getStripeClient(): Stripe {
  if (!stripeClient) {
    stripeClient = createStripeClient(getStripeSecretKey())
  }
  return stripeClient
}

export function resetStripeClientForTests(): void {
  stripeClient = undefined
}
