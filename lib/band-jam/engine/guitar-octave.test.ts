/**
 * The guitar octave shift must apply only where named (rock, R&B).
 *
 * It was written as a bare global constant and applied to every style, which
 * dropped all eight non-rock guitars an octave below where they belong. Third
 * bug of that exact shape in this feature — a per-style decision implemented
 * as a global default — so it gets a test that walks every style rather than
 * one that checks the happy path.
 *
 * The assertion runs against the real catalogue and the real clips, comparing
 * arranged output to source register, because that is the only thing that
 * would actually have caught it. A unit test of the shift function alone would
 * have passed the whole time.
 */
import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

import {
  GUITAR_LOW_E,
  GUITAR_NOISE_KEY_MIN,
  GUITAR_OCTAVE_SHIFT_BY_STYLE,
  GUITAR_VOICING_BY_STYLE,
  arrange,
  guitarOctaveShift,
  guitarVoicing,
} from "@/lib/band-jam/engine/arrange"
import { FX_PITCH_MIN } from "@/lib/band-jam/engine/types"
import type {
  BandStyle,
  NoteEvent,
  Progression,
} from "@/lib/band-jam/engine/types"

const ROOT = process.cwd()
const catalog = JSON.parse(
  readFileSync(path.join(ROOT, "lib/band-jam/catalog.generated.json"), "utf8"),
) as { progressions: Progression[]; styles: BandStyle[] }
const rawClips = JSON.parse(
  readFileSync(path.join(ROOT, "lib/band-jam/clips.generated.json"), "utf8"),
) as Record<string, { sourceKeyPc: number; events: NoteEvent[] }>

const clips = new Map<number, { events: NoteEvent[]; sourceKeyPc: number }>()
for (const [id, v] of Object.entries(rawClips)) {
  clips.set(Number(id), { events: v.events, sourceKeyPc: v.sourceKeyPc })
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]
}

/** Pitched notes the arranger emits for the guitar, per style. */
function arrangedGuitar(style: BandStyle, variation = 0): number[] {
  const progression = catalog.progressions[0]
  const out = arrange({
    style,
    progression,
    keyPc: progression.keyPc,
    tempo: style.tempoDefault,
    clips,
    variation,
  })
  const guitar = out.parts.find((p) => p.part === "guitar")
  return (guitar?.events ?? [])
    .map((e) => e.note)
    .filter((n) => n <= FX_PITCH_MIN)
}

/** Pitched notes in the SOURCE clips for the guitar, before any shift. */
function sourceGuitar(style: BandStyle): number[] {
  const def = style.parts.guitar
  if (!def) return []
  const ids = new Set<number>()
  for (const v of Object.values(def.slots ?? {})) {
    if (typeof v === "number") ids.add(v)
  }
  const notes: number[] = []
  for (const id of ids) {
    for (const e of clips.get(id)?.events ?? []) {
      if (e.note <= FX_PITCH_MIN) notes.push(e.note)
    }
  }
  return notes
}

const stylesWithGuitar = catalog.styles.filter((s) => s.parts.guitar)

