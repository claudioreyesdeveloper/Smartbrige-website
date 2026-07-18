import type { EntitlementRecord, EntitlementStatus } from "@/lib/auth/entitlement-logic"
import { isServiceKey, type ServiceKey } from "@/lib/services/catalog"

export const ACCESS_FIXTURE_COOKIE = "sb_access_fixture"
export const ACCESS_FIXTURE_ENV = "SMARTBRIDGE_ACCESS_FIXTURE"

const ALLOWED_STATUSES = new Set<EntitlementStatus>([
  "active",
  "trialing",
  "canceled",
  "expired",
])

export type AccessFixtureEntitlement = {
  serviceKey: ServiceKey
  status: EntitlementStatus
  validFrom?: string
  validUntil?: string | null
}

export type AccessFixturePayload = {
  userId: string
  email?: string | null
  entitlements?: AccessFixtureEntitlement[]
}

export type ParsedAccessFixture = {
  userId: string
  email: string | null
  records: EntitlementRecord[]
}

export function isAccessFixtureEnabled(): boolean {
  return process.env[ACCESS_FIXTURE_ENV] === "1"
}

/**
 * Parse a Playwright/test fixture cookie.
 * Only service keys + entitlement statuses are accepted; access flags are ignored
 * and recomputed server-side. Disabled unless SMARTBRIDGE_ACCESS_FIXTURE=1.
 */
export function parseAccessFixtureCookie(
  raw: string | undefined | null,
): ParsedAccessFixture | null {
  if (!isAccessFixtureEnabled() || !raw) {
    return null
  }

  let payload: unknown
  try {
    payload = JSON.parse(decodeURIComponent(raw)) as unknown
  } catch {
    return null
  }

  if (!payload || typeof payload !== "object") {
    return null
  }

  const body = payload as AccessFixturePayload
  if (typeof body.userId !== "string" || body.userId.length === 0) {
    return null
  }

  const email = typeof body.email === "string" ? body.email : null
  const records: EntitlementRecord[] = []

  if (Array.isArray(body.entitlements)) {
    for (const item of body.entitlements) {
      if (!item || typeof item !== "object") {
        continue
      }
      if (typeof item.serviceKey !== "string" || !isServiceKey(item.serviceKey)) {
        continue
      }
      if (typeof item.status !== "string" || !ALLOWED_STATUSES.has(item.status)) {
        continue
      }

      // Ignore any client-supplied access field if present — never trusted.
      const validFrom =
        typeof item.validFrom === "string"
          ? new Date(item.validFrom)
          : new Date("2020-01-01T00:00:00.000Z")
      if (Number.isNaN(validFrom.getTime())) {
        continue
      }

      let validUntil: Date | null = null
      if (item.validUntil === null || item.validUntil === undefined) {
        validUntil = null
      } else if (typeof item.validUntil === "string") {
        const parsed = new Date(item.validUntil)
        if (Number.isNaN(parsed.getTime())) {
          continue
        }
        validUntil = parsed
      } else {
        continue
      }

      records.push({
        serviceKey: item.serviceKey,
        status: item.status,
        validFrom,
        validUntil,
      })
    }
  }

  return {
    userId: body.userId,
    email,
    records,
  }
}

export function encodeAccessFixtureCookie(payload: AccessFixturePayload): string {
  return encodeURIComponent(JSON.stringify(payload))
}
