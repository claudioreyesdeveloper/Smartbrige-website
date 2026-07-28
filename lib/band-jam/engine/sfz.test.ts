import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import path from "node:path"
import { buildRegionIndex, parseSfz, playbackRateFor, regionGain, selectRegion } from "./sfz"

// Real converted SFZ files (ground truth for the format). See
// docs/jam-player-voice-engine.md §3.1-3.3.
const PROTOTYPE_DIR = "/Users/claudio/Developer/Smartbridge/prototype/converted"

function loadSfz(filename: string) {
  return readFileSync(path.join(PROTOTYPE_DIR, filename), "utf-8")
}

const GUITAR_FILE = "077_SolidGuitar1 MegaVoice.sfz"
const BASS_FILE = "024_ElectricBass MegaVoice.sfz"
const DRUMS_FILE = "014_StandardKit1_gm.sfz"

describe("parseSfz — SolidGuitar1 MegaVoice", () => {
  const text = loadSfz(GUITAR_FILE)
  const instrument = parseSfz(text, "/samples/077_SolidGuitar1", "guitar-solid1", "Solid Guitar 1")

  it("parses the real region count (verified via grep -c '^<region>')", () => {
    expect(instrument.regions).toHaveLength(112)
  })

  it("carries id/label/sampleBaseUrl through untouched", () => {
    expect(instrument.id).toBe("guitar-solid1")
    expect(instrument.label).toBe("Solid Guitar 1")
    expect(instrument.sampleBaseUrl).toBe("/samples/077_SolidGuitar1")
  })

  it("preserves sample paths containing spaces intact", () => {
    const region = instrument.regions.find((r) => r.pitchKeycenter === 36 && r.hiVel === 20)
    expect(region?.sample).toBe(
      "077_SolidGuitar1 MegaVoice Samples/077_SolidGuitar1 MegaVoice-36-20.wav",
    )
  })

  it("has no sample path corrupted by a naive space split (all end in .wav, none truncated)", () => {
    for (const region of instrument.regions) {
      expect(region.sample.endsWith(".wav")).toBe(true)
      expect(region.sample).toContain("MegaVoice Samples/")
    }
  })

  it("resolves key=N shorthand for the top FX zone (keys 96-127, one region each)", () => {
    const region = instrument.regions.find((r) => r.sample.includes("-96-127.wav"))
    expect(region).toBeDefined()
    expect(region?.loKey).toBe(96)
    expect(region?.hiKey).toBe(96)
    expect(region?.pitchKeycenter).toBe(96)
    // no lovel/hivel opcode on this region -> full range defaults
    expect(region?.loVel).toBe(1)
    expect(region?.hiVel).toBe(127)
  })

  it("has 10 pitched key zones of 8 velocity layers plus 32 single-key FX regions (96-127)", () => {
    const zones = new Map<string, Set<number>>()
    for (const region of instrument.regions) {
      const key = `${region.loKey}-${region.hiKey}`
      if (!zones.has(key)) zones.set(key, new Set())
      zones.get(key)!.add(region.hiVel)
    }
    const pitchedZones = [...zones.entries()].filter(([k]) => !k.includes("-") || k.split("-")[0] !== k.split("-")[1])
    // 10 pitched zones (lokey !== hikey), each with 8 distinct hivel layers
    expect(pitchedZones).toHaveLength(10)
    for (const [, hivels] of pitchedZones) {
      expect(hivels.size).toBe(8)
    }
    // 32 single-key FX regions (96..127 inclusive)
    const singleKeyZones = [...zones.keys()].filter((k) => {
      const [lo, hi] = k.split("-")
      return lo === hi
    })
    expect(singleKeyZones).toHaveLength(32)
  })

  it("parses offset/end/volume/amp_veltrack/loop_mode/ampeg for a representative region", () => {
    const region = instrument.regions.find((r) => r.sample.includes("-36-20.wav"))
    expect(region).toBeDefined()
    expect(region?.offset).toBe(724)
    expect(region?.end).toBe(976128)
    expect(region?.volume).toBeCloseTo(-8.03)
    expect(region?.ampVeltrack).toBeCloseTo(16.67)
    expect(region?.loop).toBe(false)
    // ampeg_release/ampeg_sustain come from <global> and are inherited
    expect(region?.ampegRelease).toBeCloseTo(0.015589269638061523)
    expect(region?.ampegSustain).toBeCloseTo(100)
  })

  it("selectRegion picks a different region (different articulation) for the same note at velocity 20 vs 75", () => {
    const index = buildRegionIndex(instrument)
    const low = selectRegion(index, 60, 20)
    const high = selectRegion(index, 60, 75)
    expect(low).not.toBeNull()
    expect(high).not.toBeNull()
    expect(low!.sample).not.toBe(high!.sample)
    expect(low!.sample).toContain("-60-20.wav")
    expect(high!.sample).toContain("-60-75.wav")
  })

  it("selectRegion matches velocity bands exactly, never interpolating between layers", () => {
    const index = buildRegionIndex(instrument)
    // velocity 41 falls in the 41-60 layer for key 60, not 21-40 or 61-75
    const region = selectRegion(index, 60, 41)
    expect(region?.sample).toContain("-60-60.wav")
  })

  it("selectRegion above the mapped range (>127) returns null, never throws", () => {
    const index = buildRegionIndex(instrument)
    expect(() => selectRegion(index, 200, 64)).not.toThrow()
    expect(selectRegion(index, 200, 64)).toBeNull()
  })

  it("selectRegion for a high FX note (>95) returns the single top-zone region, never throws", () => {
    const index = buildRegionIndex(instrument)
    expect(() => selectRegion(index, 100, 64)).not.toThrow()
    const region = selectRegion(index, 100, 64)
    expect(region).not.toBeNull()
    expect(region?.loKey).toBe(100)
    expect(region?.hiKey).toBe(100)
  })

  it("selectRegion never throws across the full MIDI note range at varied velocities", () => {
    const index = buildRegionIndex(instrument)
    for (let note = 0; note <= 127; note++) {
      for (const vel of [1, 20, 41, 75, 90, 127]) {
        expect(() => selectRegion(index, note, vel)).not.toThrow()
      }
    }
  })
})

