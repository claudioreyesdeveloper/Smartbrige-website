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

import {
  instrumentForRole,
  ROCK_GUITAR_LAYERS,
} from "@/lib/band-jam/engine/instruments"
import { arrange } from "@/lib/band-jam/engine/arrange"
import {
  resolveChannelEffects,
} from "@/lib/band-jam/engine/effects-presets"
import type { BandStyle, NoteEvent, Progression, SectionRole } from "@/lib/band-jam/engine/types"

const ROOT = process.cwd()
const catalog = JSON.parse(
  readFileSync(path.join(ROOT, "lib/band-jam/catalog.generated.json"), "utf8"),
) as {
  styles: Array<BandStyle & { feel?: string }>
  progressions: Progression[]
}
const clipRecord = JSON.parse(
  readFileSync(path.join(ROOT, "lib/band-jam/clips.generated.json"), "utf8"),
) as Record<string, { events: NoteEvent[]; sourceKeyPc: number }>
const clips = new Map(
  Object.entries(clipRecord).map(([id, clip]) => [Number(id), clip]),
)

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
  const bassByVariation: Array<Partial<Record<SectionRole, number>>> = [
    { intro: 233694, verse: 233706, pre_chorus: 233646, chorus: 233614, bridge: 233618, outro: 233614 },
    { intro: 233605, verse: 233601, pre_chorus: 233609, chorus: 233598, bridge: 233594, outro: 233598 },
    { intro: 233639, verse: 233635, pre_chorus: 233623, chorus: 233667, bridge: 233659, outro: 233667 },
    { intro: 233630, verse: 233642, pre_chorus: 233654, chorus: 233662, bridge: 233670, outro: 233630 },
  ]
  const drumsByVariation: Array<Partial<Record<SectionRole, number>>> = [
    { intro: 1591, verse: 1654, pre_chorus: 1685, chorus: 1503, bridge: 1578, outro: 1711 },
    { intro: 36844, verse: 36850, pre_chorus: 36848, chorus: 36835, bridge: 37034, outro: 36835 },
    { intro: 36943, verse: 36947, pre_chorus: 36945, chorus: 37061, bridge: 37059, outro: 37061 },
    { intro: 37465, verse: 37466, pre_chorus: 37463, chorus: 37451, bridge: 37229, outro: 37450 },
  ]

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

  it("keeps four separate bass and drum families with the curated guitars", () => {
    for (let variation = 0; variation < 4; variation++) {
      for (const role of Object.keys(bassByVariation[variation]) as SectionRole[]) {
        expect(rock.parts.bass?.variations?.[role]?.[variation], `bass/${role}/${variation}`).toBe(
          bassByVariation[variation][role],
        )
        expect(rock.parts.drums?.variations?.[role]?.[variation], `drums/${role}/${variation}`).toBe(
          drumsByVariation[variation][role],
        )
      }
    }
  })

  it("keeps each Rock fill family isolated", () => {
    expect(rock.parts.drums?.fills?.variationPools?.slice(0, 4)).toEqual([
      [1442, 1447],
      [36836, 36837],
      [36931, 36932],
      [37456, 37231],
    ])
  })

  it("keeps keys out of every Rock variation", () => {
    expect(rock.disabledPartsByVariation).toEqual([
      ["keys"],
      ["keys"],
      ["keys"],
      ["keys"],
    ])
  })

  it("keeps drums, bass and guitar as the rock core", () => {
    expect(rock.parts.guitar).toBeDefined()
    expect(rock.parts.bass).toBeDefined()
    expect(rock.parts.drums).toBeDefined()
  })

  it("uses RockKit samples for rock drums", () => {
    expect(instrumentForRole("drums", "rock")).toBe("drums-rockkit")
  })

  it("double-tracks Rock guitar with separate hard-panned instruments", () => {
    expect(ROCK_GUITAR_LAYERS).toEqual([
      { id: "guitar-emily", layerId: "emily-left", pan: -0.88, trim: 0.42 },
      { id: "guitar-solid2", layerId: "solid2-right", pan: 0.88, trim: 0.42 },
    ])
  })
})

