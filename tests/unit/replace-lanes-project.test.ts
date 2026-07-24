import { describe, expect, it } from "vitest"
import {
  extractStyleSections,
  parseYamahaStyle,
  patternToMidiNotes,
} from "@/lib/demo/style-midi"
import { StyleMakerLane } from "@/lib/style-maker/lanes"
import {
  isTemplatePerformanceMessageForReplacement,
  replaceStyleProjectProduct,
} from "@/lib/style-maker/replace-lanes"

const ascii = (value: string) => Array.from(new TextEncoder().encode(value))
const u32 = (value: number) => [
  (value >>> 24) & 0xff,
  (value >>> 16) & 0xff,
  (value >>> 8) & 0xff,
  value & 0xff,
]

describe("replaceStyleProjectProduct", () => {
  it("strips donor performance CC but keeps bank/volume/pan", () => {
    expect(
      isTemplatePerformanceMessageForReplacement({
        tick: 0,
        order: 0,
        status: 0x92,
        data: [40, 90],
      }),
    ).toBe(true)
    expect(
      isTemplatePerformanceMessageForReplacement({
        tick: 0,
        order: 0,
        status: 0xb2,
        data: [1, 64],
      }),
    ).toBe(true)
    expect(
      isTemplatePerformanceMessageForReplacement({
        tick: 0,
        order: 0,
        status: 0xb2,
        data: [0, 8],
      }),
    ).toBe(false)
    expect(
      isTemplatePerformanceMessageForReplacement({
        tick: 0,
        order: 0,
        status: 0xb2,
        data: [7, 100],
      }),
    ).toBe(false)
  })

  it("writes takes into every section that has assignments", () => {
    // No CASM → Bass falls back to styleChannel 11 (status nibble 0xA).
    const track = [
      0, 0xff, 0x06, 6, ...ascii("Main A"),
      0, 0xba, 0, 8, 0, 0xba, 32, 5, 0, 0xca, 17,
      0, 0xba, 1, 40,
      0, 0x9a, 40, 90, 96, 0x8a, 40, 0,
      0, 0xff, 0x06, 6, ...ascii("Main B"),
      0, 0xba, 1, 50,
      0, 0x9a, 43, 90, 96, 0x8a, 43, 0,
      0, 0xff, 0x2f, 0,
    ]
    const donor = parseYamahaStyle(
      Uint8Array.from([
        ...ascii("MThd"),
        0,
        0,
        0,
        6,
        0,
        0,
        0,
        1,
        0,
        96,
        ...ascii("MTrk"),
        ...u32(track.length),
        ...track,
      ]),
    )
    const sections = extractStyleSections(donor)
    const mainA = sections.find((section) => section.label === "Main A")!
    const mainB = sections.find((section) => section.label === "Main B")!
    const notesA = patternToMidiNotes([[0, 50, 0.5, 100]], donor.ticksPerQuarter)
    const notesB = patternToMidiNotes([[0, 55, 0.5, 100]], donor.ticksPerQuarter)

    const output = parseYamahaStyle(
      replaceStyleProjectProduct(donor, [
        {
          range: mainA,
          sectionLabel: "Main A",
          lanes: {
            [StyleMakerLane.Bass]: {
              notes: notesA,
              cycleTicks: donor.ticksPerQuarter * 4,
              sourceKind: "bass",
            },
          },
        },
        {
          range: mainB,
          sectionLabel: "Main B",
          lanes: {
            [StyleMakerLane.Bass]: {
              notes: notesB,
              cycleTicks: donor.ticksPerQuarter * 4,
              sourceKind: "bass",
            },
          },
        },
      ]),
    )

    const noteOns = output.tracks[0].events.filter(
      (event) => (event.status & 0xf0) === 0x90 && event.data[1] > 0,
    )
    expect(
      noteOns.some(
        (event) =>
          event.tick === 0 &&
          event.data[0] === 50 &&
          (event.status & 0x0f) === 10,
      ),
    ).toBe(true)
    expect(
      noteOns.some(
        (event) =>
          event.tick === 96 &&
          event.data[0] === 55 &&
          (event.status & 0x0f) === 10,
      ),
    ).toBe(true)
    expect(noteOns.some((event) => event.data[0] === 40)).toBe(false)
    expect(noteOns.some((event) => event.data[0] === 43)).toBe(false)

    // Bank select / program kept; modulation (CC1) stripped as performance.
    const bassChannelEvents = output.tracks[0].events.filter(
      (event) => (event.status & 0x0f) === 10,
    )
    expect(
      bassChannelEvents.some(
        (event) =>
          (event.status & 0xf0) === 0xb0 && event.data[0] === 0 && event.data[1] === 8,
      ),
    ).toBe(true)
    expect(
      bassChannelEvents.some(
        (event) => (event.status & 0xf0) === 0xb0 && event.data[0] === 1,
      ),
    ).toBe(false)
  })
})
