import { NextResponse } from "next/server"
import { handleStripeWebhookRequest } from "@/lib/billing"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature")
  const payload = await request.text()

  try {
    const result = await handleStripeWebhookRequest({ payload, signature })
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook verification failed."
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
