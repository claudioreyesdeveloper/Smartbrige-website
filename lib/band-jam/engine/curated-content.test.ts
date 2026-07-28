/**
 * Locks the hand-curated Rock/Funk musical intent into the generated catalogue.
 *
 * Provenance and distinct takes matter more than similarity metrics. Guitar
 * MegaVoice stroke-only clips (GuitarStroke CASM, notes above FX_PITCH_MIN)
 * are valid — Genos plays them as guitar; do not require pitched notes alone.
 */
import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

import { instrumentForRole } from "@/lib/band-jam/engine/instruments"
import {
  resolveChannelEffects,
} from "@/lib/band-jam/engine/effects-presets"
import type { BandStyle, SectionRole } from "@/lib/band-jam/engine/types"

const ROOT = process.cwd()
const catalog = JSON.parse(
  readFileSync(path.join(ROOT, "lib/band-jam/catalog.generated.json"), "utf8"),
) as { styles: Array<BandStyle & { feel?: string }> }

const GUITAR_OFF = 20_000_000
const KEYS_OFF = 10_000_000

function style(id: string): BandStyle & { feel?: string } {
  const s = catalog.styles.find((x) => x.id === id)
  if (!s) throw new Error(`missing style ${id}`)
  return s
}

describe("rock curated content", () => {
  const rock = style("rock")
  // ROLE_TO_MAIN_SECTION: verse=A, intro=B, pre_chorus=C, chorus=D, bridge=D, outro=B
  // Preference chord1 > phrase1 (80sPowerRock has no chord parts).
  const rockGuitarByVar: Array<Partial<Record<SectionRole, number>>> = [
    {
      // 70sHardRock CHD1
      verse: GUITAR_OFF + 2988,
      intro: GUITAR_OFF + 2991,
      pre_chorus: GUITAR_OFF + 2994,
      chorus: GUITAR_OFF + 2997,
      bridge: GUITAR_OFF + 2997,
      outro: GUITAR_OFF + 2991,
    },
    {
      // 80sPowerRock PHR1
      verse: GUITAR_OFF + 3123,
      intro: GUITAR_OFF + 3125,
      pre_chorus: GUITAR_OFF + 3127,
      chorus: GUITAR_OFF + 3130,
      bridge: GUITAR_OFF + 3130,
      outro: GUITAR_OFF + 3125,
    },
    {
      // PowerRock CHD1
      verse: GUITAR_OFF + 3379,
      intro: GUITAR_OFF + 3382,
      pre_chorus: GUITAR_OFF + 3385,
      chorus: GUITAR_OFF + 3388,
      bridge: GUITAR_OFF + 3388,
      outro: GUITAR_OFF + 3382,
    },
    {
      // 70sStraightRock CHD1
      verse: GUITAR_OFF + 3020,
      intro: GUITAR_OFF + 3022,
      pre_chorus: GUITAR_OFF + 3024,
      chorus: GUITAR_OFF + 3026,
      bridge: GUITAR_OFF + 3026,
      outro: GUITAR_OFF + 3022,
    },
  ]
  const bassD: Partial<Record<SectionRole, number>> = {
    intro: 233630,
    verse: 233642,
    pre_chorus: 233654,
    chorus: 233662,
    bridge: 233670,
    outro: 233630,
  }

  it("is straight feel", () => {
    expect(rock.feel).toBe("straight")
  })

  it("maps guitar A–D to the four curated Genos rock takes", () => {
    for (const [role, takes] of Object.entries(rock.parts.guitar?.variations ?? {})) {
      expect(takes.length, role).toBeGreaterThanOrEqual(4)
      expect(new Set(takes).size, role).toBe(takes.length)
      for (let i = 0; i < 4; i++) {
        expect(takes[i], `${role} var ${i}`).toBe(
          rockGuitarByVar[i][role as SectionRole],
        )
      }
    }
  })

  it("keeps curated straight e85fd6 bass as Variation D on every role", () => {
    for (const role of Object.keys(bassD) as SectionRole[]) {
      const expected = bassD[role]
      const takes = rock.parts.bass?.variations?.[role] ?? []
      expect(takes.length, role).toBeGreaterThanOrEqual(4)
      expect(takes[3], role).toBe(expected)
      expect(new Set(takes).size, role).toBe(takes.length)
    }
  })

  it("keeps drums, bass and guitar as the rock core", () => {
    expect(rock.parts.guitar).toBeDefined()
    expect(rock.parts.bass).toBeDefined()
    expect(rock.parts.drums).toBeDefined()
  })

  it("uses RockKit samples for rock drums", () => {
    expect(instrumentForRole("drums", "rock")).toBe("drums-rockkit")
  })
})

