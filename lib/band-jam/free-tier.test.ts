import { describe, expect, it } from "vitest"
import {
  JAM_PLAYER_FREE_STYLE_IDS,
  applyJamPlayerFreeTier,
} from "./free-tier"

describe("applyJamPlayerFreeTier", () => {
  const catalog = {
    styles: [
      { id: "funk", name: "Funk" },
      { id: "rock", name: "Rock" },
      { id: "pop", name: "Pop" },
      { id: "ballad", name: "Ballad" },
    ],
    progressions: Array.from({ length: 12 }, (_, i) => ({ id: `p${i}` })),
  }

  it("returns the full catalogue for paid users", () => {
    expect(applyJamPlayerFreeTier(catalog, true)).toEqual(catalog)
  })

  it("keeps the free style set and complete song catalogue for free users", () => {
    const limited = applyJamPlayerFreeTier(catalog, false)
    expect(limited.styles.map((s) => s.id)).toEqual(["funk", "rock", "pop", "ballad"])
    expect(limited.progressions).toEqual(catalog.progressions)
  })

  it("drops styles outside the free set", () => {
    const withExtra = {
      ...catalog,
      styles: [...catalog.styles, { id: "blues", name: "Blues" }],
    }
    const limited = applyJamPlayerFreeTier(withExtra, false)
    expect(limited.styles.map((s) => s.id)).toEqual(["funk", "rock", "pop", "ballad"])
    expect(JAM_PLAYER_FREE_STYLE_IDS).toContain("funk")
  })
})
