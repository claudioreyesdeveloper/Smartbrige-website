import { describe, expect, it } from "vitest"
import { readFileSync } from "fs"
import {
  auditionChordForPreview,
  clampMidiChannel,
  DEFAULT_AUDITION_CHANNELS,
  extractClipAuditionEvents,
  notesToAuditionEvents,
  laneSupportsMinorTake,
  sectionSupportsMinorPreview,
} from "@/lib/style-maker/audition"
import { StyleMakerLane } from "@/lib/style-maker/lanes"
import {
  displaySectionNameFromMarker,
  yamahaTemplateSectionName,
} from "@/lib/style-maker/section-names"

describe("style maker audition", () => {
  it("uses live Tyros defaults for bass/drums/guitar", () => {
    expect(DEFAULT_AUDITION_CHANNELS.drums).toBe(10)
    expect(DEFAULT_AUDITION_CHANNELS.bass).toBe(11)
    expect(DEFAULT_AUDITION_CHANNELS.guitar).toBe(12)
  })

  it("clamps audition channels to 1–16", () => {
    expect(clampMidiChannel(0)).toBe(1)
    expect(clampMidiChannel(99)).toBe(16)
    expect(clampMidiChannel(11)).toBe(11)
  })

  it("remaps clip notes onto the chosen audition channel", () => {
    const events = notesToAuditionEvents(
      [{ tick: 0, duration: 100, note: 36, velocity: 90 }],
      11,
    )
    expect(events).toHaveLength(2)
    expect(events[0].status).toBe(0x90 | 10)
    expect(events[0].data).toEqual([36, 90])
    expect(events[1].status).toBe(0x80 | 10)
  })

  it("gates Preview Minor to Intro/Ending and picks C vs Am", () => {
    expect(sectionSupportsMinorPreview("Intro 1")).toBe(true)
    expect(sectionSupportsMinorPreview("Ending 2")).toBe(true)
    expect(sectionSupportsMinorPreview("Main A")).toBe(false)
    expect(auditionChordForPreview(false)).toBe("C")
    expect(auditionChordForPreview(true)).toBe("Am")
  })

  it("shows MAJ/MIN boxes on Intro/Ending pitched lanes like desktop", () => {
    expect(
      laneSupportsMinorTake("Intro 1", StyleMakerLane.Bass, new Uint8Array()),
    ).toBe(true)
    expect(
      laneSupportsMinorTake("Ending 1", StyleMakerLane.Chord1, null),
    ).toBe(true)
    expect(
      laneSupportsMinorTake("Intro 1", StyleMakerLane.Rhythm1, null),
    ).toBe(false)
    expect(
      laneSupportsMinorTake("Main A", StyleMakerLane.Bass, null),
    ).toBe(false)
  })

  it("maps Intro 1 / Ending 2 / Fill A to Yamaha CASM marker names", () => {
    expect(yamahaTemplateSectionName("Intro 1")).toBe("Intro A")
    expect(yamahaTemplateSectionName("Intro 2")).toBe("Intro B")
    expect(yamahaTemplateSectionName("Ending 3")).toBe("Ending C")
    expect(yamahaTemplateSectionName("Fill A")).toBe("Fill In AA")
    expect(yamahaTemplateSectionName("Intro A")).toBe("Intro A")
    expect(displaySectionNameFromMarker("Intro B")).toBe("Intro 2")
    expect(displaySectionNameFromMarker("Fill In BB")).toBe("Fill B")
    expect(displaySectionNameFromMarker("Ending A")).toBe("Ending 1")
  })

  it("extracts library clip audition events with CC remapped to output channel", () => {
    const bytes = new Uint8Array(readFileSync("/tmp/sb-clip.mid"))
    const { events, ticksPerQuarter, barCount } = extractClipAuditionEvents(bytes, 11)
    expect(ticksPerQuarter).toBe(960)
    expect(barCount).toBeGreaterThanOrEqual(1)
    expect(events.length).toBeGreaterThan(0)
    expect(events.every((event) => (event.status & 0x0f) === 10)).toBe(true)
    expect(events.some((event) => (event.status & 0xf0) === 0x90)).toBe(true)
  })
})
