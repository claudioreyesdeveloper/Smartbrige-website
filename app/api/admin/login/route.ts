import { NextRequest, NextResponse } from "next/server"
import {
  ADMIN_COOKIE,
  adminCookieOptions,
  adminPasswordConfigured,
  adminSessionToken,
  verifyAdminPassword,
} from "@/lib/style-maker/admin-auth"

export async function POST(request: NextRequest) {
  if (!adminPasswordConfigured()) {
    return NextResponse.json(
      { error: "ADMIN_PASSWORD is not configured on the server." },
      { status: 503 },
    )
  }

  let password = ""
  try {
    const body = (await request.json()) as { password?: string }
    password = String(body.password || "")
  } catch {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 })
  }

  if (!verifyAdminPassword(password)) {
    return NextResponse.json({ error: "Wrong password." }, { status: 401 })
  }

  const token = adminSessionToken()
  if (!token) {
    return NextResponse.json({ error: "Admin session unavailable." }, { status: 503 })
  }

  const response = NextResponse.json({ ok: true })
  response.cookies.set(ADMIN_COOKIE, token, adminCookieOptions())
  return response
}
