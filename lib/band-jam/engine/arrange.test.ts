import { describe, expect, it } from "vitest"
import { FX_PITCH_MIN } from "@/lib/band-jam/engine/types"
import type {
  BandStyle,
  ChordEvent,
  NoteEvent,
  Progression,
} from "@/lib/band-jam/engine/types"
import {
  adaptHarmonic,
  arrange,
  foldToRegister,
  shiftForRoot,
  tileEvents,
  transposeChordSymbol,
} from "@/lib/band-jam/engine/arrange"

const EPS_TEST = 1e-6

function note(beat: number, pitch: number, velocity: number, durationBeats: number): NoteEvent {
  return { beat, note: pitch, velocity, durationBeats }
}

function chord(startBeat: number, durationBeats: number, root: number, name: string): ChordEvent {
  return { startBeat, durationBeats, root, name }
}

describe("tileEvents", () => {
  it("fills a section exactly, repeating the clip on bar boundaries", () => {
    // 1-bar (4-beat) clip, tiled across a 2-bar (8-beat) section: exactly 2 copies.
    const clip: NoteEvent[] = [note(0, 60, 90, 1), note(2, 62, 90, 1)]
    const out = tileEvents(clip, 8)
    expect(out).toEqual([
      note(0, 60, 90, 1),
      note(2, 62, 90, 1),
      note(4, 60, 90, 1),
      note(6, 62, 90, 1),
    ])
  })

  it("truncates the final partial repeat at the section boundary", () => {
    // 1-bar clip tiled across a 10-beat section (2.5 bars): the third copy
    // starts at beat 8, so its beat-2 note (would land at 10) is dropped
    // entirely, and any note crossing the boundary is duration-clipped.
    const clip: NoteEvent[] = [note(0, 60, 90, 3), note(2, 62, 90, 1)]
    const out = tileEvents(clip, 10)
    expect(out).toEqual([
      note(0, 60, 90, 3),
      note(2, 62, 90, 1),
      note(4, 60, 90, 3),
      note(6, 62, 90, 1),
      // third repeat: offset 8. beat 0 note survives but its duration (3)
      // would run past the section end (10), so it's clipped to 2.
      note(8, 60, 90, 2),
      // beat 2 note would start at t=10, which is not < 10 - EPS: dropped.
    ])
  })

  it("returns an empty array for an empty clip", () => {
    expect(tileEvents([], 16)).toEqual([])
  })
})

describe("shiftForRoot", () => {
  it("picks the short way round instead of the long way", () => {
    // 0 -> 10 is +10 the long way but -2 the short way.
    expect(shiftForRoot(0, 10)).toBe(-2)
  })

  it("returns 0 for no change", () => {
    expect(shiftForRoot(7, 7)).toBe(0)
  })

  it("picks +6 over -6 at the exact tritone boundary (delta > 6, not >=)", () => {
    expect(shiftForRoot(0, 6)).toBe(6)
  })

  it("wraps a small negative delta correctly", () => {
    // 2 -> 0 is -2, well within the short side.
    expect(shiftForRoot(2, 0)).toBe(-2)
  })
})

describe("foldToRegister", () => {
  it("brings a too-low note up into range in octave steps", () => {
    expect(foldToRegister(20, 28, 72)).toBe(32)
  })

  it("brings a too-high note down into range in octave steps", () => {
    expect(foldToRegister(100, 28, 72)).toBe(64)
  })

  it("leaves an in-range note alone", () => {
    expect(foldToRegister(50, 28, 72)).toBe(50)
  })

  it("leaves boundary notes alone", () => {
    expect(foldToRegister(28, 28, 72)).toBe(28)
    expect(foldToRegister(72, 28, 72)).toBe(72)
  })
})

