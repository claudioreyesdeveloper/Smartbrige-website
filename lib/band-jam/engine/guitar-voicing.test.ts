import { describe, expect, it } from "vitest"
import { FX_PITCH_MIN } from "@/lib/band-jam/engine/types"
import type { ChordEvent, NoteEvent } from "@/lib/band-jam/engine/types"
import {
  applyGuitarVoicing,
  parseChordQuality,
  resolveAutoFromCategory,
  styleName,
  type VoicingStyle,
} from "@/lib/band-jam/engine/guitar-voicing"

function note(beat: number, pitch: number, velocity: number, durationBeats: number): NoteEvent {
  return { beat, note: pitch, velocity, durationBeats }
}

function chord(startBeat: number, durationBeats: number, root: number, name: string): ChordEvent {
  return { startBeat, durationBeats, root, name }
}

// Velocity used for "normal" strummed test strokes: outside both the source
// dead band (61-75) and mute band (76-90), so applyGuitarVoicing's
// strokeHasSourceDeadOrMuteArticulation gate never suppresses the transform
// under test.
const V = 100

const ALL_STYLES: VoicingStyle[] = ["None", "PopOpen", "Power", "Funk", "Jazz", "Reggae", "Latin", "Blues", "Muted"]

function pc(x: number): number {
  return ((x % 12) + 12) % 12
}

// ---------------------------------------------------------------------------
// FX_PITCH_MIN passthrough
// ---------------------------------------------------------------------------

describe("applyGuitarVoicing — MegaVoice trigger-lane passthrough", () => {
  it("leaves notes above FX_PITCH_MIN byte-identical through every style", () => {
    const fxNote = note(0, 90, 111, 0.5) // 90 > FX_PITCH_MIN (83): trigger lane
    const events: NoteEvent[] = [fxNote, note(0, 60, V, 1), note(0, 64, V, 1), note(0, 67, V, 1)]
    const chords = [chord(0, 4, 0, "C")]

    for (const style of ALL_STYLES) {
      const out = applyGuitarVoicing(events, style, chords)
      expect(out).toContainEqual(fxNote)
    }
  })

  it("boundary: note === FX_PITCH_MIN (83) is NOT trigger lane and IS reshaped by Power", () => {
    const boundaryNote = note(0, FX_PITCH_MIN, V, 1) // 83, still a pitched note
    const events: NoteEvent[] = [boundaryNote, note(0, 67, V, 1)]
    const chords = [chord(0, 4, 0, "C")]

    const out = applyGuitarVoicing(events, "Power", chords)
    // Power fully replaces the stroke with root+fifth; the original 83 note
    // must NOT survive untouched (it was in-range for reshaping).
    expect(out).not.toContainEqual(boundaryNote)
    expect(out.map((n) => n.note).sort((a, b) => a - b)).toEqual([36, 43])
  })
})

// ---------------------------------------------------------------------------
// Power
// ---------------------------------------------------------------------------

describe("applyGuitarVoicing — Power", () => {
  it("C major yields root + fifth in the low C2..B2-ish power pocket", () => {
    const events: NoteEvent[] = [note(0, 60, V, 1), note(0, 64, V, 1), note(0, 67, V, 1)]
    const chords = [chord(0, 4, 0, "C")]

    const out = applyGuitarVoicing(events, "Power", chords)
    const pitches = out.map((n) => n.note).sort((a, b) => a - b)
    expect(pitches).toEqual([36, 43]) // C2 root, G2 fifth

    for (const p of pitches) {
      expect(p).toBeGreaterThanOrEqual(36)
      expect(p).toBeLessThanOrEqual(50) // C++'s stated E2/B2-ish pocket
    }
  })

  it("root and fifth land close to a reference E2/B2 for a chord whose root is E", () => {
    const events: NoteEvent[] = [note(0, 64, V, 1), note(0, 68, V, 1), note(0, 71, V, 1)]
    const chords = [chord(0, 4, 4, "E")] // E = pc 4

    const out = applyGuitarVoicing(events, "Power", chords)
    const pitches = out.map((n) => n.note).sort((a, b) => a - b)
    expect(pitches).toEqual([40, 47]) // E2, B2 exactly
  })
})

// ---------------------------------------------------------------------------
// Funk shell
// ---------------------------------------------------------------------------

