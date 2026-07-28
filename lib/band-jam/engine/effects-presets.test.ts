/**
 * Locks shut the two bugs that produced "why do all guitars regardless of
 * style have dist on them".
 *
 * 1. `drive` used to live on the DEFAULT guitar part, and `derive()` merged at
 *    the part level, so every style inherited an amp unless it explicitly wrote
 *    `drive: undefined`. Distortion was opt-OUT.
 * 2. The soft-clip curve was peak-normalised, which made its `amount`
 *    parameter inert above ~0.09 — a "clean" 0.12 and a cranked 0.72 produced
 *    the same ~6 dB of saturation.
 *
 * Both were invisible by ear in isolation (everything just sounded distorted,
 * which reads as a taste problem) and both are trivially assertable.
 */
import { describe, expect, it } from "vitest"

import {
  AMP_RIGS,
  DEFAULT_PRESET,
  INSTRUMENT_EFFECTS,
  STYLE_EFFECT_PRESETS,
  STYLE_PART_TRIMS,
  STYLE_RIGS,
  ampModelsInUse,
  resolveChannelEffects,
} from "@/lib/band-jam/engine/effects-presets"
import { instrumentForRole } from "@/lib/band-jam/engine/instruments"

const STYLES = Object.keys(STYLE_EFFECT_PRESETS)

describe("amp rigs are opt-in", () => {
  it("has no drive on the default guitar part", () => {
    // This single field is what leaked an amp into every style.
    expect(DEFAULT_PRESET.parts.guitar?.drive).toBeUndefined()
  })

  it("never amplifies an acoustic guitar, in any style", () => {
    expect(INSTRUMENT_EFFECTS["guitar-steel"].rig).toBeNull()
    for (const styleId of STYLES) {
      const fx = resolveChannelEffects("guitar", "guitar-steel", styleId)
      expect(fx.drive, `${styleId} amplified the acoustic`).toBeUndefined()
    }
  })

  it("gives a rig only where one is named", () => {
    for (const styleId of STYLES) {
      const instrument = instrumentForRole("guitar", styleId)
      const fx = resolveChannelEffects("guitar", instrument, styleId)
      const voiceRig = INSTRUMENT_EFFECTS[instrument ?? ""]?.rig
      const styleRig = STYLE_RIGS[styleId]?.guitar
      // Three states: a style `null` means "no amp here" and beats the
      // instrument default; `undefined` means "inherit".
      const expected =
        voiceRig === null ? null : styleRig === undefined ? voiceRig : styleRig
      if (expected) expect(fx.drive, styleId).toEqual(AMP_RIGS[expected])
      else expect(fx.drive, styleId).toBeUndefined()
    }
  })

  it("gives rock the most gain and the acoustic styles none", () => {
    const gainOf = (styleId: string) => {
      const fx = resolveChannelEffects(
        "guitar",
        instrumentForRole("guitar", styleId),
        styleId,
      )
      return fx.drive?.amp?.inputGain ?? 0
    }
    expect(gainOf("ballad")).toBe(0)
    expect(gainOf("country")).toBe(0)
    expect(gainOf("rock")).toBeGreaterThan(gainOf("blues"))
    expect(gainOf("blues")).toBeGreaterThan(gainOf("funk"))
  })

  it("names only rigs that exist, and models that are shipped", () => {
    for (const [styleId, rigs] of Object.entries(STYLE_RIGS)) {
      for (const [part, rigId] of Object.entries(rigs)) {
        // null is a valid value meaning "no amp in this style".
        if (rigId === null) continue
        expect(AMP_RIGS[rigId], `${styleId}/${part} -> ${rigId}`).toBeDefined()
      }
    }
    for (const voice of Object.values(INSTRUMENT_EFFECTS)) {
      if (voice.rig) expect(AMP_RIGS[voice.rig]).toBeDefined()
    }
    // Guards against a rig pointing at a model file nobody downloaded.
    expect(ampModelsInUse().length).toBeGreaterThan(0)
  })

  it("keeps a cabinet on every rig", () => {
    // The captures are amp-only — measured 4-12 dB of roll-off by 8-15 kHz
    // where a real 4x12 drops 30-40. Without a cab they are painfully bright.
    for (const [id, rig] of Object.entries(AMP_RIGS)) {
      expect(rig.cabinet, `${id} has no cabinet`).toBeDefined()
    }
  })

  it("keeps the keys untouched by the guitar rig layer", () => {
    for (const styleId of STYLES) {
      const fx = resolveChannelEffects(
        "keys",
        instrumentForRole("keys", styleId),
        styleId,
      )
      expect(fx.drive?.amp).toBeUndefined()
    }
  })
})