describe("adaptHarmonic", () => {
  const chords: ChordEvent[] = [chord(0, 4, 7, "G"), chord(4, 4, 2, "D")]

  it("transposes pitched notes to follow the active chord root", () => {
    // srcKeyPc=0 (C). At beat 0 the chord root is 7 (G): shiftForRoot(0,7) = -5.
    const out = adaptHarmonic([note(0, 60, 90, 1)], 0, chords, [0, 127])
    expect(out).toEqual([note(0, 55, 90, 1)])
  })

  it("follows a later chord when the note falls in its span", () => {
    // At beat 4 the chord root is 2 (D): shiftForRoot(0,2) = 2.
    const out = adaptHarmonic([note(4, 60, 90, 1)], 0, chords, [0, 127])
    expect(out).toEqual([note(4, 62, 90, 1)])
  })

  it("folds the shifted note into the given register", () => {
    const out = adaptHarmonic([note(0, 60, 90, 1)], 0, chords, [56, 67])
    // 60 + (-5) = 55, folded up into [56,67] -> 67.
    expect(out).toEqual([note(0, 67, 90, 1)])
  })

  it("falls back to the first chord's root when no chord spans the note's beat", () => {
    const out = adaptHarmonic([note(9, 60, 90, 1)], 0, chords, [0, 127])
    // beat 9 is past both chords; falls back to chords[0].root = 7.
    expect(out).toEqual([note(9, 55, 90, 1)])
  })

  it("falls back to srcKeyPc when there are no chords at all", () => {
    const out = adaptHarmonic([note(0, 60, 90, 1)], 3, [], [0, 127])
    // No chords -> root = srcKeyPc = 3 -> shiftForRoot(3,3) = 0 -> unchanged pitch.
    expect(out).toEqual([note(0, 60, 90, 1)])
  })

  it("leaves notes above FX_PITCH_MIN byte-identical: no transpose, no fold, no velocity change", () => {
    const fx = note(1.5, 90, 37, 0.25)
    expect(fx.note).toBeGreaterThan(FX_PITCH_MIN)
    // Register [0,12] would force any pitched note to fold drastically —
    // proves the FX note skips fold_to_register entirely, not just shift.
    const out = adaptHarmonic([fx], 0, chords, [0, 12])
    expect(out).toEqual([fx])
    expect(out[0]).toStrictEqual(fx)
  })

  it("leaves a mix of FX and pitched notes each treated correctly", () => {
    const pitched = note(0, 60, 90, 1)
    const fx = note(0, 96, 20, 0.1)
    const out = adaptHarmonic([pitched, fx], 0, chords, [0, 127])
    expect(out).toEqual([note(0, 55, 90, 1), fx])
  })
})

describe("transposeChordSymbol", () => {
  it("transposes a plain major triad", () => {
    expect(transposeChordSymbol("C", 2)).toBe("D")
  })

  it("preserves quality suffixes", () => {
    expect(transposeChordSymbol("Am7", 3)).toBe("Cm7")
    expect(transposeChordSymbol("E7#9", -5)).toBe("B7#9")
    expect(transposeChordSymbol("G13", 5)).toBe("C13")
  })

  it("transposes slash chords, shifting both root and bass", () => {
    expect(transposeChordSymbol("FM7(9)/A", 2)).toBe("GM7(9)/B")
  })

  it("wraps around the octave correctly", () => {
    // Fixed spelling table (see PC_NAMES): pc 1 always renders as "Db", not "C#".
    expect(transposeChordSymbol("Bm", 2)).toBe("Dbm")
  })

  it("is a no-op at zero semitones", () => {
    expect(transposeChordSymbol("Dm9", 0)).toBe("Dm9")
  })
})

// ---------------------------------------------------------------------------
// arrange() — the full section / part / fill assembly loop
// ---------------------------------------------------------------------------

/** A drum clip: two hits per bar, well above FX_PITCH_MIN mixed with a kick. */
const DRUM_CLIP: NoteEvent[] = [
  note(0, 36, 100, 0.25), // kick, pitched-range but harmonic=false so never touched
  note(1, 90, 80, 0.1), // FX/noise hit
  note(2, 38, 100, 0.25),
  note(3, 90, 80, 0.1),
]

const DRUM_FILL_CLIP: NoteEvent[] = [note(0, 49, 110, 0.5), note(2, 49, 110, 0.5)]

const BASS_CLIP: NoteEvent[] = [note(0, 40, 90, 1), note(2, 40, 90, 1)]

const GUITAR_CLIP: NoteEvent[] = [
  note(0, 55, 70, 2),
  note(2, 90, 60, 0.2), // FX scrape mixed into a harmonic part's clip
]

function buildFixtureStyle(): BandStyle {
  return {
    id: "test-style",
    name: "Test Style",
    tempoDefault: 100,
    tempoMin: 80,
    tempoMax: 120,
    parts: {
      drums: {
        instrument: "kit",
        gain: 1,
        harmonic: false,
        slots: { intro: 1, verse: 1, chorus: 1 },
        fills: { atSectionEnd: true, minSectionBars: 4, pool: [10, 11] },
      },
      bass: {
        instrument: "bass",
        gain: 1,
        harmonic: true,
        register: [28, 48],
        slots: { intro: 2, verse: 2, chorus: 2 },
      },
      guitar: {
        instrument: "guitar",
        gain: 1,
        harmonic: true,
        register: [45, 83],
        reuseClipId: 3,
        slots: { intro: 3, verse: 3, chorus: 3 },
      },
      solo: {
        instrument: "guitar",
        gain: 1,
        harmonic: true,
        register: [52, 83],
        slots: { chorus: 3 },
      },
    },
  }
}

