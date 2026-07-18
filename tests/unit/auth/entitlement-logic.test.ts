import { describe, expect, it } from "vitest"
import {
  isEntitlementCurrentlyActive,
  listActiveServiceKeys,
  userHasServiceAccess,
  type EntitlementRecord,
} from "@/lib/auth/entitlement-logic"

const NOW = new Date("2026-07-18T10:00:00.000Z")

function record(
  partial: Partial<EntitlementRecord> & Pick<EntitlementRecord, "serviceKey">,
): EntitlementRecord {
  return {
    status: "active",
    validFrom: new Date("2026-01-01T00:00:00.000Z"),
    validUntil: null,
    ...partial,
  }
}

describe("entitlement logic", () => {
  it("grants access per service independently", () => {
    const entitlements = [
      record({ serviceKey: "jam-player" }),
      record({ serviceKey: "lyrics", status: "canceled" }),
    ]

    expect(userHasServiceAccess(entitlements, "jam-player", NOW)).toBe(true)
    expect(userHasServiceAccess(entitlements, "lyrics", NOW)).toBe(false)
    expect(userHasServiceAccess(entitlements, "genos-mixer", NOW)).toBe(false)
  })

  it("honors validity windows and trialing status", () => {
    const trialing = record({
      serviceKey: "solo-phrases",
      status: "trialing",
      validUntil: new Date("2026-08-01T00:00:00.000Z"),
    })
    const expired = record({
      serviceKey: "bass-drums",
      validUntil: new Date("2026-07-01T00:00:00.000Z"),
    })

    expect(isEntitlementCurrentlyActive(trialing, NOW)).toBe(true)
    expect(isEntitlementCurrentlyActive(expired, NOW)).toBe(false)
  })

  it("lists active service keys in sorted order", () => {
    const entitlements = [
      record({ serviceKey: "genos-mixer" }),
      record({ serviceKey: "jam-player" }),
      record({ serviceKey: "lyrics", status: "expired" }),
    ]

    expect(listActiveServiceKeys(entitlements, NOW)).toEqual(["genos-mixer", "jam-player"])
  })
})
