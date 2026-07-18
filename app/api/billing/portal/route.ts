import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { BillingError, billingErrorHttpStatus, startBillingPortal } from "@/lib/billing"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST() {
  const session = await auth()
  const userId = session?.user?.id
  const email = session?.user?.email

  if (!userId || !email) {
    return NextResponse.json({ error: "Authentication is required." }, { status: 401 })
  }

  try {
    const result = await startBillingPortal({ userId, email })
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof BillingError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: billingErrorHttpStatus(error) },
      )
    }
    return NextResponse.json({ error: "Billing portal could not be opened." }, { status: 500 })
  }
}