describe("applyGuitarVoicing — Funk shell (3rd + colour)", () => {
  it("plain major chord gets 3rd + 6th, NOT a forced b7/dominant colour", () => {
    // Deliberately use root + 5th only, so 3rd/6th are genuinely new shell
    // tones rather than already-present pitch classes.
    const events: NoteEvent[] = [note(0, 60, V, 1), note(0, 67, V, 1)]
    const chords = [chord(0, 4, 0, "C")] // plain major, no spelled 7th

    const out = applyGuitarVoicing(events, "Funk", chords)
    const pcs = new Set(out.map((n) => pc(n.note)))
    expect(pcs.has(pc(0 + 4))).toBe(true) // 3rd (E)
    expect(pcs.has(pc(0 + 9))).toBe(true) // 6th (A) — the documented major-chord colour
    expect(pcs.has(pc(0 + 10))).toBe(false) // NOT b7 — must not force a dominant sound
  })

  it("plain minor chord gets 3rd + b7 (m7 feel)", () => {
    // Bass note (<=47) plus a single upper note placed away from both target
    // shell slots (65 for the 3rd, 60 for the b7 -- the funk grip register is
    // only 54..71, so each pitch class has exactly one candidate in range;
    // this fixture keeps both candidates clear of the kFunkMinGripInterval=3
    // exclusion zone around the original note).
    const events: NoteEvent[] = [note(0, 43, V, 1), note(0, 71, V, 1)]
    const chords = [chord(0, 4, 2, "Dm")] // D minor, no spelled 7th

    const out = applyGuitarVoicing(events, "Funk", chords)
    const pcs = new Set(out.map((n) => pc(n.note)))
    expect(pcs.has(pc(2 + 3))).toBe(true) // 3rd (F)
    expect(pcs.has(pc(2 + 10))).toBe(true) // b7 (C)
  })

  it("chord that already spells a 7th (maj7) uses that exact 7th as the colour tone", () => {
    const events: NoteEvent[] = [note(0, 60, V, 1), note(0, 67, V, 1)]
    const chords = [chord(0, 4, 0, "Cmaj7")] // seventhSemis = 11

    const out = applyGuitarVoicing(events, "Funk", chords)
    const pcs = new Set(out.map((n) => pc(n.note)))
    expect(pcs.has(pc(0 + 4))).toBe(true) // 3rd
    expect(pcs.has(pc(0 + 11))).toBe(true) // maj7 colour, chord-spelled
    expect(pcs.has(pc(0 + 9))).toBe(false) // not the plain-major fallback (6th)
    expect(pcs.has(pc(0 + 10))).toBe(false) // not the plain-minor fallback (b7)
  })

  it("sus chords are left as-is (no third to build a shell from)", () => {
    const events: NoteEvent[] = [note(0, 60, V, 1), note(0, 65, V, 1), note(0, 67, V, 1)]
    const chords = [chord(0, 4, 0, "Csus4")]

    const out = applyGuitarVoicing(events, "Funk", chords)
    expect(out.map((n) => n.note).sort((a, b) => a - b)).toEqual([60, 65, 67])
  })
})

// ---------------------------------------------------------------------------
// Jazz drop-2
// ---------------------------------------------------------------------------

describe("applyGuitarVoicing — Jazz drop-2", () => {
  it("orders low-to-high as 5(dropped) - R - 3 - 7 (the arithmetic the source computes)", () => {
    const events: NoteEvent[] = [note(0, 60, V, 1), note(0, 64, V, 1), note(0, 67, V, 1)]
    const chords = [chord(0, 4, 0, "C7")] // dominant 7th: thirdSemis 4, seventhSemis 10

    const out = applyGuitarVoicing(events, "Jazz", chords)
    const pitches = out.map((n) => n.note).sort((a, b) => a - b)
    // root anchored near C4 (60): fifthLow=55(G2-ish/dropped), root=60, third=64, seventh=70
    expect(pitches).toEqual([55, 60, 64, 70])
  })

  it("sus chords are left as-is (can't drop-2 without a third)", () => {
    const events: NoteEvent[] = [note(0, 60, V, 1), note(0, 65, V, 1), note(0, 67, V, 1)]
    const chords = [chord(0, 4, 0, "Csus4")]

    const out = applyGuitarVoicing(events, "Jazz", chords)
    expect(out.map((n) => n.note).sort((a, b) => a - b)).toEqual([60, 65, 67])
  })
})

// ---------------------------------------------------------------------------
// Reggae
// ---------------------------------------------------------------------------

describe("applyGuitarVoicing — Reggae", () => {
  it("keeps only the top 3 notes of a stroke", () => {
    const events: NoteEvent[] = [note(0, 43, V, 1), note(0, 55, V, 1), note(0, 60, V, 1), note(0, 64, V, 1), note(0, 67, V, 1)]
    const chords = [chord(0, 4, 0, "C")]

    const out = applyGuitarVoicing(events, "Reggae", chords)
    expect(out.map((n) => n.note).sort((a, b) => a - b)).toEqual([60, 64, 67])
  })

  it("strokes of 3 or fewer notes are untouched", () => {
    const events: NoteEvent[] = [note(0, 60, V, 1), note(0, 64, V, 1), note(0, 67, V, 1)]
    const chords = [chord(0, 4, 0, "C")]

    const out = applyGuitarVoicing(events, "Reggae", chords)
    expect(out.map((n) => n.note).sort((a, b) => a - b)).toEqual([60, 64, 67])
  })
})