describe("parseSfz — ElectricBass MegaVoice", () => {
  const text = loadSfz(BASS_FILE)
  const instrument = parseSfz(text, "/samples/024_ElectricBass", "bass-electric", "Electric Bass")

  it("parses the real region count (verified via grep -c '^<region>')", () => {
    expect(instrument.regions).toHaveLength(44)
  })

  it("has 9 pitched key zones of 4 velocity layers plus 8 single-key FX regions (120-127)", () => {
    const zones = new Map<string, Set<number>>()
    for (const region of instrument.regions) {
      const key = `${region.loKey}-${region.hiKey}`
      if (!zones.has(key)) zones.set(key, new Set())
      zones.get(key)!.add(region.hiVel)
    }
    const pitchedZones = [...zones.entries()].filter(([k]) => k.split("-")[0] !== k.split("-")[1])
    expect(pitchedZones).toHaveLength(9)
    for (const [, hivels] of pitchedZones) {
      expect(hivels.size).toBe(4)
    }
    const singleKeyZones = [...zones.keys()].filter((k) => k.split("-")[0] === k.split("-")[1])
    expect(singleKeyZones).toHaveLength(8)
  })

  it("inherits global transpose=24 on every region", () => {
    for (const region of instrument.regions) {
      expect(region.transpose).toBe(24)
    }
  })

  it("preserves sample paths containing spaces intact", () => {
    const region = instrument.regions.find((r) => r.sample.includes("-48-60.wav"))
    expect(region?.sample).toBe(
      "024_ElectricBass MegaVoice Samples/024_ElectricBass MegaVoice-48-60.wav",
    )
  })

  it("selectRegion returns different regions for the same note at low vs high velocity", () => {
    const index = buildRegionIndex(instrument)
    const low = selectRegion(index, 48, 10)
    const high = selectRegion(index, 48, 61)
    expect(low).not.toBeNull()
    expect(high).not.toBeNull()
    expect(low!.sample).not.toBe(high!.sample)
  })
})

