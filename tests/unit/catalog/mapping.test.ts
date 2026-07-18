import { describe, expect, it } from "vitest"
import {
  CATALOG_ENABLED_SERVICES,
  SECTION_TO_SERVICE,
  assertCatalogServiceAvailable,
} from "@/lib/catalog/mapping"
import { CATALOG_SECTION_ORDER } from "@/lib/catalog/constants"

describe("catalog service mapping", () => {
  it("maps every A06 section to an enabled service", () => {
    for (const section of CATALOG_SECTION_ORDER) {
      expect(CATALOG_ENABLED_SERVICES).toContain(SECTION_TO_SERVICE[section])
    }
  })

  it("maps bass/drums, solo, lyrics, and jam surfaces", () => {
    expect(SECTION_TO_SERVICE.midi_clips).toBe("bass-drums")
    expect(SECTION_TO_SERVICE.solo_phrases).toBe("solo-phrases")
    expect(SECTION_TO_SERVICE.vocal_phrases).toBe("lyrics")
    expect(SECTION_TO_SERVICE.cmudict).toBe("lyrics")
    expect(SECTION_TO_SERVICE.factory_songs).toBe("jam-player")
    expect(SECTION_TO_SERVICE.keyboard_catalog).toBe("jam-player")
  })

  it("fails closed for future style-maker and unmapped genos-mixer", () => {
    expect(() => assertCatalogServiceAvailable("style-maker")).toThrow(/not available/)
    expect(() => assertCatalogServiceAvailable("genos-mixer")).toThrow(/No factory catalog is mapped/)
  })
})