// ---------------------------------------------------------------------------
// Blues
// ---------------------------------------------------------------------------

describe("applyGuitarVoicing — Blues", () => {
  it("adds a b7 to a major-quality chord", () => {
    const events: NoteEvent[] = [note(0, 60, V, 1), note(0, 64, V, 1), note(0, 67, V, 1)]
    const chords = [chord(0, 4, 0, "C")]

    const out = applyGuitarVoicing(events, "Blues", chords)
    expect(out.length).toBe(4)
    expect(out.some((n) => pc(n.note) === pc(0 + 10))).toBe(true) // Bb, the b7
    // originals survive untouched
    expect(out).toContainEqual(note(0, 60, V, 1))
    expect(out).toContainEqual(note(0, 64, V, 1))
    expect(out).toContainEqual(note(0, 67, V, 1))
  })

  it("does NOT add a b7 to a minor-quality chord", () => {
    const events: NoteEvent[] = [note(0, 62, V, 1), note(0, 65, V, 1), note(0, 69, V, 1)]
    const chords = [chord(0, 4, 2, "Dm")]

    const out = applyGuitarVoicing(events, "Blues", chords)
    expect(out.length).toBe(3)
  })

  it("does NOT add a b7 when the chord is already maj7", () => {
    const events: NoteEvent[] = [note(0, 60, V, 1), note(0, 64, V, 1), note(0, 67, V, 1)]
    const chords = [chord(0, 4, 0, "Cmaj7")]

    const out = applyGuitarVoicing(events, "Blues", chords)
    expect(out.length).toBe(3)
  })
})

// ---------------------------------------------------------------------------
// None / PopOpen
// ---------------------------------------------------------------------------

describe("applyGuitarVoicing — None / PopOpen", () => {
  it("None is a no-op", () => {
    const events: NoteEvent[] = [note(0, 60, V, 1), note(1, 64, V, 1), note(2, 67, V, 1)]
    const chords = [chord(0, 4, 0, "C")]
    expect(applyGuitarVoicing(events, "None", chords)).toEqual(events)
  })

  it("PopOpen is a no-op", () => {
    const events: NoteEvent[] = [note(0, 60, V, 1), note(1, 64, V, 1), note(2, 67, V, 1)]
    const chords = [chord(0, 4, 0, "C")]
    expect(applyGuitarVoicing(events, "PopOpen", chords)).toEqual(events)
  })
})

// ---------------------------------------------------------------------------
// Timing is never altered
// ---------------------------------------------------------------------------

describe("applyGuitarVoicing — stroke timing is preserved", () => {
  // Two strokes, one per chord block, with no third stroke to interfere.
  const events: NoteEvent[] = [
    note(0, 60, V, 1),
    note(0, 64, V, 1),
    note(0, 67, V, 1),
    note(2, 62, V, 1),
    note(2, 65, V, 1),
    note(2, 69, V, 1),
    note(2, 72, V, 1),
  ]
  const chords = [chord(0, 2, 0, "C"), chord(2, 2, 2, "Dm7")]
  const STROKE_TOLERANCE = 0.15 // kStrokeWindowBeats

  for (const style of ALL_STYLES) {
    it(`${style}: every output note stays within one stroke-window of its original onset, and both onsets survive`, () => {
      const out = applyGuitarVoicing(events, style, chords)
      for (const n of out) {
        const distTo0 = Math.abs(n.beat - 0)
        const distTo2 = Math.abs(n.beat - 2)
        expect(Math.min(distTo0, distTo2)).toBeLessThan(STROKE_TOLERANCE)
      }
      expect(out.some((n) => n.beat === 0)).toBe(true)
      expect(out.some((n) => n.beat === 2)).toBe(true)
    })
  }
})

// ---------------------------------------------------------------------------
// Stroke clustering tolerance
// ---------------------------------------------------------------------------