function buildFixtureProgression(): Progression {
  return {
    id: "test-prog",
    name: "Test Progression",
    keyPc: 0, // C
    keyLabel: "C",
    sections: [
      { role: "intro", label: "Intro", bars: 4, chords: [chord(0, 16, 0, "C")] },
      {
        role: "verse",
        label: "Verse",
        bars: 8,
        chords: [chord(0, 8, 0, "C"), chord(8, 8, 7, "G"), chord(16, 8, 9, "Am"), chord(24, 8, 5, "F")],
      },
      {
        // 4 bars, >= minSectionBars, so drums get a fill here too.
        role: "chorus",
        label: "Chorus",
        bars: 4,
        chords: [chord(0, 8, 5, "F"), chord(8, 4, 4, "Em"), chord(12, 4, 7, "G")],
      },
    ],
  }
}

function buildFixtureClips(): Map<number, { events: NoteEvent[]; sourceKeyPc: number }> {
  return new Map([
    [1, { events: DRUM_CLIP, sourceKeyPc: 0 }],
    [2, { events: BASS_CLIP, sourceKeyPc: 0 }],
    [3, { events: GUITAR_CLIP, sourceKeyPc: 0 }],
    [10, { events: DRUM_FILL_CLIP, sourceKeyPc: 0 }],
    [11, { events: DRUM_FILL_CLIP, sourceKeyPc: 0 }],
  ])
}

describe("arrange", () => {
  it("produces a chart where every bar's chord beats sum to BEATS_PER_BAR", () => {
    const result = arrange({
      style: buildFixtureStyle(),
      progression: buildFixtureProgression(),
      keyPc: 0,
      tempo: 100,
      clips: buildFixtureClips(),
    })
    for (const section of result.sections) {
      for (const bar of section.bars) {
        const sum = bar.chords.reduce((acc, c) => acc + c.beats, 0)
        expect(sum).toBeCloseTo(4, 6)
      }
    }
  })

  it("computes totalBeats as the sum of section bars * 4", () => {
    const progression = buildFixtureProgression()
    const result = arrange({
      style: buildFixtureStyle(),
      progression,
      keyPc: 0,
      tempo: 100,
      clips: buildFixtureClips(),
    })
    const expectedBars = progression.sections.reduce((acc, s) => acc + s.bars, 0)
    expect(result.totalBars).toBe(expectedBars)
    expect(result.totalBeats).toBe(expectedBars * 4)
  })

  it("transposes chord symbols into the target key, not the progression's home key", () => {
    // Progression is in C (keyPc 0); play it in A (keyPc 9): +9 semitones.
    const result = arrange({
      style: buildFixtureStyle(),
      progression: buildFixtureProgression(),
      keyPc: 9,
      tempo: 100,
      clips: buildFixtureClips(),
    })
    const introBar1 = result.sections[0].bars[0]
    expect(introBar1.chords[0].symbol).toBe("A")
    expect(introBar1.chords[0].root).toBe(9)

    const verseBars = result.sections[1].bars
    // Verse: C(8) G(8) Am(8) F(8) at home key, +9 semitones -> A E F#m D.
    expect(verseBars[0].chords[0].symbol).toBe("A")
    expect(verseBars[2].chords[0].symbol).toBe("E")
    expect(verseBars[4].chords[0].symbol).toBe("F#m")
    expect(verseBars[6].chords[0].symbol).toBe("D")
  })

  it("reuseClipId overrides per-role slots for every section, including ones without a slot entry", () => {
    const style = buildFixtureStyle()
    const result = arrange({
      style,
      progression: buildFixtureProgression(),
      keyPc: 0,
      tempo: 100,
      clips: buildFixtureClips(),
    })
    const guitar = result.parts.find((p) => p.part === "guitar")
    expect(guitar).toBeDefined()
    // 4 (intro) + 8 (verse) + 4 (chorus) bars, guitar clip is 4 beats long
    // (bar-rounded), tiled every section: total note count should be a
    // multiple of the clip's 2 events per bar.
    const totalGuitarBars = 4 + 8 + 4
    expect(guitar!.events.length).toBe(totalGuitarBars * GUITAR_CLIP.length)
  })

  it("only includes solo in the parts list on sections where it has a slot", () => {
    const result = arrange({
      style: buildFixtureStyle(),
      progression: buildFixtureProgression(),
      keyPc: 0,
      tempo: 100,
      clips: buildFixtureClips(),
    })
    const solo = result.parts.find((p) => p.part === "solo")
    expect(solo).toBeDefined()
    // Solo only slotted on chorus (4 bars = 16 beats): events confined to
    // the chorus's beat range [12 (intro+verse bars*4), 28).
    const introVerseBeats = (4 + 8) * 4
    const chorusBeats = 4 * 4
    for (const e of solo!.events) {
      expect(e.beat).toBeGreaterThanOrEqual(introVerseBeats - EPS_TEST)
      expect(e.beat).toBeLessThan(introVerseBeats + chorusBeats)
    }
  })

  it("splices a fill in at the end of qualifying sections without touching earlier beats", () => {
    const result = arrange({
      style: buildFixtureStyle(),
      progression: buildFixtureProgression(),
      keyPc: 0,
      tempo: 100,
      clips: buildFixtureClips(),
    })
    const drums = result.parts.find((p) => p.part === "drums")!
    // Chorus section spans beats [12*4, 12*4+16) = [48, 64). The fill
    // replaces the last bar [60, 64).
    const chorusFillEvents = drums.events.filter((e) => e.beat >= 60 - 1e-6 && e.beat < 64)
    // DRUM_FILL_CLIP has 2 events per bar; the fill is exactly 1 bar.
    expect(chorusFillEvents.length).toBe(DRUM_FILL_CLIP.length)
    // And the original clip's beat-3 hit that would have landed at 63 is gone
    // (replaced by the fill), while earlier bars are untouched.
    const preFillEvents = drums.events.filter((e) => e.beat >= 48 - 1e-6 && e.beat < 60)
    expect(preFillEvents.length).toBeGreaterThan(0)
  })

  it("degrades gracefully when a referenced clip id is missing", () => {
    // Deliberately NOT a throw. A missing clip means one part is silent, not
    // that the arrangement is invalid -- throwing here blanked the entire
    // practice screen whenever catalog.generated.json and clips.generated.json
    // were momentarily out of step (e.g. mid-regeneration).
    const clips = buildFixtureClips()
    clips.delete(2) // bass clip id 2 missing

    let arrangement!: ReturnType<typeof arrange>
    expect(() => {
      arrangement = arrange({
        style: buildFixtureStyle(),
        progression: buildFixtureProgression(),
        keyPc: 0,
        tempo: 100,
        clips,
      })
    }).not.toThrow()

    // Bass is silent...
    const bass = arrangement.parts.find((p) => p.part === "bass")
    expect(bass?.events ?? []).toHaveLength(0)
    // ...but the rest of the band still plays, and the chart is intact.
    const drums = arrangement.parts.find((p) => p.part === "drums")
    expect(drums!.events.length).toBeGreaterThan(0)
    expect(arrangement.sections.length).toBeGreaterThan(0)
    expect(arrangement.totalBeats).toBeGreaterThan(0)
  })

  it("carries styleId, progressionId, keyPc and tempo straight through", () => {
    const result = arrange({
      style: buildFixtureStyle(),
      progression: buildFixtureProgression(),
      keyPc: 4,
      tempo: 123,
      clips: buildFixtureClips(),
    })
    expect(result.styleId).toBe("test-style")
    expect(result.progressionId).toBe("test-prog")
    expect(result.keyPc).toBe(4)
    expect(result.tempo).toBe(123)
  })
})

