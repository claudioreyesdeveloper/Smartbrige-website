import { describe, expect, it } from "vitest"
import {
  exportRecordedStyleMidi,
  filterAndRenumberSectionCapture,
  renumberedCaptureToLaneNotes,
  STYLE_CHANNEL_NAMES,
} from "@/lib/demo/recorded-style-export"
import type { CapturedMidiEvent } from "@/lib/demo/style-capture"
import {
  extractStyleSections,
  parseYamahaStyle,
  replaceStyleSectionLanes,
} from "@/lib/demo/style-midi"

const ascii = (value: string) => Array.from(new TextEncoder().encode(value))
const u32 = (value: number) => [
  (value >>> 24) & 0xff,
  (value >>> 16) & 0xff,
  (value >>> 8) & 0xff,
  value & 0xff,
]

describe("section record golden-master ports", () => {
  it("filters to enabled ch 9-16 and renumbers 9→1 … 16→8 (notes only)", () => {
    const events: CapturedMidiEvent[] = [
      { timeSeconds: 0, status: 0x99, data: [36, 100] }, // ch 10 note on
      { timeSeconds: 0.1, status: 0x89, data: [36, 0] },
      { timeSeconds: 0.2, status: 0x9a, data: [40, 90] }, // ch 11
      { timeSeconds: 0.3, status: 0x8a, data: [40, 0] },
      { timeSeconds: 0.4, status: 0x90, data: [60, 80] }, // ch 1 ignored
      { timeSeconds: 0.5, status: 0xb9, data: [7, 100] }, // CC dropped by default
    ]
    const enabled = [true, true, true, true, true, true, true, true]
    const filtered = filterAndRenumberSectionCapture(events, enabled, false)
    expect(filtered).toHaveLength(4)
    expect(filtered[0].channel).toBe(2) // 10→2
    expect(filtered[0].status & 0x0f).toBe(1)
    expect(filtered[2].channel).toBe(3) // 11→3
  })

  it("exports multi-track MIDI with desktop track names", () => {
    const events = filterAndRenumberSectionCapture(
      [
        { timeSeconds: 0, status: 0x98, data: [36, 100] },
        { timeSeconds: 0.25, status: 0x88, data: [36, 0] },
        { timeSeconds: 0, status: 0x9a, data: [40, 90] },
        { timeSeconds: 0.25, status: 0x8a, data: [40, 0] },
      ],
      [true, true, true, true, true, true, true, true],
    )
    const bytes = exportRecordedStyleMidi(events, {
      bpm: 120,
      songName: "Main A",
    })
    expect(String.fromCharCode(...bytes.slice(0, 4))).toBe("MThd")
    const text = new TextDecoder().decode(bytes)
    expect(text).toContain(`${STYLE_CHANNEL_NAMES[0]} - Main A`)
    expect(text).toContain(`${STYLE_CHANNEL_NAMES[2]} - Main A`)
  })

  it("converts renumbered capture into per-lane MidiNotes", () => {
    const events = filterAndRenumberSectionCapture(
      [
        { timeSeconds: 0, status: 0x98, data: [36, 100] },
        { timeSeconds: 0.5, status: 0x88, data: [36, 0] },
      ],
      [true, true, true, true, true, true, true, true],
    )
    const lanes = renumberedCaptureToLaneNotes(events, 120)
    expect(lanes[0].length).toBe(1)
    expect(lanes[0][0].note).toBe(36)
    expect(lanes[0][0].tick).toBe(0)
  })

  it("writes all eight lanes into a section while preserving the Yamaha tail", () => {
    const track = [
      0, 0xff, 0x06, 6, ...ascii("Main A"),
      0, 0x99, 36, 80,
      96, 0x89, 36, 0,
      0, 0xff, 0x06, 6, ...ascii("Main B"),
      0, 0x99, 38, 80,
      96, 0x89, 38, 0,
      0, 0xff, 0x2f, 0,
    ]
    const tail = [...ascii("CASM"), 0, 0, 0, 4, 9, 8, 7, 6]
    const source = Uint8Array.from([
      ...ascii("MThd"), 0, 0, 0, 6, 0, 0, 0, 1, 0, 96,
      ...ascii("MTrk"), ...u32(track.length), ...track, ...tail,
    ])
    const style = parseYamahaStyle(source)
    const mainA = extractStyleSections(style).find((section) => /Main A/i.test(section.label))
    expect(mainA).toBeTruthy()

    const lanes: Partial<
      Record<number, { notes: { tick: number; duration: number; note: number; velocity: number }[]; cycleTicks: number }>
    > = {}
    for (let index = 0; index < 8; index += 1) {
      lanes[index] = {
        notes: [{ tick: 0, duration: 48, note: 40 + index, velocity: 100 }],
        cycleTicks: 96,
      }
    }
    const output = replaceStyleSectionLanes(style, { range: mainA, lanes })
    const reparsed = parseYamahaStyle(output)
    expect([...reparsed.yamahaTail]).toEqual([...style.yamahaTail])
    const noteOns = reparsed.tracks.flatMap((trackItem) =>
      trackItem.events.filter(
        (event) =>
          (event.status & 0xf0) === 0x90 &&
          event.data[1] > 0 &&
          event.tick >= (mainA?.startTick || 0) &&
          event.tick < (mainA?.endTick || 0),
      ),
    )
    for (let index = 0; index < 8; index += 1) {
      expect(
        noteOns.some(
          (event) =>
            (event.status & 0x0f) === 8 + index && event.data[0] === 40 + index,
        ),
      ).toBe(true)
    }
  })
})
