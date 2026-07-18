import { NextResponse, type NextRequest } from "next/server"
import {
  ACCESS_FIXTURE_COOKIE,
  isAccessFixtureEnabled,
  parseAccessFixtureCookie,
} from "@/lib/access/fixture"
import { sanitizeAppCallbackUrl } from "@/lib/access/safe-redirect"

/**
 * Coarse /app gate only. Real Auth.js session + entitlement checks happen in
 * server components (lib/access/session). Middleware must not be the sole guard.
 */
const SESSION_COOKIE_NAMES = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
  "next-auth.session-token",
  "__Secure-next-auth.session-token",
] as const

function hasAuthSessionCookie(request: NextRequest): boolean {
  return SESSION_COOKIE_NAMES.some((name) => request.cookies.has(name))
}

function hasValidAccessFixture(request: NextRequest): boolean {
  if (!isAccessFixtureEnabled()) {
    return false
  }
  return Boolean(parseAccessFixtureCookie(request.cookies.get(ACCESS_FIXTURE_COOKIE)?.value))
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl

  if (hasValidAccessFixture(request) || hasAuthSessionCookie(request)) {
    return NextResponse.next()
  }

  const loginUrl = request.nextUrl.clone()
  loginUrl.pathname = "/login"
  loginUrl.search = ""
  loginUrl.searchParams.set(
    "callbackUrl",
    sanitizeAppCallbackUrl(`${pathname}${search}`),
  )
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: ["/app", "/app/:path*"],
}