describe("swing-jazz drum kit", () => {
  it("uses BrushKit samples for jazz drums", () => {
    expect(instrumentForRole("drums", "swing-jazz")).toBe("drums-brushkit")
  })
})

describe("funk curated content", () => {
  const funk = style("funk")

  it("uses PowerKit2 for Funk and Pop, and brushes for Ballad", () => {
    expect(instrumentForRole("drums", "funk")).toBe("drums-power2")
    expect(instrumentForRole("drums", "pop")).toBe("drums-power2")
    expect(instrumentForRole("drums", "ballad")).toBe("drums-brushkit")
  })

  const guitarByVariation = [238554, 238557, 238558, 238559]
  const bassByVariation: Array<Partial<Record<SectionRole, number>>> = [
    { intro: 232579, verse: 232575, pre_chorus: 232575, chorus: 232583, bridge: 232575, outro: 232583 },
    { intro: 232590, verse: 232593, pre_chorus: 232593, chorus: 232623, bridge: 232626, outro: 232623 },
    { intro: 232927, verse: 232927, pre_chorus: 232927, chorus: 232958, bridge: 232927, outro: 232958 },
    { intro: 233306, verse: 233310, pre_chorus: 233310, chorus: 233322, bridge: 233318, outro: 233322 },
  ]
  const drumsByVariation: Array<Partial<Record<SectionRole, number>>> = [
    { intro: 55072, verse: 55077, pre_chorus: 55083, chorus: 55087, bridge: 55091, outro: 55087 },
    { intro: 1771, verse: 1780, pre_chorus: 1818, chorus: 1770, bridge: 1765, outro: 1761 },
    { intro: 55113, verse: 55113, pre_chorus: 55121, chorus: 55125, bridge: 55128, outro: 55125 },
    { intro: 55073, verse: 1779, pre_chorus: 1817, chorus: 1769, bridge: 1762, outro: 1760 },
  ]

  it("maps guitar A–D to the four selected generated performances", () => {
    for (const [role, takes] of Object.entries(funk.parts.guitar?.variations ?? {})) {
      expect(takes.length, role).toBeGreaterThanOrEqual(4)
      expect(new Set(takes).size, role).toBe(takes.length)
      expect(takes.slice(0, 4), role).toEqual(guitarByVariation)
    }
  })

  it("maps bass and drums A–D to their separate selected families", () => {
    for (let variation = 0; variation < 4; variation++) {
      for (const role of Object.keys(bassByVariation[variation]) as SectionRole[]) {
        expect(
          funk.parts.bass?.variations?.[role]?.[variation],
          `bass/${role}/${variation}`,
        ).toBe(bassByVariation[variation][role])
        expect(
          funk.parts.drums?.variations?.[role]?.[variation],
          `drums/${role}/${variation}`,
        ).toBe(drumsByVariation[variation][role])
      }
    }
  })

  it("keeps the selected fill family isolated per variation", () => {
    expect(funk.parts.drums?.fills?.variationPools?.slice(0, 4)).toEqual([
      Array.from({ length: 15 }, (_, index) => 55094 + index),
      Array.from({ length: 33 }, (_, index) => 1781 + index),
      Array.from({ length: 9 }, (_, index) => 55129 + index),
      Array.from({ length: 33 }, (_, index) => 1781 + index),
    ])
  })

  it("keeps Smokin'Soul keys as Variation B", () => {
    for (const [role, takes] of Object.entries(funk.parts.keys?.variations ?? {})) {
      expect(takes.length, role).toBeGreaterThanOrEqual(2)
      expect(takes[1], role).toBeGreaterThanOrEqual(KEYS_OFF)
      expect(new Set(takes).size, role).toBe(takes.length)
    }
  })

  it("covers both halves of every eight-bar section in every Funk variation", () => {
    for (const progression of catalog.progressions) {
      for (let variation = 0; variation < 4; variation++) {
        const result = arrange({
          style: funk,
          progression,
          keyPc: progression.keyPc,
          tempo: 110,
          clips,
          variation,
        })
        const events = result.parts.flatMap((part) => part.events)
        for (const section of result.sections) {
          const bars = section.endBar - section.startBar + 1
          if (bars < 8) continue
          const startBeat = (section.startBar - 1) * 4
          const midpoint = startBeat + Math.floor(bars / 2) * 4
          const endBeat = section.endBar * 4
          const firstHalf = events.some(
            (event) => event.beat >= startBeat && event.beat < midpoint,
          )
          const secondHalf = events.some(
            (event) => event.beat >= midpoint && event.beat < endBeat,
          )
          expect(
            !firstHalf || secondHalf,
            `${progression.id} variation ${variation} ${section.label}`,
          ).toBe(true)
        }
      }
    }
  })
})

