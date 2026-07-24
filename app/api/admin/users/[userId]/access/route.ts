import { NextRequest, NextResponse } from "next/server"
import {
  grantComplimentaryAccess,
  revokeAccess,
} from "@/lib/style-maker/admin"
import { requireAdminSession } from "@/lib/style-maker/admin-auth"

type RouteContext = { params: Promise<{ userId: string }> }

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await requireAdminSession()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { userId } = await context.params
  if (!userId?.startsWith("user_")) {
    return NextResponse.json({ error: "Invalid user id." }, { status: 400 })
  }

  let action = ""
  try {
    const body = (await request.json()) as { action?: string }
    action = String(body.action || "")
  } catch {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 })
  }

  try {
    if (action === "grant") {
      await grantComplimentaryAccess(userId)
      return NextResponse.json({ ok: true, action: "grant" })
    }
    if (action === "revoke") {
      await revokeAccess(userId)
      return NextResponse.json({ ok: true, action: "revoke" })
    }
    return NextResponse.json(
      { error: 'action must be "grant" or "revoke".' },
      { status: 400 },
    )
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Could not update access.",
      },
      { status: 400 },
    )
  }
}
