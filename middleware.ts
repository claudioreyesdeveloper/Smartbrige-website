import { NextResponse } from "next/server"
import type { NextFetchEvent, NextRequest } from "next/server"

const clerkConfigured = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY,
)

export default async function middleware(
  request: NextRequest,
  event: NextFetchEvent,
) {
  // Local/dev without Clerk keys: allow all routes so `next dev` works offline.
  if (!clerkConfigured) {
    return NextResponse.next()
  }

  const { clerkMiddleware, createRouteMatcher } = await import("@clerk/nextjs/server")
  // Protect the app UI only. Style Maker APIs return JSON 401 themselves —
  // auth.protect() on /api/* redirects to HTML sign-in and breaks fetch().json().
  const isProtectedApp = createRouteMatcher(["/style-maker/app(.*)"])

  return clerkMiddleware(
    async (auth, req) => {
      if (isProtectedApp(req)) await auth.protect()
    },
    {
      // Production only: reject sessions from unexpected origins.
      ...(process.env.NODE_ENV === "production"
        ? { authorizedParties: ["https://thesmartbridge.io"] }
        : {}),
    },
  )(request, event)
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
}
