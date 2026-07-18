import { describe, expect, it } from "vitest"
import { denyAllEntitlementProvider } from "@/components/app-shell/deny-entitlement-provider"
import { mockEntitlementProvider } from "@/components/app-shell/mock-entitlement-provider"
import { SERVICE_CATALOG, SERVICE_NAV_ORDER } from "@/components/app-shell/service-catalog"
import { SERVICE_KEYS, partitionEntitlements } from "@/components/app-shell/types"

describe("app-shell entitlements", () => {
  it("catalog defines all required service keys", () => {
    for (const key of SERVICE_KEYS) {
      expect(SERVICE_CATALOG[key]).toBeDefined()
      expect(SERVICE_CATALOG[key].key).toBe(key)
      expect(SERVICE_CATALOG[key].path.startsWith("/app/")).toBe(true)
    }
  })

  it("defaults to fail-closed access without an injected provider", () => {
    expect(denyAllEntitlementProvider.getEntitlements()).toEqual([])
    for (const key of SERVICE_KEYS) {
      expect(denyAllEntitlementProvider.isActive(key)).toBe(false)
    }
  })

  it("mock provider marks purchased services as active", () => {
    expect(mockEntitlementProvider.isActive("jam-player")).toBe(true)
    expect(mockEntitlementProvider.isActive("genos-mixer")).toBe(true)
  })

  it("mock provider marks unpurchased services as upgrade", () => {
    const entitlements = mockEntitlementProvider.getEntitlements()
    const bass = entitlements.find((item) => item.key === "bass-drums")
    const solo = entitlements.find((item) => item.key === "solo-phrases")
    const lyrics = entitlements.find((item) => item.key === "lyrics")

    expect(bass?.access).toBe("upgrade")
    expect(solo?.access).toBe("upgrade")
    expect(lyrics?.access).toBe("upgrade")
    expect(bass?.upgradeHref).toBe("/app/billing?service=bass-drums")
  })

  it("style-maker is coming soon and not active", () => {
    const styleMaker = mockEntitlementProvider
      .getEntitlements()
      .find((item) => item.key === "style-maker")

    expect(styleMaker?.access).toBe("coming-soon")
    expect(mockEntitlementProvider.isActive("style-maker")).toBe(false)
  })

  it("partitions entitlements into active, upgrade, and coming soon groups", () => {
    const entitlements = mockEntitlementProvider.getEntitlements()
    const grouped = partitionEntitlements(entitlements)

    expect(grouped.active.map((item) => item.key)).toEqual(["jam-player", "genos-mixer"])
    expect(grouped.upgrade.map((item) => item.key)).toEqual([
      "bass-drums",
      "solo-phrases",
      "lyrics",
    ])
    expect(grouped.comingSoon.map((item) => item.key)).toEqual(["style-maker"])
  })

  it("navigation order includes every catalog service once", () => {
    expect(SERVICE_NAV_ORDER).toHaveLength(SERVICE_KEYS.length)
    expect(new Set(SERVICE_NAV_ORDER)).toEqual(new Set(SERVICE_KEYS))
  })
})
