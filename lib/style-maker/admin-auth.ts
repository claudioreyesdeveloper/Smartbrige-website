/**
 * Shared-password gate for /admin (no Clerk roles).
 * Set ADMIN_PASSWORD in the environment.
 */

import { createHmac, timingSafeEqual } from "crypto"
import { cookies } from "next/headers"
import type { NextRequest } from "next/server"

export const ADMIN_COOKIE = "sb_style_maker_admin"

function adminPassword(): string | null {
  const value = process.env.ADMIN_PASSWORD?.trim()
  return value || null
}

export function adminPasswordConfigured(): boolean {
  return Boolean(adminPassword())
}

export function adminSessionToken(): string | null {
  const password = adminPassword()
  if (!password) return null
  return createHmac("sha256", password)
    .update("smartbridge-style-maker-admin-v1")
    .digest("hex")
}

export function verifyAdminPassword(password: string): boolean {
  const expected = adminPassword()
  if (!expected) return false
  const a = Buffer.from(password)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export function verifyAdminToken(token: string | undefined | null): boolean {
  const expected = adminSessionToken()
  if (!expected || !token) return false
  const a = Buffer.from(token)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export function readAdminTokenFromRequest(request: NextRequest): string | null {
  return request.cookies.get(ADMIN_COOKIE)?.value || null
}

export async function requireAdminSession(): Promise<
  | { ok: true }
  | { ok: false; status: number; error: string }
> {
  if (!adminPasswordConfigured()) {
    return {
      ok: false,
      status: 503,
      error: "ADMIN_PASSWORD is not configured.",
    }
  }
  const jar = await cookies()
  const token = jar.get(ADMIN_COOKIE)?.value
  if (!verifyAdminToken(token)) {
    return { ok: false, status: 401, error: "Admin login required." }
  }
  return { ok: true }
}

export function adminCookieOptions(maxAgeSeconds = 60 * 60 * 12) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeSeconds,
  }
}
