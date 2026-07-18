import { describe, expect, it } from "vitest"
import {
  buildAccountServiceRows,
  buildServiceEntitlements,
} from "@/lib/access/entitlement-views"
import type { EntitlementRecord } from "@/lib/auth/entitlement-logic"

const NOW = new Date("2026-07-18T12:00:00.000Z")

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

describe("buildServiceEntitlements", () => {
  it("marks only active/trialing services as active", () => {
    const entitlements = buildServiceEntitlements(
      [
        record({ serviceKey: "jam-player" }),
        record({ serviceKey: "bass-drums", status: "canceled" }),
        record({ serviceKey: "genos-mixer", status: "trialing" }),
      ],
      NOW,
    )

    expect(entitlements.find((item) => item.key === "jam-player")?.access).toBe("active")
    expect(entitlements.find((item) => item.key === "genos-mixer")?.access).toBe("active")
    expect(entitlements.find((item) => item.key === "bass-drums")?.access).toBe("upgrade")
    expect(entitlements.find((item) => item.key === "lyrics")?.access).toBe("upgrade")
  })

  it("keeps style-maker coming soon even if a record exists", () => {
    const entitlements = buildServiceEntitlements(
      [record({ serviceKey: "style-maker", status: "active" })],
      NOW,
    )
    expect(entitlements.find((item) => item.key === "style-maker")?.access).toBe("coming-soon")
  })

  it("points upgrades at A08 billing checkout", () => {
    const entitlements = buildServiceEntitlements([], NOW)
    expect(entitlements.find((item) => item.key === "solo-phrases")?.upgradeHref).toBe(
      "/app/billing?service=solo-phrases",
    )
  })

  it("does not hide remaining services when one is canceled", () => {
    const entitlements = buildServiceEntitlements(
      [
        record({ serviceKey: "jam-player" }),
        record({ serviceKey: "lyrics", status: "canceled" }),
        record({ serviceKey: "genos-mixer" }),
      ],
      NOW,
    )
    const active = entitlements.filter((item) => item.access === "active").map((item) => item.key)
    expect(active).toEqual(["jam-player", "genos-mixer"])
  })
})

describe("buildAccountServiceRows", () => {
  it("surfaces independent entitlement statuses for the account page", () => {
    const rows = buildAccountServiceRows(
      [
        record({ serviceKey: "jam-player" }),
        record({ serviceKey: "bass-drums", status: "canceled" }),
        record({ serviceKey: "solo-phrases", status: "expired" }),
      ],
      NOW,
    )

    expect(rows.find((row) => row.key === "jam-player")).toMatchObject({
      access: "active",
      entitlementStatus: "active",
    })
    expect(rows.find((row) => row.key === "bass-drums")).toMatchObject({
      access: "upgrade",
      entitlementStatus: "canceled",
    })
    expect(rows.find((row) => row.key === "solo-phrases")).toMatchObject({
      access: "upgrade",
      entitlementStatus: "expired",
    })
    expect(rows.find((row) => row.key === "lyrics")).toMatchObject({
      entitlementStatus: "none",
    })
    expect(rows.find((row) => row.key === "style-maker")).toMatchObject({
      access: "coming-soon",
    })
  })
})