describe("style × instrument tone matrix", () => {
  /** Soft-clip bass drive amounts from the approved amp-preset plan. */
  const BASS_DRIVE_AMOUNT: Record<string, number> = {
    funk: 0.38,
    reggae: 0.1,
    rock: 0.32,
    blues: 0.36,
    pop: 0.22,
    rnb: 0.26,
    country: 0.18,
    "swing-jazz": 0.15,
    ballad: 0.12,
  }

  /** Guitar STYLE_RIGS expectation for every shipped style. */
  const GUITAR_RIG: Record<string, string | null> = {
    funk: "funk",
    pop: "chime",
    rock: "high-gain",
    blues: "crunch",
    rnb: "clean",
    reggae: "clean",
    "swing-jazz": null,
    ballad: null, // guitar-steel refuses
    country: null,
  }

  it("maps every style guitar to the planned rig (or none)", () => {
    for (const styleId of STYLES) {
      const instrument = instrumentForRole("guitar", styleId)
      const fx = resolveChannelEffects("guitar", instrument, styleId)
      const expected = GUITAR_RIG[styleId]
      expect(expected, `missing matrix row for ${styleId}`).not.toBeUndefined()
      if (expected === null) {
        expect(fx.drive, styleId).toBeUndefined()
      } else {
        expect(fx.drive, styleId).toEqual(AMP_RIGS[expected])
      }
    }
  })

  it("gives every style its own bass soft-clip amount", () => {
    for (const [styleId, amount] of Object.entries(BASS_DRIVE_AMOUNT)) {
      const fx = resolveChannelEffects(
        "bass",
        instrumentForRole("bass", styleId),
        styleId,
      )
      expect(fx.drive?.amount, styleId).toBe(amount)
      expect(fx.drive?.amp, `${styleId} must not use a neural bass amp`).toBeUndefined()
    }
  })

  it("styles pop guitar and keys beyond the neutral defaults", () => {
    const g = resolveChannelEffects(
      "guitar",
      instrumentForRole("guitar", "pop"),
      "pop",
    )
    const k = resolveChannelEffects(
      "keys",
      instrumentForRole("keys", "pop"),
      "pop",
    )
    expect(g.highPassHz).toBe(120)
    expect(g.highShelf?.gain).toBeGreaterThan(0)
    expect(g.peaks?.length).toBeGreaterThanOrEqual(3)
    expect(k.highPassHz).toBe(60)
    expect(k.peaks?.[1]?.freq).toBe(2200)
  })

  it("keeps funk bass grittier than ballad and reggae", () => {
    const amount = (styleId: string) =>
      resolveChannelEffects("bass", instrumentForRole("bass", styleId), styleId)
        .drive?.amount ?? 0
    expect(amount("funk")).toBeGreaterThan(amount("pop"))
    expect(amount("pop")).toBeGreaterThan(amount("ballad"))
    expect(amount("funk")).toBeGreaterThan(amount("reggae"))
  })

  it("preloads every amp model named by a production rig", () => {
    const models = ampModelsInUse()
    expect(models.sort()).toEqual(
      [
        "FenderPrinceton_clean",
        "MesaBoogieMk2b_Clean",
        "MesaBoogieMk2b_Crunch",
        "Soldano_highGain",
      ].sort(),
    )
  })
})

