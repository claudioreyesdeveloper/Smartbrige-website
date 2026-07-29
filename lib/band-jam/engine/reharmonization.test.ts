import { describe, expect, it } from "vitest"
import {
  applyReharmonization,
  ORIGINAL_REHARM_STYLE,
} from "./reharmonization"
import type { Progression } from "./types"

const progression: Progression = {
  id: "desktop-parity",
  name: "Desktop parity",
  keyPc: 0,
  keyLabel: "C",
  reharmStyles: ["Basic", "Jazz", "Funk"],
  sections: [
    {
      role: "verse",
      label: "Verse Copy",
      bars: 1,
      styleVariation: "B",
      chords: [{ startBeat: 0, durationBeats: 4, root: 0, name: "Cmaj9" }],
      reharmonizations: [
        [1, [[0, 4, 0, "C"]]],
        [6, [[0, 2, 2, "Dm9"], [2, 2, 7, "G13", 11]]],
      ],
    },
    {
      role: "chorus",
      label: "Chorus",
      bars: 1,
      styleVariation: "D",
      chords: [{ startBeat: 0, durationBeats: 4, root: 5, name: "Fmaj7" }],
    },
  ],
}

describe("applyReharmonization", () => {
  it("keeps Original byte-for-byte and never changes performance metadata", () => {
    expect(applyReharmonization(progression, ORIGINAL_REHARM_STYLE)).toBe(
      progression,
    )
  })

  it("selects a named chord set by bitmask and preserves copied sections", () => {
    const jazz = applyReharmonization(progression, "Jazz")
    expect(jazz.sections).toHaveLength(2)
    expect(jazz.sections[0].label).toBe("Verse Copy")
    expect(jazz.sections[0].styleVariation).toBe("B")
    expect(jazz.sections[0].chords).toEqual([
      { startBeat: 0, durationBeats: 2, root: 2, name: "Dm9" },
      {
        startBeat: 2,
        durationBeats: 2,
        root: 7,
        name: "G13",
        bassRoot: 11,
      },
    ])
    expect(jazz.sections[1]).toBe(progression.sections[1])
  })

  it("falls back to Original for missing section variants", () => {
    const basic = applyReharmonization(progression, "Basic")
    expect(basic.sections[0].chords[0].name).toBe("C")
    expect(basic.sections[1]).toBe(progression.sections[1])
  })

  it("ignores a style that the song does not offer", () => {
    expect(applyReharmonization(progression, "Country")).toBe(progression)
  })
})