describe("applyGuitarVoicing — stroke clustering window (kStrokeWindowBeats = 0.15)", () => {
  it("groups note-ons within 0.15 beats of the stroke's first note into one stroke", () => {
    // Human-feel strum: 4 notes fired within a 0.1-beat window -> one stroke.
    const events: NoteEvent[] = [note(0, 60, V, 1), note(0.03, 64, V, 1), note(0.07, 67, V, 1), note(0.1, 72, V, 1)]
    const chords = [chord(0, 4, 0, "C")]

    const out = applyGuitarVoicing(events, "Power", chords)
    // Power fully replaces a stroke with exactly 2 notes (root+fifth); if the
    // 4 notes had been split into multiple strokes we'd see more than 2.
    expect(out.length).toBe(2)
  })

  it("treats note-ons 0.2 beats apart (past the window) as separate strokes", () => {
    const events: NoteEvent[] = [note(0, 60, V, 1), note(0.2, 64, V, 1)]
    const chords = [chord(0, 4, 0, "C")]

    const out = applyGuitarVoicing(events, "Power", chords)
    // Two separate strokes -> two root+fifth pairs -> 4 notes.
    expect(out.length).toBe(4)
  })
})

// ---------------------------------------------------------------------------
// resolveAutoFromCategory
// ---------------------------------------------------------------------------

describe("resolveAutoFromCategory", () => {
  it.each([
    ["Funk", "Funk"],
    ["R&B", "Funk"],
    ["Jazz", "Jazz"],
    ["Reggae", "Reggae"],
    ["Blues Slow", "Blues"],
    ["Rhythm&Blues", "Blues"],
    ["Latin Pop", "Latin"],
    ["Rock 8-beat", "Power"],
    ["Rock&Roll", "Power"],
    ["Metal", "Power"],
    ["Pop Slow", "PopOpen"],
    ["Basic_Strumming", "PopOpen"],
    ["World", "PopOpen"],
    ["", "PopOpen"],
  ] as const)("%s -> %s", (category, expected) => {
    expect(resolveAutoFromCategory(category)).toBe(expected)
  })
})

// ---------------------------------------------------------------------------
// styleName
// ---------------------------------------------------------------------------

describe("styleName", () => {
  it("matches the desktop identifiers", () => {
    expect(styleName("None")).toBe("Off")
    expect(styleName("PopOpen")).toBe("Pop")
    expect(styleName("Power")).toBe("Power")
    expect(styleName("Funk")).toBe("Funk")
    expect(styleName("Jazz")).toBe("Jazz")
    expect(styleName("Reggae")).toBe("Reggae")
    expect(styleName("Latin")).toBe("Latin")
    expect(styleName("Blues")).toBe("Blues")
    expect(styleName("Muted")).toBe("Muted")
  })
})

// ---------------------------------------------------------------------------
// Chord quality parsing
// ---------------------------------------------------------------------------

describe("parseChordQuality", () => {
  it("major triad: 'C'", () => {
    const c = parseChordQuality("C", 0)
    expect(c.valid).toBe(true)
    expect(c.thirdSemis).toBe(4)
    expect(c.fifthSemis).toBe(7)
    expect(c.seventhSemis).toBe(-1)
  })

  it("minor triad: 'Cm'", () => {
    const c = parseChordQuality("Cm", 0)
    expect(c.thirdSemis).toBe(3)
    expect(c.seventhSemis).toBe(-1)
  })

  it("dominant 7th: 'C7'", () => {
    const c = parseChordQuality("C7", 0)
    expect(c.thirdSemis).toBe(4)
    expect(c.seventhSemis).toBe(10)
  })

  it("major 7th: 'Cmaj7'", () => {
    const c = parseChordQuality("Cmaj7", 0)
    expect(c.thirdSemis).toBe(4)
    expect(c.seventhSemis).toBe(11)
  })

  it("minor 7th: 'Cm7'", () => {
    const c = parseChordQuality("Cm7", 0)
    expect(c.thirdSemis).toBe(3)
    expect(c.seventhSemis).toBe(10)
  })

  it("half-diminished: 'Bm7b5'", () => {
    const c = parseChordQuality("Bm7b5", 11)
    expect(c.thirdSemis).toBe(3)
    expect(c.fifthSemis).toBe(6)
    expect(c.seventhSemis).toBe(10)
  })

  it("diminished 7th: 'Bdim7'", () => {
    const c = parseChordQuality("Bdim7", 11)
    expect(c.thirdSemis).toBe(3)
    expect(c.fifthSemis).toBe(6)
    expect(c.seventhSemis).toBe(9)
  })

  it("sus4: 'Csus4'", () => {
    const c = parseChordQuality("Csus4", 0)
    expect(c.sus4).toBe(true)
    expect(c.thirdSemis).toBe(-1)
  })

  it("sus2: 'Csus2'", () => {
    const c = parseChordQuality("Csus2", 0)
    expect(c.sus2).toBe(true)
    expect(c.thirdSemis).toBe(-1)
  })

  it("slash chords parse the head's quality, ignoring the bass token", () => {
    const c = parseChordQuality("FM7(9)/A", 5)
    expect(c.valid).toBe(true)
    expect(c.seventhSemis).toBe(11) // maj7 via the upper-case "M7" token
  })
})