describe("parseSfz — StandardKit1 GM drums", () => {
  const text = loadSfz(DRUMS_FILE)
  const instrument = parseSfz(text, "/samples/014_StandardKit1", "drums-standard1", "Standard Kit 1")

  it("parses the real region count (verified via grep -c '^<region>')", () => {
    // 60. The map is now a uniform +12 offset: the Kontakt PSR-S900 kit IS
    // GM-aligned (its MIDI monitor receives C1(36) Kick, D1(38) Snare), and
    // ConvertWithMoss simply named the auto-sampled files an octave up. One
    // offset replaces the hand-built table, which is why the whole GM
    // percussion range -- congas, timbales, agogo, claves -- is now mapped
    // rather than just the 23 notes that had been identified individually.
    // 89, not 60: the build now emits EVERY source velocity layer instead of
    // collapsing each GM note to one sample. 19 notes are multi-layer -- the
    // snare has four (hivel 44/59/79/127) -- which is what stops every hit
    // firing the identical file.
    expect(instrument.regions).toHaveLength(89)
  })

  it("resolves key=N shorthand (drums have no lokey/hikey/pitch_keycenter opcodes)", () => {
    const region = instrument.regions.find((r) => r.sample.includes("StandardKit1-48-127.wav"))
    expect(region).toBeDefined()
    expect(region?.loKey).toBe(36)
    expect(region?.hiKey).toBe(36)
    expect(region?.pitchKeycenter).toBe(36)
  })

  it("tiles velocity 1-127 with no gaps on every note", () => {
    // A gap would mean a velocity that triggers nothing -- a silently dropped
    // drum hit. Single-layer notes still span the full range.
    const byKey = new Map<number, { lo: number; hi: number }[]>()
    for (const region of instrument.regions) {
      expect(region.loop).toBe(false)
      const list = byKey.get(region.loKey) ?? []
      list.push({ lo: region.loVel, hi: region.hiVel })
      byKey.set(region.loKey, list)
    }
    for (const [key, layers] of byKey) {
      layers.sort((a, b) => a.lo - b.lo)
      expect(layers[0].lo, `key ${key} must start at velocity 1`).toBe(1)
      expect(layers[layers.length - 1].hi, `key ${key} must reach 127`).toBe(127)
      for (let i = 1; i < layers.length; i++) {
        expect(layers[i].lo, `key ${key} has a velocity gap`).toBe(
          layers[i - 1].hi + 1,
        )
      }
    }
  })

  it("gives the snare four distinct velocity layers", () => {
    // GM 38 is the most exposed voice in the kit; one sample for every hit is
    // the machine-gun effect the user reported.
    const snare = instrument.regions
      .filter((r) => r.loKey === 38)
      .sort((a, b) => a.loVel - b.loVel)
    expect(snare).toHaveLength(4)
    expect(new Set(snare.map((r) => r.sample)).size).toBe(4)
    expect(snare.map((r) => r.hiVel)).toEqual([44, 59, 79, 127])
  })

  it("preserves sample paths containing spaces intact", () => {
    const region = instrument.regions.find((r) => r.loKey === 35)
    // GM 35 (Kick Tight) sources from key 47 = 35 + 12 (uniform octave offset;
    // the Kontakt kit is GM-aligned, ConvertWithMoss named the files an octave
    // up). It now has four velocity layers, so assert the SOFTEST one -- the
    // build no longer collapses a key to a single mid-velocity sample.
    const softest = instrument.regions
      .filter((r) => r.loKey === 35)
      .sort((a, b) => a.loVel - b.loVel)[0]
    expect(softest.sample).toBe("014_StandardKit1 Samples/StandardKit1-47-75.wav")
  })

  it("never throws across the full MIDI note range", () => {
    const index = buildRegionIndex(instrument)
    for (let note = 0; note <= 127; note++) {
      expect(() => selectRegion(index, note, 100)).not.toThrow()
    }
  })
})

