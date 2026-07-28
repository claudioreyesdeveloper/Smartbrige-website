import { describe, expect, it } from "vitest"
import type { ArrangementSection, ChartChord, LoopRange } from "@/lib/band-jam/engine/types"
import {
  isBarInLoop,
  isSectionLoopActive,
  primaryChordIndex,
  simplifyChordSymbol,
} from "@/components/band-jam/chord-chart"

// NOTE: @testing-library/react is not a dependency of this repo, so this
// file exercises only the exported pure helpers (symbol simplification and
// bar/loop math), not rendering or DOM interaction.

describe("simplifyChordSymbol", () => {
  it("collapses a major-seventh chord to a bare major triad", () => {
    expect(simplifyChordSymbol("CM7(9)")).toBe("C")
  })

  it("collapses a major-seventh slash chord, keeping the bass note", () => {
    expect(simplifyChordSymbol("FM7(9)/A")).toBe("F/A")
  })

  it("collapses a minor-seventh chord to a minor triad", () => {
    expect(simplifyChordSymbol("Am7(9)")).toBe("Am")
  })

  it("keeps a slash bass note plain (no extensions on the bass)", () => {
    expect(simplifyChordSymbol("CM7(9)/G")).toBe("C/G")
  })

  it("handles a plain dominant seventh as major", () => {
    expect(simplifyChordSymbol("G7")).toBe("G")
  })

  it("handles diminished chords", () => {
    expect(simplifyChordSymbol("Bdim7")).toBe("Bdim")
  })

  it("handles augmented chords", () => {
    expect(simplifyChordSymbol("Caug7")).toBe("Caug")
  })

  it("handles sus chords", () => {
    expect(simplifyChordSymbol("Dsus4")).toBe("Dsus4")
    expect(simplifyChordSymbol("Dsus2")).toBe("Dsus2")
  })

  it("handles flat/sharp roots", () => {
    expect(simplifyChordSymbol("Bbm7")).toBe("Bbm")
    expect(simplifyChordSymbol("F#M7")).toBe("F#")
  })

  it("does not mistake the major marker 'M' for minor", () => {
    // Regression: case-insensitive matching would wrongly read "M7" (major)
    // as minor because it starts with the letter M.
    expect(simplifyChordSymbol("EM7")).toBe("E")
    expect(simplifyChordSymbol("Em7")).toBe("Em")
  })
})

describe("primaryChordIndex", () => {
  it("picks the chord with the most beats", () => {
    const chords: ChartChord[] = [
      { symbol: "GM7(9)", beats: 3, root: 7 },
      { symbol: "CM7(9)/G", beats: 1, root: 0, bassRoot: 7 },
    ]
    expect(primaryChordIndex(chords)).toBe(0)
  })

  it("prefers the first chord on a tie", () => {
    const chords: ChartChord[] = [
      { symbol: "Am7", beats: 2, root: 9 },
      { symbol: "D7", beats: 2, root: 2 },
    ]
    expect(primaryChordIndex(chords)).toBe(0)
  })

  it("returns 0 for a single-chord bar", () => {
    const chords: ChartChord[] = [{ symbol: "C", beats: 4, root: 0 }]
    expect(primaryChordIndex(chords)).toBe(0)
  })
})

describe("isBarInLoop", () => {
  it("is false when there is no loop", () => {
    expect(isBarInLoop(5, null)).toBe(false)
  })

  it("is true for bars inside an inclusive range", () => {
    const loop: LoopRange = { startBar: 5, endBar: 8 }
    expect(isBarInLoop(5, loop)).toBe(true)
    expect(isBarInLoop(8, loop)).toBe(true)
    expect(isBarInLoop(6, loop)).toBe(true)
  })

  it("is false for bars outside the range", () => {
    const loop: LoopRange = { startBar: 5, endBar: 8 }
    expect(isBarInLoop(4, loop)).toBe(false)
    expect(isBarInLoop(9, loop)).toBe(false)
  })
})

describe("isSectionLoopActive", () => {
  const section: ArrangementSection = {
    role: "verse",
    label: "Verse (B)",
    startBar: 9,
    endBar: 16,
    bars: [],
  }

  it("is true when the loop exactly spans the section", () => {
    expect(isSectionLoopActive(section, { startBar: 9, endBar: 16 })).toBe(true)
  })

  it("is false when the loop is a sub-range of the section", () => {
    expect(isSectionLoopActive(section, { startBar: 9, endBar: 12 })).toBe(false)
  })

  it("is false when there is no loop", () => {
    expect(isSectionLoopActive(section, null)).toBe(false)
  })
})
