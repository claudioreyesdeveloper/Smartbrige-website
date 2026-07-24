import { describe, expect, it } from "vitest"
import type { MidiEvent } from "@/lib/demo/style-midi"
import { resizeSectionSpan } from "@/lib/style-maker/replace-lanes"
import {
  donorSectionBars,
  loopNotesToTargetTicks,
  sectionTargetTicks,
} from "@/lib/style-maker/section-bars"

describe("section bars (desktop appendClipSmfLoopedAsBeats)", () => {
  it("computes donor bars and target ticks", () => {
    expect(
      donorSectionBars({ startTick: 0, endTick: 1920 }, 480),
    ).toBe(1)
    expect(
      donorSectionBars({ startTick: 0, endTick: 3840 }, 480),
    ).toBe(2)
    expect(sectionTargetTicks(4, 480)).toBe(7680)
  })

  it("loops a 2-bar take into 4 bars and truncates when shortening", () => {
    const notes = [
      { tick: 0, duration: 120, note: 36, velocity: 100 },
      { tick: 960, duration: 120, note: 38, velocity: 90 },
    ]
    const looped = loopNotesToTargetTicks(notes, 1920, 3840)
    expect(looped).toHaveLength(4)
    expect(looped[2]?.tick).toBe(1920)
    expect(looped[3]?.tick).toBe(2880)

    const truncated = loopNotesToTargetTicks(notes, 1920, 1000)
    expect(truncated).toHaveLength(2)
    expect(truncated[1]?.tick).toBe(960)
    expect(truncated[1]?.duration).toBe(40)
  })

  it("shifts later events when a section span grows", () => {
    const tracks: { endTick: number; events: MidiEvent[] }[] = [
      {
        endTick: 8000,
        events: [
          { tick: 100, order: 1, status: 0x90, data: [36, 100] },
          { tick: 4000, order: 2, status: 0x90, data: [40, 100] },
          { tick: 4000, order: 3, status: 0xff, data: [6] },
        ],
      },
    ]
    resizeSectionSpan(tracks, 0, 3840, 7680)
    expect(tracks[0].events[0]?.tick).toBe(100)
    expect(tracks[0].events[1]?.tick).toBe(7840)
    expect(tracks[0].events[2]?.tick).toBe(7840)
    expect(tracks[0].endTick).toBe(11840)
  })
})
