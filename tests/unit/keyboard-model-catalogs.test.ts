import { describe, expect, it } from "vitest"
import { existsSync } from "fs"
import {
  encodeStyleWireBytes,
  dbModelKey,
  DB_MODEL_KEYS,
} from "@/lib/demo/yamaha/keyboard-models"
import { ALL_YAMAHA_MODEL_IDS, KEYBOARD_PROFILES } from "@/lib/demo/yamaha/profiles"
import {
  listLocalAuditionVoices,
  listLocalVoiceCategories,
  localVoicesAvailable,
} from "@/lib/style-maker/local-voices"
import {
  listLocalStyles,
  localStylesAvailable,
} from "@/lib/style-maker/local-styles"

const SNAPSHOT =
  process.env.SMARTBRIDGE_DB_PATH ||
  "/Users/claudio/Developer/Smartbridge/SmartBridge/Resources/smartbridge.db"

describe("keyboard model catalogs", () => {
  it("covers every website YamahaModelId with a DB model_key", () => {
    for (const id of ALL_YAMAHA_MODEL_IDS) {
      expect(KEYBOARD_PROFILES[id]).toBeTruthy()
      expect(dbModelKey(id)).toBeTruthy()
    }
    expect(dbModelKey("genos")).toBe("genos1")
    expect(DB_MODEL_KEYS).toContain("tyros1")
    expect(DB_MODEL_KEYS).toContain("psr_sx900")
  })

  it("encodes Genos 14-bit vs Tyros/PSR packed style numbers", () => {
    expect(encodeStyleWireBytes("genos2", 5635)).toEqual([0x2c, 0x03])
    expect(encodeStyleWireBytes("tyros5", 5602)).toEqual([0x15, 0x62])
    expect(encodeStyleWireBytes("psr_sx900", 5602)).toEqual([0x15, 0x62])
  })

  it("loads model-scoped styles and audition voices from the snapshot", () => {
    if (!existsSync(SNAPSHOT) || !localStylesAvailable() || !localVoicesAvailable()) {
      return
    }
    const genosStyles = listLocalStyles("genos2")
    const tyrosStyles = listLocalStyles("tyros5")
    expect(genosStyles.length).toBeGreaterThan(500)
    expect(tyrosStyles.length).toBeGreaterThan(400)
    expect(listLocalVoiceCategories("tyros5").length).toBeGreaterThan(5)

    const bass = listLocalAuditionVoices("genos2", "bass")
    const drums = listLocalAuditionVoices("tyros5", "drums")
    expect(bass.some((v) => v.id.includes("ElectricBass") || v.label.includes("ElectricBass"))).toBe(
      true,
    )
    expect(drums.length).toBeGreaterThan(10)
  })
})