describe("pop curated content", () => {
  const pop = style("pop")
  const bassA: Partial<Record<SectionRole, number>> = {
    intro: 232783,
    verse: 232791,
    pre_chorus: 232740,
    chorus: 232754,
    bridge: 232771,
    outro: 232754,
  }
  const drumsA: Partial<Record<SectionRole, number>> = {
    intro: 1591,
    verse: 1654,
    pre_chorus: 1685,
    chorus: 1503,
    bridge: 1578,
    outro: 1711,
  }
  const bassB: Partial<Record<SectionRole, number>> = {
    intro: 232785,
    verse: 232793,
    pre_chorus: 232742,
    chorus: 232756,
    bridge: 232773,
    outro: 232756,
  }
  const drumsB: Partial<Record<SectionRole, number>> = {
    intro: 1592,
    verse: 1656,
    pre_chorus: 1686,
    chorus: 1506,
    bridge: 1577,
    outro: 1713,
  }
  const bassC: Partial<Record<SectionRole, number>> = {
    intro: 232784,
    verse: 232792,
    pre_chorus: 232741,
    chorus: 232755,
    bridge: 232772,
    outro: 232755,
  }
  const drumsC: Partial<Record<SectionRole, number>> = {
    intro: 38317,
    verse: 38325,
    pre_chorus: 38321,
    chorus: 38307,
    bridge: 38371,
    outro: 38304,
  }
  const bassD: Partial<Record<SectionRole, number>> = {
    intro: 232255,
    verse: 232260,
    pre_chorus: 232265,
    chorus: 232275,
    bridge: 232277,
    outro: 232275,
  }
  const drumsD: Partial<Record<SectionRole, number>> = {
    intro: 1198,
    verse: 1202,
    pre_chorus: 1141,
    chorus: 1151,
    bridge: 1146,
    outro: 1194,
  }

  it("starts Variation A as a straight 110 BPM arrangement", () => {
    expect(pop.feel).toBe("straight")
    expect(pop.tempoDefault).toBe(110)
  })

  it("keeps the selected bass and drum families intact on every section", () => {
    for (const role of Object.keys(bassA) as SectionRole[]) {
      expect(pop.parts.bass?.variations?.[role]?.[0], `bass/${role}`).toBe(
        bassA[role],
      )
      expect(pop.parts.drums?.variations?.[role]?.[0], `drums/${role}`).toBe(
        drumsA[role],
      )
    }
  })

  it("uses Fills 01 and 02 only for Variation A", () => {
    expect(pop.parts.drums?.fills?.variationPools?.[0]).toEqual([1442, 1447])
  })

  it("uses Shimmer Pop Chords 3 Studio 05 throughout Variation A", () => {
    for (const role of Object.keys(bassA) as SectionRole[]) {
      expect(pop.parts.guitar?.variations?.[role]?.[0], role).toBe(238564)
    }
    expect(instrumentForRole("guitar", "pop")).toBe("guitar-steel")
  })

  it("keeps the hand-picked Pop B families together at 110 BPM", () => {
    for (const role of Object.keys(bassB) as SectionRole[]) {
      expect(pop.parts.bass?.variations?.[role]?.[1], `bass/${role}`).toBe(
        bassB[role],
      )
      expect(pop.parts.drums?.variations?.[role]?.[1], `drums/${role}`).toBe(
        drumsB[role],
      )
      expect(pop.parts.guitar?.variations?.[role]?.[1], `guitar/${role}`).toBe(
        238570,
      )
    }
    expect(pop.parts.drums?.fills?.variationPools?.[1]).toEqual([1444, 1454])
  })

  it("uses EpicEuroBallad channel 13 throughout Pop B", () => {
    const keysB: Partial<Record<SectionRole, number>> = {
      intro: 10_000_956,
      verse: 10_000_952,
      pre_chorus: 10_000_954,
      chorus: 10_000_955,
      bridge: 10_000_955,
      outro: 10_000_959,
    }
    for (const role of Object.keys(keysB) as SectionRole[]) {
      expect(pop.parts.keys?.variations?.[role]?.[1], role).toBe(keysB[role])
    }
  })

  it("keeps the automated straight Pop C families together", () => {
    const keysC: Partial<Record<SectionRole, number>> = {
      intro: KEYS_OFF + 920,
      verse: KEYS_OFF + 917,
      pre_chorus: KEYS_OFF + 918,
      chorus: KEYS_OFF + 919,
      bridge: KEYS_OFF + 919,
      outro: KEYS_OFF + 923,
    }
    for (const role of Object.keys(bassC) as SectionRole[]) {
      expect(pop.parts.bass?.variations?.[role]?.[2], `bass/${role}`).toBe(
        bassC[role],
      )
      expect(pop.parts.drums?.variations?.[role]?.[2], `drums/${role}`).toBe(
        drumsC[role],
      )
      expect(pop.parts.guitar?.variations?.[role]?.[2], `guitar/${role}`).toBe(
        238577,
      )
      expect(pop.parts.keys?.variations?.[role]?.[2], `keys/${role}`).toBe(
        keysC[role],
      )
    }
    expect(pop.parts.drums?.fills?.variationPools?.[2]).toEqual([38310, 38312])
  })

  it("keeps the automated swing Pop D families together", () => {
    const keysD: Partial<Record<SectionRole, number>> = {
      intro: KEYS_OFF + 1402,
      verse: KEYS_OFF + 1394,
      pre_chorus: KEYS_OFF + 1396,
      chorus: KEYS_OFF + 1398,
      bridge: KEYS_OFF + 1400,
      outro: KEYS_OFF + 1406,
    }
    for (const role of Object.keys(bassD) as SectionRole[]) {
      expect(pop.parts.bass?.variations?.[role]?.[3], `bass/${role}`).toBe(
        bassD[role],
      )
      expect(pop.parts.drums?.variations?.[role]?.[3], `drums/${role}`).toBe(
        drumsD[role],
      )
      expect(pop.parts.guitar?.variations?.[role]?.[3], `guitar/${role}`).toBe(
        238582,
      )
      expect(pop.parts.keys?.variations?.[role]?.[3], `keys/${role}`).toBe(
        keysD[role],
      )
    }
    expect(pop.parts.drums?.fills?.variationPools?.[3]).toEqual([1172, 1178])
  })

  it("keeps all four Pop variations distinct on every curated part", () => {
    for (const partName of ["bass", "drums", "guitar", "keys"] as const) {
      const part = pop.parts[partName]
      for (const [role, takes] of Object.entries(part?.variations ?? {})) {
        expect(takes.slice(0, 4), `${partName}/${role}`).toHaveLength(4)
        expect(new Set(takes.slice(0, 4)).size, `${partName}/${role}`).toBe(4)
      }
    }
  })

  it("silences keys only in Variation A", () => {
    expect(pop.disabledPartsByVariation).toEqual([
      ["keys"],
      null,
      null,
      null,
    ])
  })
})

