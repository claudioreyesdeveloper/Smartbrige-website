import { NextResponse, type NextRequest } from "next/server"
import {
  ACCESS_FIXTURE_COOKIE,
  encodeAccessFixtureCookie,
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

  if (isAccessFixtureEnabled()) {
    // Same-URL redirect once to attach the fixture cookie. Use secure only on
    // HTTPS — Secure cookies over http://localhost / 127.0.0.1 often never stick
    // and the browser loops forever on the marketing site instead of entering /app.
    const response = NextResponse.redirect(request.nextUrl)
    response.cookies.set(
      ACCESS_FIXTURE_COOKIE,
      encodeAccessFixtureCookie({
        userId: "preview-user",
        email: "preview@thesmartbridge.io",
        entitlements: [
          { serviceKey: "jam-player", status: "active" },
          { serviceKey: "bass-drums", status: "active" },
          { serviceKey: "solo-phrases", status: "active" },
          { serviceKey: "lyrics", status: "active" },
          { serviceKey: "genos-mixer", status: "active" },
        ],
      }),
      {
        httpOnly: true,
        maxAge: 60 * 60 * 8,
        path: "/",
        sameSite: "lax",
        secure: request.nextUrl.protocol === "https:",
      },
    )
    return response
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