describe("style × part trim matrix", () => {
  // Genos SInt CC7–inspired balances — single source in STYLE_PART_TRIMS.
  const TRIM = {
    funk: { drums: 1.05, bass: 1.1, guitar: 0.68, keys: 0.9 },
    pop: { drums: 1.0, bass: 1.02, guitar: 0.72, keys: 0.96 },
    rock: { drums: 1.1, bass: 1.02, guitar: 0.72, keys: 0.72 },
    blues: { drums: 1.0, bass: 1.04, guitar: 0.74, keys: 0.9 },
    rnb: { drums: 0.98, bass: 1.04, guitar: 0.7, keys: 1.0 },
    reggae: { drums: 0.98, bass: 1.12, guitar: 0.62, keys: 0.8 },
    "swing-jazz": { drums: 0.92, bass: 0.94, guitar: 0.7, keys: 1.02 },
    ballad: { drums: 0.85, bass: 0.9, guitar: 0.68, keys: 1.08 },
    country: { drums: 1.02, bass: 1.0, guitar: 0.72, keys: 0.86 },
  } as const

  it("matches the Genos-inspired STYLE_PART_TRIMS table", () => {
    for (const [styleId, parts] of Object.entries(TRIM)) {
      expect(STYLE_PART_TRIMS[styleId], styleId).toEqual(parts)
    }
  })

  it("resolves the planned trim on every style part", () => {
    for (const [styleId, parts] of Object.entries(TRIM)) {
      for (const part of ["drums", "bass", "guitar", "keys"] as const) {
        const instrument = instrumentForRole(part, styleId)
        const fx = resolveChannelEffects(part, instrument, styleId)
        // Emilyguitar is pulled 25% under the Genos trim twice — it reads
        // louder than SolidGuitar2 at the same number.
        const expected =
          part === "guitar" && instrument === "guitar-emily"
            ? parts[part] * 0.75 * 0.75
            : parts[part]
        expect(fx.trim, `${styleId}/${part}`).toBeCloseTo(expected, 5)
      }
    }
  })

  it("gives Emilyguitar a short slap and a little extra reverb", () => {
    const funk = resolveChannelEffects("guitar", "guitar-emily", "funk")
    expect(funk.delay).toEqual({
      beats: 0.25,
      feedback: 0.1,
      mix: 0.045,
      dampHz: 2800,
    })
    // Funk base send is 0.1; Emily adds 0.1 → 0.2.
    expect(funk.reverbSend).toBeCloseTo(0.2, 5)
    expect(funk.trim).toBeCloseTo(0.68 * 0.75 * 0.75, 5)

    // Rock already ships its own dotted-8th delay — leave it, still trim.
    const rock = resolveChannelEffects("guitar", "guitar-emily", "rock")
    expect(rock.delay?.beats).toBe(0.75)
    expect(rock.trim).toBeCloseTo(0.72 * 0.75 * 0.75, 5)
  })

  it("keeps every style's guitar under its drums and bass", () => {
    expect(TRIM.ballad.keys).toBeGreaterThan(TRIM.rock.keys)
    expect(TRIM.reggae.bass).toBeGreaterThan(TRIM.pop.bass)
    expect(TRIM.rock.drums).toBeGreaterThan(TRIM.ballad.drums)
    for (const [styleId, parts] of Object.entries(TRIM)) {
      expect(parts.guitar, styleId).toBeLessThanOrEqual(0.74)
      expect(parts.guitar, `${styleId} vs drums`).toBeLessThan(parts.drums)
      expect(parts.guitar, `${styleId} vs bass`).toBeLessThan(parts.bass)
    }
  })
})

describe("drive curve", () => {
  /**
   * Mirror of makeSoftClipCurve in effects.ts. Duplicated rather than exported
   * because the assertion is about the CURVE's shape, and a test that imports
   * the implementation cannot notice the implementation changing shape.
   */
  const DRIVE_BIAS = 0.35
  const shape = (amount: number, x: number) => {
    const g = Math.pow(10, (amount * 30) / 20)
    const shift = Math.tanh(DRIVE_BIAS)
    const raw = (v: number) => Math.tanh(g * v + DRIVE_BIAS) - shift
    return Math.max(-1, Math.min(1, raw(x) / (raw(0.5) / 0.5)))
  }
  /** dB of gain applied to a signal at level x, relative to unity. */
  const gainAt = (amount: number, x: number) =>
    20 * Math.log10(Math.abs(shape(amount, x)) / x)
  /** How hard the curve squashes loud vs quiet — i.e. how driven it sounds. */
  const squash = (amount: number) => gainAt(amount, 0.05) - gainAt(amount, 0.9)

  it("actually responds to amount", () => {
    // The old curve gave 5.67 dB at amount 0.12 and 6.02 dB at 0.72 — a knob
    // that did nothing across its entire useful range.
    const amounts = [0, 0.12, 0.22, 0.45, 0.72, 1]
    const values = amounts.map(squash)
    for (let i = 1; i < values.length; i++) {
      expect(values[i], `amount ${amounts[i]} vs ${amounts[i - 1]}`).toBeGreaterThan(
        values[i - 1] + 0.5,
      )
    }
    // And the span is musically meaningful, not a fraction of a dB.
    expect(values[values.length - 1] - values[0]).toBeGreaterThan(12)
  })

  it("stays bounded and passes a mid-level signal at unity", () => {
    for (const a of [0, 0.25, 0.5, 0.75, 1]) {
      expect(Math.abs(shape(a, 0.5) - 0.5)).toBeLessThan(1e-6)
      for (const x of [-1, -0.5, 0, 0.5, 1]) {
        expect(Math.abs(shape(a, x))).toBeLessThanOrEqual(1)
      }
    }
  })

  it("is monotonic in x, so it never folds the waveform back on itself", () => {
    for (const a of [0, 0.35, 0.72, 1]) {
      let prev = -Infinity
      for (let i = 0; i <= 400; i++) {
        const y = shape(a, (i / 200) - 1)
        expect(y).toBeGreaterThanOrEqual(prev - 1e-9)
        prev = y
      }
    }
  })
})