describe("ballad curated content", () => {
  const ballad = style("ballad")
  const roles: SectionRole[] = [
    "intro",
    "verse",
    "pre_chorus",
    "chorus",
    "bridge",
    "outro",
  ]
  const bassByVariation: Array<Partial<Record<SectionRole, number>>> = [
    { intro: 233089, verse: 233093, pre_chorus: 233109, chorus: 233101, bridge: 233105, outro: 233101 },
    { intro: 233516, verse: 233540, pre_chorus: 233369, chorus: 233373, bridge: 233361, outro: 233373 },
    { intro: 233416, verse: 233447, pre_chorus: 233364, chorus: 233482, bridge: 233463, outro: 233482 },
    { intro: 233449, verse: 233418, pre_chorus: 233438, chorus: 233442, bridge: 233422, outro: 233442 },
  ]
  const drumsByVariation: Array<Partial<Record<SectionRole, number>>> = [
    { intro: 101365, verse: 101368, pre_chorus: 101366, chorus: 101357, bridge: 101358, outro: 101359 },
    { intro: 37078, verse: 37081, pre_chorus: 36979, chorus: 36976, bridge: 36973, outro: 36818 },
    { intro: 37170, verse: 37284, pre_chorus: 37281, chorus: 37500, bridge: 37499, outro: 37616 },
    { intro: 38204, verse: 38206, pre_chorus: 38275, chorus: 38263, bridge: 38258, outro: 38266 },
  ]
  const guitarByVariation = [238588, 238589, 238590, 238591]
  const keysByVariation: Array<Partial<Record<SectionRole, number>>> = [
    { intro: KEYS_OFF + 947, verse: KEYS_OFF + 944, pre_chorus: KEYS_OFF + 945, chorus: KEYS_OFF + 946, bridge: KEYS_OFF + 946, outro: KEYS_OFF + 950 },
    { intro: KEYS_OFF + 608, verse: KEYS_OFF + 602, pre_chorus: KEYS_OFF + 604, chorus: KEYS_OFF + 606, bridge: KEYS_OFF + 606, outro: KEYS_OFF + 614 },
    { intro: KEYS_OFF + 197, verse: KEYS_OFF + 194, pre_chorus: KEYS_OFF + 195, chorus: KEYS_OFF + 196, bridge: KEYS_OFF + 196, outro: KEYS_OFF + 200 },
    { intro: KEYS_OFF + 1083, verse: KEYS_OFF + 1078, pre_chorus: KEYS_OFF + 1079, chorus: KEYS_OFF + 1080, bridge: KEYS_OFF + 1080, outro: KEYS_OFF + 1087 },
  ]

  it("keeps all four variations straight at the Ballad tempo", () => {
    expect(ballad.feel).toBe("straight")
    expect(ballad.tempoDefault).toBe(78)
  })

  it("keeps each A–D bass, drum, guitar and keyboard family intact", () => {
    for (let variation = 0; variation < 4; variation++) {
      for (const role of roles) {
        expect(ballad.parts.bass?.variations?.[role]?.[variation], `bass/${role}/${variation}`).toBe(
          bassByVariation[variation][role],
        )
        expect(ballad.parts.drums?.variations?.[role]?.[variation], `drums/${role}/${variation}`).toBe(
          drumsByVariation[variation][role],
        )
        expect(ballad.parts.guitar?.variations?.[role]?.[variation], `guitar/${role}/${variation}`).toBe(
          guitarByVariation[variation],
        )
        expect(ballad.parts.keys?.variations?.[role]?.[variation], `keys/${role}/${variation}`).toBe(
          keysByVariation[variation][role],
        )
      }
    }
  })

  it("keeps each Ballad drum fill family isolated", () => {
    expect(ballad.parts.drums?.fills?.variationPools?.slice(0, 4)).toEqual([
      [101458, 101459],
      [37071, 37072],
      [37164, 37503],
      [38270, 38271],
    ])
  })

  it("keeps all four Ballad variations distinct on every curated part", () => {
    for (const partName of ["bass", "drums", "guitar", "keys"] as const) {
      for (const [role, takes] of Object.entries(ballad.parts[partName]?.variations ?? {})) {
        expect(takes.slice(0, 4), `${partName}/${role}`).toHaveLength(4)
        expect(new Set(takes.slice(0, 4)).size, `${partName}/${role}`).toBe(4)
      }
    }
  })
})

describe("warm-session effect resolution", () => {
  it("uses SolidGuitar2 for Funk and acoustic steel for curated Pop", () => {
    expect(instrumentForRole("guitar", "funk")).toBe("guitar-solid2")
    expect(instrumentForRole("guitar", "pop")).toBe("guitar-steel")
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
    expect(popFx.drive).toBeUndefined()
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
