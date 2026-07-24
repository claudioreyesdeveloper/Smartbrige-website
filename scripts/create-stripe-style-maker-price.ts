/**
 * One-shot: create Style Maker product + $14.99/mo price in Stripe.
 *
 * Usage (from Smartbridge-website):
 *   set -a && source .env.local && set +a
 *   npx tsx scripts/create-stripe-style-maker-price.ts
 *
 * Then copy the printed STRIPE_PRICE_ID into .env.local / Vercel.
 * Checkout already applies trial_period_days: 14 in code.
 */

import Stripe from "stripe"

async function main() {
  const secret = process.env.STRIPE_SECRET_KEY
  if (!secret) {
    console.error("Set STRIPE_SECRET_KEY in the environment first.")
    process.exit(1)
  }

  const stripe = new Stripe(secret)

  // Managed Payments requires an eligible product tax code:
  // https://docs.stripe.com/payments/managed-payments/eligibility
  const product = await stripe.products.create({
    name: "SmartBridge Style Maker",
    description:
      "Style Maker web app: phrase library, CASM-aware export, USB transfer, and cloud projects.",
    tax_code: "txcd_10103000", // SaaS — personal use
    metadata: {
      app: "smartbridge-style-maker",
    },
  })

  const price = await stripe.prices.create({
    product: product.id,
    currency: "usd",
    unit_amount: 1499,
    recurring: { interval: "month" },
    nickname: "Style Maker monthly",
    tax_behavior: "exclusive", // $14.99 + VAT calculated by Managed Payments
    metadata: {
      app: "smartbridge-style-maker",
      trial_days: "14",
    },
  })

  console.log("")
  console.log("Created Stripe product + price.")
  console.log(`  Product: ${product.id}`)
  console.log(`  Price:   ${price.id}`)
  console.log("")
  console.log("Add this to .env.local and Vercel:")
  console.log(`STRIPE_PRICE_ID=${price.id}`)
  console.log("")
  console.log("14-day trial is applied by checkout (subscription_data.trial_period_days).")
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
