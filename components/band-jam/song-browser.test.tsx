import { describe, expect, it } from "vitest"
import type { Progression } from "@/lib/band-jam/engine/types"
import {
  filterSongs,
  mapToJamPlayerCategory,
  progressionTimeSignature,
  songDisplayLabel,
} from "@/components/band-jam/song-browser"

const song = (overrides: Partial<Progression>): Progression => ({
  id: "song",
  name: "Market",
  keyPc: 5,
  keyLabel: "Fm",
  tempo: 95,
  category: "New",
  timeSignature: "4/4",
  sections: [],
  ...overrides,
})

describe("desktop JamPlayer song filtering", () => {
  it("maps source categories to the desktop JamPlayer groups", () => {
    expect(mapToJamPlayerCategory("New")).toBe("Pop")
    expect(mapToJamPlayerCategory("Dance & Electronic")).toBe("Dance")
    expect(mapToJamPlayerCategory("Blues")).toBe("Swing&Jazz")
    expect(mapToJamPlayerCategory("Funk")).toBe("R&B")
    expect(mapToJamPlayerCategory("Reggae")).toBe("World")
    expect(mapToJamPlayerCategory("unknown import")).toBe("User")
  })

  it("combines category, tonality, tempo and meter as AND filters", () => {
    const rows = [
      song({ id: "match" }),
      song({ id: "major", keyLabel: "F" }),
      song({ id: "fast", tempo: 140 }),
      song({ id: "waltz", timeSignature: "3/4" }),
      song({ id: "rock", category: "Rock" }),
    ]
    expect(
      filterSongs(rows, {
        category: "Pop",
        tonality: "minor",
        tempoBand: "medium",
        timeSignature: "4/4",
      }).map((p) => p.id),
    ).toEqual(["match"])
  })

  it("uses the desktop tempo boundaries", () => {
    const rows = [song({ id: "89", tempo: 89 }), song({ id: "90", tempo: 90 }), song({ id: "130", tempo: 130 }), song({ id: "131", tempo: 131 })]
    expect(filterSongs(rows, { category: "", tonality: "any", tempoBand: "slow", timeSignature: "" }).map((p) => p.id)).toEqual(["89"])
    expect(filterSongs(rows, { category: "", tonality: "any", tempoBand: "medium", timeSignature: "" }).map((p) => p.id)).toEqual(["90", "130"])
    expect(filterSongs(rows, { category: "", tonality: "any", tempoBand: "fast", timeSignature: "" }).map((p) => p.id)).toEqual(["131"])
  })

  it("defaults legacy songs to 4/4 and formats the desktop-style label", () => {
    const legacy = song({ timeSignature: undefined, reharmStyles: ["Jazz"] })
    expect(progressionTimeSignature(legacy)).toBe("4/4")
    expect(songDisplayLabel(legacy)).toBe("New - Market (95 bpm + Fm + 4/4) R")
  })
})