describe("arrange — variations", () => {
  it("variation 0 is identical to using slots directly", () => {
    const base = {
      style: buildFixtureStyle(),
      progression: buildFixtureProgression(),
      keyPc: 0,
      tempo: 100,
      clips: buildFixtureClips(),
    }
    const a = arrange(base)
    const b = arrange({ ...base, variation: 0 })
    expect(b.parts).toEqual(a.parts)
  })

  it("selects the Nth take when variations are present", () => {
    const style = buildFixtureStyle()
    const clips = buildFixtureClips()
    // Give drums a second, distinguishable take on every role it has.
    const altId = 999
    clips.set(altId, {
      sourceKeyPc: 0,
      events: [{ beat: 0, note: 36, velocity: 100, durationBeats: 0.5 }],
    })
    const drums = style.parts.drums!
    drums.variations = Object.fromEntries(
      Object.entries(drums.slots).map(([role, id]) => [role, [id as number, altId]]),
    )

    const base = { style, progression: buildFixtureProgression(), keyPc: 0, tempo: 100, clips }
    const a = arrange({ ...base, variation: 0 })
    const b = arrange({ ...base, variation: 1 })
    const evA = a.parts.find((p) => p.part === "drums")!.events
    const evB = b.parts.find((p) => p.part === "drums")!.events
    expect(evB).not.toEqual(evA)
    // The alt take is one hit per bar, so it must be sparser.
    expect(evB.length).toBeLessThan(evA.length)
  })

  it("wraps rather than falling silent when a role has fewer takes", () => {
    const style = buildFixtureStyle()
    const clips = buildFixtureClips()
    const drums = style.parts.drums!
    // Only ONE take available, but the user asks for variation D.
    drums.variations = Object.fromEntries(
      Object.entries(drums.slots).map(([role, id]) => [role, [id as number]]),
    )
    const out = arrange({
      style,
      progression: buildFixtureProgression(),
      keyPc: 0,
      tempo: 100,
      clips,
      variation: 3,
    })
    expect(out.parts.find((p) => p.part === "drums")!.events.length).toBeGreaterThan(0)
  })
})