describe("swing-jazz drum kit", () => {
  it("uses BrushKit samples for jazz drums", () => {
    expect(instrumentForRole("drums", "swing-jazz")).toBe("drums-brushkit")
  })
})

describe("funk curated content", () => {
  const funk = style("funk")

  // FunkPopRock CHD1 Main A–D (style_guitar_clips ids) + GUITAR_OFF.
  // verse/intro/pre_chorus/chorus map to Main A/B/C/D; bridge/outro reuse D/B.
  const funkPopRockByRole: Partial<Record<SectionRole, number>> = {
    verse: GUITAR_OFF + 1094,
    intro: GUITAR_OFF + 1096,
    pre_chorus: GUITAR_OFF + 1098,
    chorus: GUITAR_OFF + 1101,
    bridge: GUITAR_OFF + 1101,
    outro: GUITAR_OFF + 1096,
  }
  const smokinSoulGuitarByRole: Partial<Record<SectionRole, number>> = {
    verse: GUITAR_OFF + 1731,
    intro: GUITAR_OFF + 1733,
    pre_chorus: GUITAR_OFF + 1735,
    chorus: GUITAR_OFF + 1737,
    bridge: GUITAR_OFF + 1737,
    outro: GUITAR_OFF + 1733,
  }

  it("maps guitar A to FunkPopRock CHD1 and B to Smokin'Soul CHD1", () => {
    for (const [role, takes] of Object.entries(funk.parts.guitar?.variations ?? {})) {
      expect(takes.length, role).toBeGreaterThanOrEqual(2)
      expect(new Set(takes).size, role).toBe(takes.length)
      expect(takes[0], role).toBe(funkPopRockByRole[role as SectionRole])
      expect(takes[1], role).toBe(smokinSoulGuitarByRole[role as SectionRole])
    }
  })

  it("keeps Smokin'Soul keys as Variation B", () => {
    for (const [role, takes] of Object.entries(funk.parts.keys?.variations ?? {})) {
      expect(takes.length, role).toBeGreaterThanOrEqual(2)
      expect(takes[1], role).toBeGreaterThanOrEqual(KEYS_OFF)
      expect(new Set(takes).size, role).toBe(takes.length)
    }
  })
})

describe("warm-session effect resolution", () => {
  it("gives funk and pop different guitar amps on the same instrument id", () => {
    // The bug: style change only reloaded when instrument IDs changed, so
    // funk↔pop kept the first style's amp. Resolution must differ even when
    // instrumentForRole returns the same id.
    expect(instrumentForRole("guitar", "funk")).toBe(
      instrumentForRole("guitar", "pop"),
    )
    const funkFx = resolveChannelEffects(
      "guitar",
      instrumentForRole("guitar", "funk"),
      "funk",
    )
    const popFx = resolveChannelEffects(
      "guitar",
      instrumentForRole("guitar", "pop"),
      "pop",
    )
    expect(funkFx.drive?.amp?.model).toBeTruthy()
    expect(popFx.drive?.amp?.model).toBeTruthy()
    expect(funkFx.drive).not.toEqual(popFx.drive)
  })

  it("ships every amp model named by a production rig", () => {
    const models = new Set<string>()
    for (const styleId of ["funk", "pop", "rock", "blues", "rnb"]) {
      const fx = resolveChannelEffects(
        "guitar",
        instrumentForRole("guitar", styleId),
        styleId,
      )
      if (fx.drive?.amp?.model) models.add(fx.drive.amp.model)
    }
    expect(models.size).toBeGreaterThan(0)
    for (const name of models) {
      const file = path.join(ROOT, "public/jam-player/amp", `${name}.json`)
      const raw = JSON.parse(readFileSync(file, "utf8"))
      expect(raw.model_data?.hidden_size ?? raw.state_dict).toBeTruthy()
    }
  })
})
