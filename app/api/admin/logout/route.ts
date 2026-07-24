import { NextResponse } from "next/server"
import { ADMIN_COOKIE, adminCookieOptions } from "@/lib/style-maker/admin-auth"

export async function POST() {
  const response = NextResponse.json({ ok: true })
  response.cookies.set(ADMIN_COOKIE, "", { ...adminCookieOptions(0), maxAge: 0 })
  return response
}
