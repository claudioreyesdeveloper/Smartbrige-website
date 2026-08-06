import { describe, expect, it } from "vitest"
import type { BandPart, PartMixState } from "@/lib/band-jam/engine/types"
import {
  effectivePartMuted,
  elapsedBeatsForAudioTime,
} from "@/lib/band-jam/engine/playback-state"

const mix: Record<BandPart, PartMixState> = {
  drums: { volume: 1, muted: false },
  bass: { volume: 1, muted: true },
  guitar: { volume: 0.8, muted: false },
  keys: { volume: 0.75, muted: false },
  solo: { volume: 0.8, muted: true },
}

describe("effectivePartMuted", () => {
  it("uses the saved mute state when no part is soloed", () => {
    expect(effectivePartMuted("bass", mix, null)).toBe(true)
    expect(effectivePartMuted("guitar", mix, null)).toBe(false)
  })

  it("uses the same solo mask for every playback sink", () => {
    expect(effectivePartMuted("guitar", mix, "guitar")).toBe(false)
    expect(effectivePartMuted("drums", mix, "guitar")).toBe(true)
    expect(effectivePartMuted("bass", mix, "guitar")).toBe(true)
  })
})

describe("elapsedBeatsForAudioTime", () => {
  it("counts elapsed beats independently of a folded loop playhead", () => {
    expect(elapsedBeatsForAudioTime(10, 12, 120, false)).toBe(4)
  })

  it("does not count the first sample, count-in, or backwards time", () => {
    expect(elapsedBeatsForAudioTime(null, 12, 120, false)).toBe(0)
    expect(elapsedBeatsForAudioTime(10, 12, 120, true)).toBe(0)
    expect(elapsedBeatsForAudioTime(12, 10, 120, false)).toBe(0)
  })
})
