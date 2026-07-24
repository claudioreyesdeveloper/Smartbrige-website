import { NextRequest, NextResponse } from "next/server"
import { listAdminUsers } from "@/lib/style-maker/admin"
import { requireAdminSession } from "@/lib/style-maker/admin-auth"

export async function GET(request: NextRequest) {
  const auth = await requireAdminSession()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  try {
    const query = request.nextUrl.searchParams.get("q") || undefined
    const users = await listAdminUsers({ query, limit: 50 })
    return NextResponse.json({ users })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Could not list users.",
      },
      { status: 500 },
    )
  }
}
