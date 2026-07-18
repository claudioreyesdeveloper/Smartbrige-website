import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import {
  buildAccountServiceRows,
  buildServiceEntitlements,
  type AccountServiceRow,
} from "@/lib/access/entitlement-views"
import {
  ACCESS_FIXTURE_COOKIE,
  parseAccessFixtureCookie,
  type ParsedAccessFixture,
} from "@/lib/access/fixture"
import { sanitizeAppCallbackUrl } from "@/lib/access/safe-redirect"
import { getEntitlementRecordsForUser } from "@/lib/auth/entitlements"
import type { EntitlementRecord } from "@/lib/auth/entitlement-logic"
import { getSessionUserId, auth } from "@/lib/auth"
import type { ServiceEntitlement } from "@/components/app-shell/types"

export type AppAccessContext = {
  userId: string
  email: string | null
  records: EntitlementRecord[]
  entitlements: ServiceEntitlement[]
  accountRows: AccountServiceRow[]
  source: "auth" | "fixture"
}

async function readFixtureFromCookies(): Promise<ParsedAccessFixture | null> {
  const jar = await cookies()
  return parseAccessFixtureCookie(jar.get(ACCESS_FIXTURE_COOKIE)?.value)
}

export async function resolveAppAccessContext(): Promise<AppAccessContext | null> {
  const fixture = await readFixtureFromCookies()
  if (fixture) {
    const entitlements = buildServiceEntitlements(fixture.records)
    return {
      userId: fixture.userId,
      email: fixture.email,
      records: fixture.records,
      entitlements,
      accountRows: buildAccountServiceRows(fixture.records),
      source: "fixture",
    }
  }

  const session = await auth()
  const userId = session?.user?.id
  if (!userId) {
    return null
  }

  const records = await getEntitlementRecordsForUser(userId)
  return {
    userId,
    email: session.user?.email ?? null,
    records,
    entitlements: buildServiceEntitlements(records),
    accountRows: buildAccountServiceRows(records),
    source: "auth",
  }
}

export async function requireAppAccessContext(
  callbackPath = "/app",
): Promise<AppAccessContext> {
  const context = await resolveAppAccessContext()
  if (!context) {
    const callbackUrl = sanitizeAppCallbackUrl(callbackPath)
    redirect(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`)
  }
  return context as AppAccessContext
}

/** Convenience for callers that only need the session user id after access is resolved. */
export async function requireAppUserId(callbackPath = "/app"): Promise<string> {
  const context = await requireAppAccessContext(callbackPath)
  return context.userId
}

export async function getOptionalSessionUserId(): Promise<string | null> {
  const fixture = await readFixtureFromCookies()
  if (fixture) {
    return fixture.userId
  }
  return getSessionUserId()
}