describe("guitar octave shift", () => {
  it("defaults to no shift", () => {
    expect(guitarOctaveShift("anything-not-listed")).toBe(0)
    expect(Object.keys(GUITAR_OCTAVE_SHIFT_BY_STYLE).sort()).toEqual(
      ["rnb", "rock"].sort(),
    )
  })

  it("leaves every style except rock and rnb where its clips sit", () => {
    for (const style of stylesWithGuitar) {
      if (style.id === "rock" || style.id === "rnb") continue
      const src = sourceGuitar(style)
      const got = arrangedGuitar(style)
      if (!src.length || !got.length) continue
      // adaptHarmonic moves notes to chord tones, so compare the CENTRE of the
      // register rather than note-for-note. An octave error is 12 semitones;
      // chord adaptation moves things by a few at most.
      expect(
        Math.abs(median(got) - median(src)),
        `${style.id} guitar median moved ${median(src)} -> ${median(got)}`,
      ).toBeLessThan(7)
    }
  })

  it("drops rock by an octave", () => {
    const rock = catalog.styles.find((s) => s.id === "rock")!
    const shift = median(sourceGuitar(rock)) - median(arrangedGuitar(rock))
    expect(shift).toBeGreaterThanOrEqual(8)
    expect(shift).toBeLessThanOrEqual(16)
  })

  it("keeps Classic Funk Core Variation A in a playable guitar register", () => {
    // Funk A is now the hand-picked desktop-generated Core 01 performance,
    // not the old FunkPopRock stroke-only style. It contains real fretted
    // pitches and must survive chord adaptation without falling below low E
    // or leaking MegaVoice noise keys into the web mix.
    const funk = catalog.styles.find((s) => s.id === "funk")!
    const srcId = funk.parts.guitar!.variations?.verse?.[0]
    expect(typeof srcId).toBe("number")
    const src = clips.get(srcId as number)?.events ?? []
    expect(src.length).toBeGreaterThan(0)
    expect(src.every((event) => event.note < GUITAR_NOISE_KEY_MIN)).toBe(true)

    const notes = arrangedGuitar(funk, 0)
    expect(notes.length).toBeGreaterThan(0)
    expect(Math.min(...notes)).toBeGreaterThanOrEqual(40)
    expect(Math.max(...notes)).toBeLessThan(GUITAR_NOISE_KEY_MIN)
  })

  it("keeps funk pitched guitar at its written octave (Variation B)", () => {
    const funk = catalog.styles.find((s) => s.id === "funk")!
    const def = funk.parts.guitar!
    const takes = def.variations?.verse ?? []
    const id = takes[1]
    expect(typeof id).toBe("number")
    const src = (clips.get(id as number)?.events ?? [])
      .map((e) => e.note)
      .filter((n) => n <= FX_PITCH_MIN)
    const got = arrangedGuitar(funk, 1)
    expect(src.length).toBeGreaterThan(0)
    expect(got.length).toBeGreaterThan(0)
    expect(Math.abs(median(got) - median(src))).toBeLessThan(7)
  })

  it("strips funk Variation C FX keys from the web mix", () => {
    // Noise-lane FX is stripped for the web mix; this test now asserts the
    // selected Jazzrock performance keeps its pitched material while no
    // MegaVoice trigger keys leak into playback.
    const funk = catalog.styles.find((s) => s.id === "funk")!
    const id = funk.parts.guitar!.variations?.verse?.[2]
    expect(typeof id).toBe("number")
    const srcFx = (clips.get(id as number)?.events ?? []).filter(
      (e) => e.note >= GUITAR_NOISE_KEY_MIN,
    )
    expect(srcFx.length).toBeGreaterThan(0)
    const out = arrange({
      style: funk,
      progression: catalog.progressions[0],
      keyPc: catalog.progressions[0].keyPc,
      tempo: funk.tempoDefault,
      clips,
      variation: 2,
    })
    const g = out.parts.find((p) => p.part === "guitar")?.events ?? []
    expect(g.some((e) => e.note >= GUITAR_NOISE_KEY_MIN)).toBe(false)
  })

  it("does not re-voice curated funk or rnb Genos takes", () => {
    expect(guitarVoicing("funk")).toBeUndefined()
    expect(guitarVoicing("rnb")).toBeUndefined()
    expect(guitarVoicing("rock")).toBeUndefined()
  })

  it("drops rnb pitched guitar by an octave", () => {
    const rnb = catalog.styles.find((s) => s.id === "rnb")
    if (!rnb?.parts.guitar) return
    const src = sourceGuitar(rnb)
    const got = arrangedGuitar(rnb)
    if (!src.length || !got.length) return
    const shift = median(src) - median(got)
    expect(shift).toBeGreaterThanOrEqual(8)
    expect(shift).toBeLessThanOrEqual(16)
  })

  it("never puts a note below an open low E, in ANY style", () => {
    // This assertion used to be scoped to styles that shift, which is how
    // funk shipped with 42 notes between MIDI 36 and 47 — below the
    // instrument, and audibly an octave low. The floor is a property of the
    // guitar, not of the styles that happen to transpose.
    for (const style of stylesWithGuitar) {
      for (const variation of [0, 1, 2, 3]) {
        const notes = arrangedGuitar(style, variation)
        if (!notes.length) continue
        expect(
          Math.min(...notes),
          `${style.id} variation ${variation}`,
        ).toBeGreaterThanOrEqual(GUITAR_LOW_E)
      }
    }
  })

  it("applies a genre voicing everywhere it claims to, and never to rock", () => {
    expect(guitarVoicing("rock")).toBeUndefined()
    for (const [styleId, voicing] of Object.entries(
      GUITAR_VOICING_BY_STYLE,
    )) {
      const style = catalog.styles.find((s) => s.id === styleId)
      if (!style?.parts.guitar) continue
      // Variation A can be stroke-only MegaVoice (FunkPopRock CHD1: every
      // note > FX_PITCH_MIN). Genre voicing correctly leaves those alone —
      // find a take that still has pitched notes so the assert is meaningful.
      let changed = false
      for (let variation = 0; variation < 4; variation++) {
        const withVoicing = arrangedGuitar(style, variation)
        if (!withVoicing.some((n) => n <= FX_PITCH_MIN)) continue
        const off = structuredClone(style)
        off.parts.guitar!.voicing = "None"
        if (
          JSON.stringify(withVoicing) !==
          JSON.stringify(arrangedGuitar(off, variation))
        ) {
          changed = true
          break
        }
      }
      expect(
        changed,
        `${styleId} declares ${voicing} but pitched takes are unchanged`,
      ).toBe(true)
    }
  })

  it("does not collapse the A-D variations, which is what Power did to rock", () => {
    // The rock regression: re-voicing rewrote all four curated templates to
    // the same root-and-fifth pitch set. Assert voicing never REDUCES how many
    // distinct takes a style has — rnb and blues genuinely have fewer clips,
    // so the comparison is against that style's own un-voiced baseline.
    const distinctTakes = (style: BandStyle) =>
      new Set(
        [0, 1, 2, 3].map((v) => JSON.stringify(arrangedGuitar(style, v))),
      ).size

    for (const styleId of Object.keys(GUITAR_VOICING_BY_STYLE)) {
      const style = catalog.styles.find((s) => s.id === styleId)
      if (!style?.parts.guitar) continue
      const off = structuredClone(style)
      off.parts.guitar!.voicing = "None"
      expect(distinctTakes(style), `${styleId}`).toBeGreaterThanOrEqual(
        distinctTakes(off),
      )
    }
  })

  it("never moves the FX and strum keys", () => {
    // Stroke-register notes (84–95) octave-drop into frets; noise-lane FX
    // (≥96) is stripped so muted/pickrest one-shots do not rattle the mix.
    const rock = catalog.styles.find((s) => s.id === "rock")!
    const progression = catalog.progressions[0]
    const out = arrange({
      style: rock,
      progression,
      keyPc: progression.keyPc,
      tempo: rock.tempoDefault,
      clips,
      variation: 0,
    })
    const g = out.parts.find((p) => p.part === "guitar")?.events ?? []
    expect(g.some((e) => e.note >= GUITAR_NOISE_KEY_MIN)).toBe(false)
  })

  it("strips MegaVoice noise on funk/rock/pop Emily guitar and ballad steel", () => {
    for (const styleId of ["funk", "rock", "pop", "ballad"] as const) {
      const style = catalog.styles.find((s) => s.id === styleId)!
      if (!style.parts.guitar) continue
      const out = arrange({
        style,
        progression: catalog.progressions[0],
        keyPc: catalog.progressions[0].keyPc,
        tempo: style.tempoDefault,
        clips,
        variation: 0,
      })
      const g = out.parts.find((p) => p.part === "guitar")?.events ?? []
      expect(g.some((e) => e.note >= GUITAR_NOISE_KEY_MIN), styleId).toBe(false)
      expect(g.length, styleId).toBeGreaterThan(0)
      if (styleId === "ballad") {
        expect(g.every((e) => e.velocity <= 60)).toBe(true)
      }
    }
  })

  it("strips MegaVoice noise and dead-band velocities on ballad steel guitar", () => {
    const ballad = catalog.styles.find((s) => s.id === "ballad")!
    expect(ballad.parts.guitar).toBeTruthy()
    // Chorus A is the worst offender: ~80 FX keys + some vel≥61 dead hits.
    const chorusA = ballad.parts.guitar!.variations?.chorus?.[0]
    expect(typeof chorusA).toBe("number")
    const src = clips.get(chorusA as number)?.events ?? []
    expect(src.some((e) => e.note >= GUITAR_NOISE_KEY_MIN)).toBe(true)

    const out = arrange({
      style: ballad,
      progression: catalog.progressions[0],
      keyPc: catalog.progressions[0].keyPc,
      tempo: ballad.tempoDefault,
      clips,
      variation: 0,
    })
    const g = out.parts.find((p) => p.part === "guitar")?.events ?? []
    expect(g.some((e) => e.note >= GUITAR_NOISE_KEY_MIN)).toBe(false)
    expect(g.every((e) => e.velocity <= 60)).toBe(true)
    expect(g.length).toBeGreaterThan(0)
  })
})
