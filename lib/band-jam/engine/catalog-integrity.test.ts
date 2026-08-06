import { describe, expect, it } from "vitest"
import { validateJamPlayerCatalog } from "@/lib/band-jam/engine/catalog-integrity"
import type { BandStyle, Progression } from "@/lib/band-jam/engine/types"

const progression: Progression = {
  id: "p1",
  name: "Progression",
  keyPc: 0,
  keyLabel: "C",
  sections: [
    {
      role: "verse",
      label: "Verse",
      bars: 1,
      chords: [{ startBeat: 0, durationBeats: 4, root: 0, name: "C" }],
    },
  ],
}

const style: BandStyle = {
  id: "funk",
  name: "Funk",
  tempoDefault: 110,
  tempoMin: 80,
  tempoMax: 140,
  parts: {
    drums: {
      instrument: "drums",
      gain: 1,
      harmonic: false,
      slots: { verse: 10 },
    },
  },
}

describe("validateJamPlayerCatalog", () => {
  it("reports missing generated clip references", () => {
    const issues = validateJamPlayerCatalog([style], [progression], new Map())
    expect(issues).toEqual([
      expect.objectContaining({ kind: "missing_clip", message: expect.stringContaining("10") }),
    ])
  })

  it("accepts a catalogue whose references resolve", () => {
    const clips = new Map([
      [10, { sourceKeyPc: 0, events: [] }],
    ])
    expect(validateJamPlayerCatalog([style], [progression], clips)).toEqual([])
  })
})
