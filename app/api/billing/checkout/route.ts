import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { BillingError, billingErrorHttpStatus, startServiceCheckout } from "@/lib/billing"
import { isServiceKey } from "@/lib/services/catalog"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type CheckoutBody = {
  serviceKey?: unknown
}

export async function POST(request: Request) {
  const session = await auth()
  const userId = session?.user?.id
  const email = session?.user?.email

  if (!userId || !email) {
    return NextResponse.json({ error: "Authentication is required." }, { status: 401 })
  }

  let body: CheckoutBody
  try {
    body = (await request.json()) as CheckoutBody
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
  }

  if (typeof body.serviceKey !== "string" || !isServiceKey(body.serviceKey)) {
    return NextResponse.json({ error: "A valid serviceKey is required." }, { status: 400 })
  }

  // Never accept client entitlement claims — only a service key for price lookup.
  try {
    const result = await startServiceCheckout({
      userId,
      email,
      serviceKey: body.serviceKey,
    })
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof BillingError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: billingErrorHttpStatus(error) },
      )
    }
    return NextResponse.json({ error: "Checkout could not be started." }, { status: 500 })
  }
}
