import { describe, expect, it } from "vitest"
import {
  parseYamahaStyle,
  patternToMidiNotes,
  replaceStyleLanes,
} from "@/lib/demo/style-midi"
import { createStylePreviewRegistration } from "@/lib/demo/yamaha/registration"

const ascii = (value: string) => Array.from(new TextEncoder().encode(value))
const u32 = (value: number) => [
  (value >>> 24) & 0xff,
  (value >>> 16) & 0xff,
  (value >>> 8) & 0xff,
  value & 0xff,
]

function donorFixture() {
  const track = [
    0, 0x90, 36, 90,
    96, 0x80, 36, 0,
    0, 0x93, 60, 80,
    96, 0x83, 60, 0,
    0, 0xff, 0x2f, 0,
  ]
  const tail = [...ascii("CASM"), 0, 0, 0, 4, 1, 2, 3, 4, ...ascii("OTSc")]
  return Uint8Array.from([
    ...ascii("MThd"),
    0, 0, 0, 6,
    0, 0,
    0, 1,
    0, 96,
    ...ascii("MTrk"),
    ...u32(track.length),
    ...track,
    ...tail,
  ])
}

describe("Yamaha style editing", () => {
  it("parses native tail chunks and preserves them exactly after lane replacement", () => {
    const source = donorFixture()
    const donor = parseYamahaStyle(source)
    expect(new TextDecoder().decode(donor.yamahaTail.slice(0, 4))).toBe("CASM")

    const notes = patternToMidiNotes([[0, 40, 0.5, 100]], donor.ticksPerQuarter)
    const output = replaceStyleLanes(donor, {
      drums: { notes, cycleTicks: donor.ticksPerQuarter * 4 },
      bass: { notes, cycleTicks: donor.ticksPerQuarter * 4 },
    })
    const reparsed = parseYamahaStyle(output)
    expect([...reparsed.yamahaTail]).toEqual([...donor.yamahaTail])

    const noteOns = reparsed.tracks.flatMap((track) =>
      track.events.filter((event) => (event.status & 0xf0) === 0x90 && event.data[1] > 0),
    )
    expect(noteOns.some((event) => (event.status & 0x0f) === 0 && event.data[0] === 40)).toBe(true)
    expect(noteOns.some((event) => (event.status & 0x0f) === 2 && event.data[0] === 40)).toBe(true)
    expect(noteOns.some((event) => (event.status & 0x0f) === 3 && event.data[0] === 60)).toBe(true)
    expect(noteOns.some((event) => (event.status & 0x0f) === 0 && event.data[0] === 36)).toBe(false)
  })

  it("generates the verified YRGN/SLOT/STYL registration layout", () => {
    const registration = createStylePreviewRegistration("0:\\STYLE\\Demo.prs")
    const text = new TextDecoder().decode(registration)
    expect(text.startsWith("YRGN")).toBe(true)
    expect(text.includes("SLOT")).toBe(true)
    expect(text.includes("STYL")).toBe(true)
    expect(text.includes("0:\\STYLE\\Demo.prs")).toBe(true)
    expect(text.endsWith("ENDR")).toBe(true)
  })
})
