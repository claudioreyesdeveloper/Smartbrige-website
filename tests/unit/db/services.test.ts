import { describe, expect, it } from "vitest"
import { buildServiceCatalogSeedRows } from "@/lib/db/seed-services"
import { SERVICE_CATALOG, SERVICE_KEYS, getServiceCatalogEntry, isServiceKey } from "@/lib/db/services"

describe("service catalog", () => {
  it("includes every required independent service key once", () => {
    expect(SERVICE_KEYS).toHaveLength(6)
    expect(new Set(SERVICE_KEYS).size).toBe(6)
  })

  it("marks style-maker as future availability", () => {
    expect(getServiceCatalogEntry("style-maker").availability).toBe("future")
  })

  it("builds deterministic seed rows aligned with the catalog", () => {
    const rows = buildServiceCatalogSeedRows()
    expect(rows.map((row) => row.key)).toEqual(SERVICE_CATALOG.map((entry) => entry.key))
    expect(rows.every((row) => row.name.length > 0)).toBe(true)
  })

  it("validates service keys at runtime boundaries", () => {
    expect(isServiceKey("jam-player")).toBe(true)
    expect(isServiceKey("global-paid")).toBe(false)
  })
})
