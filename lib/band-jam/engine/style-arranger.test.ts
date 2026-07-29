import { describe, expect, it } from "vitest"
import {
  applySectionPartPlan,
  arrangerRoleForSection,
  buildDefaultStyleArranger,
} from "@/lib/band-jam/engine/style-arranger"
import type { Arrangement, BandStyle } from "@/lib/band-jam/engine/types"

const style: BandStyle = {
  id: "pop",
  name: "Pop",
  tempoDefault: 110,
  tempoMin: 70,
  tempoMax: 150,
  parts: {
    drums: { instrument: "drums", gain: 1, harmonic: false, slots: {} },
    bass: { instrument: "bass", gain: 1, harmonic: true, slots: {} },
    guitar: { instrument: "guitar", gain: 1, harmonic: true, slots: {} },
    keys: { instrument: "keys", gain: 1, harmonic: true, slots: {} },
  },
  disabledPartsByVariation: [["keys"], null, null, null],
}

const arrangement: Arrangement = {
  styleId: "pop",
  progressionId: "song",
  keyPc: 0,
  tempo: 110,
  totalBars: 4,
  totalBeats: 16,
  sections: [
    { role: "intro", label: "Intro", bars: [], startBar: 1, endBar: 2 },
    { role: "verse", label: "Verse", bars: [], startBar: 3, endBar: 4 },
  ],
  parts: ["drums", "bass", "guitar", "keys"].map((part) => ({
    part: part as "drums" | "bass" | "guitar" | "keys",
    events: [
      { beat: 1, note: 60, velocity: 90, durationBeats: 0.5 },
      { beat: 9, note: 62, velocity: 90, durationBeats: 0.5 },
    ],
  })),
}

describe("style arranger", () => {
  it("uses the desktop Main A-D meaning for legacy generic sections", () => {
    expect(arrangerRoleForSection("section", "A")).toBe("verse")
    expect(arrangerRoleForSection("section", "B")).toBe("intro")
    expect(arrangerRoleForSection("section", "C")).toBe("pre_chorus")
    expect(arrangerRoleForSection("section", "D")).toBe("chorus")
    expect(arrangerRoleForSection("verse", "D")).toBe("verse")
  })

  it("builds separate A-D defaults and honours variation-specific silence", () => {
    const state = buildDefaultStyleArranger(style, 4)
    expect(state).toHaveLength(4)
    expect(state[0].intro.keys).toBe(false)
    expect(state[1].intro.keys).toBe(true)
    expect(state[0].verse.drums).toBe(true)
  })

  it("orchestrates each section without changing note timing", () => {
    const plan = buildDefaultStyleArranger(style, 4)[1]
    for (const part of ["bass", "keys"] as const) plan.intro[part] = false
    for (const part of ["drums", "guitar"] as const) plan.verse[part] = false

    const result = applySectionPartPlan(arrangement, plan)
    expect(result.parts.find((part) => part.part === "drums")?.events.map((e) => e.beat)).toEqual([1])
    expect(result.parts.find((part) => part.part === "guitar")?.events.map((e) => e.beat)).toEqual([1])
    expect(result.parts.find((part) => part.part === "bass")?.events.map((e) => e.beat)).toEqual([9])
    expect(result.parts.find((part) => part.part === "keys")?.events.map((e) => e.beat)).toEqual([9])
  })

  it("removes a completely silent part from playback", () => {
    const plan = buildDefaultStyleArranger(style, 4)[1]
    plan.intro.guitar = false
    plan.verse.guitar = false
    expect(applySectionPartPlan(arrangement, plan).parts.some((part) => part.part === "guitar")).toBe(false)
  })

  it("applies a generic section through its saved desktop variation role", () => {
    const generic: Arrangement = {
      ...arrangement,
      sections: [
        {
          role: "section",
          label: "Main C",
          styleVariation: "C",
          bars: [],
          startBar: 1,
          endBar: 4,
        },
      ],
    }
    const plan = buildDefaultStyleArranger(style, 4)[2]
    plan.pre_chorus.guitar = false
    const result = applySectionPartPlan(generic, plan)
    expect(result.parts.some((part) => part.part === "guitar")).toBe(false)
    expect(result.parts.some((part) => part.part === "drums")).toBe(true)
  })
})