describe("regionGain", () => {
  it("applies volume(dB) with no velocity effect when ampVeltrack=0", () => {
    const region = {
      sample: "x.wav",
      loKey: 60,
      hiKey: 60,
      pitchKeycenter: 60,
      loVel: 1,
      hiVel: 127,
      offset: 0,
      end: -1,
      loop: false,
      volume: 0,
      ampVeltrack: 0,
      ampegRelease: 0,
      ampegSustain: 100,
      transpose: 0,
    }
    expect(regionGain(region, 1)).toBeCloseTo(1)
    expect(regionGain(region, 127)).toBeCloseTo(1)
  })

  it("applies quadratic velocity tracking when ampVeltrack=100", () => {
    const region = {
      sample: "x.wav",
      loKey: 60,
      hiKey: 60,
      pitchKeycenter: 60,
      loVel: 1,
      hiVel: 127,
      offset: 0,
      end: -1,
      loop: false,
      volume: 0,
      ampVeltrack: 100,
      ampegRelease: 0,
      ampegSustain: 100,
      transpose: 0,
    }
    expect(regionGain(region, 127)).toBeCloseTo(1)
    expect(regionGain(region, 0)).toBeCloseTo(0)
    // halfway velocity should give a quarter gain (velNorm^2)
    const half = 127 / 2
    expect(regionGain(region, half)).toBeCloseTo((half / 127) ** 2)
  })

  it("applies dB volume boost/cut", () => {
    const region = {
      sample: "x.wav",
      loKey: 60,
      hiKey: 60,
      pitchKeycenter: 60,
      loVel: 1,
      hiVel: 127,
      offset: 0,
      end: -1,
      loop: false,
      volume: -6,
      ampVeltrack: 0,
      ampegRelease: 0,
      ampegSustain: 100,
      transpose: 0,
    }
    expect(regionGain(region, 100)).toBeCloseTo(Math.pow(10, -6 / 20))
  })
})

describe("playbackRateFor", () => {
  it("returns 1.0 at the pitch keycenter with no transpose", () => {
    const region = {
      sample: "x.wav",
      loKey: 60,
      hiKey: 60,
      pitchKeycenter: 60,
      loVel: 1,
      hiVel: 127,
      offset: 0,
      end: -1,
      loop: false,
      volume: 0,
      ampVeltrack: 100,
      ampegRelease: 0,
      ampegSustain: 100,
      transpose: 0,
    }
    expect(playbackRateFor(region, 60)).toBeCloseTo(1)
  })

  it("shifts up an octave for +12 semitones", () => {
    const region = {
      sample: "x.wav",
      loKey: 60,
      hiKey: 60,
      pitchKeycenter: 60,
      loVel: 1,
      hiVel: 127,
      offset: 0,
      end: -1,
      loop: false,
      volume: 0,
      ampVeltrack: 100,
      ampegRelease: 0,
      ampegSustain: 100,
      transpose: 0,
    }
    expect(playbackRateFor(region, 72)).toBeCloseTo(2)
  })

  it("folds in a fixed transpose opcode (e.g. bass's global transpose=24)", () => {
    const region = {
      sample: "x.wav",
      loKey: 48,
      hiKey: 48,
      pitchKeycenter: 48,
      loVel: 1,
      hiVel: 127,
      offset: 0,
      end: -1,
      loop: false,
      volume: 0,
      ampVeltrack: 100,
      ampegRelease: 0,
      ampegSustain: 100,
      transpose: 24,
    }
    // playing exactly at pitchKeycenter but transpose=24 shifts rate by 2 octaves
    expect(playbackRateFor(region, 48)).toBeCloseTo(4)
  })
})
