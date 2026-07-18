import { afterEach, describe, expect, it, vi } from "vitest"
import {
  extractStylePreviewEvents,
  parseYamahaStyle,
  patternToMidiNotes,
  replaceStyleLanes,
} from "@/lib/demo/style-midi"
import { StylePreviewPlayer } from "@/lib/demo/style-preview"
import type { YamahaMidiSession } from "@/lib/demo/yamaha/midi-session"
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
  afterEach(() => vi.useRealTimers())

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

  it("keeps native Yamaha style replacements on channels 9-16", () => {
    const track = [
      0, 0x99, 36, 90,
      96, 0x89, 36, 0,
      0, 0x9a, 40, 88,
      96, 0x8a, 40, 0,
      0, 0x9b, 60, 80,
      96, 0x8b, 60, 0,
      0, 0xff, 0x2f, 0,
    ]
    const source = Uint8Array.from([
      ...ascii("MThd"), 0, 0, 0, 6, 0, 0, 0, 1, 0, 96,
      ...ascii("MTrk"), ...u32(track.length), ...track,
    ])
    const donor = parseYamahaStyle(source)
    const notes = patternToMidiNotes([[0, 45, 0.5, 100]], donor.ticksPerQuarter)
    const output = parseYamahaStyle(replaceStyleLanes(donor, {
      drums: { notes, cycleTicks: donor.ticksPerQuarter * 4 },
      bass: { notes, cycleTicks: donor.ticksPerQuarter * 4 },
    }))
    const noteOns = output.tracks.flatMap((item) =>
      item.events.filter((event) => (event.status & 0xf0) === 0x90 && event.data[1] > 0),
    )
    expect(noteOns.some((event) => (event.status & 0x0f) === 8 && event.data[0] === 45)).toBe(true)
    expect(noteOns.some((event) => (event.status & 0x0f) === 10 && event.data[0] === 45)).toBe(true)
    expect(noteOns.some((event) => (event.status & 0x0f) < 8 && event.data[0] === 45)).toBe(false)
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

  it("routes style channels and voice setup exactly like the desktop engine", () => {
    const track = [
      0, 0xb2, 0, 8,
      0, 0xb2, 32, 10,
      0, 0xc2, 4,
      0, 0x92, 36, 90,
      96, 0x82, 36, 0,
      0, 0xff, 0x2f, 0,
    ]
    const source = Uint8Array.from([
      ...ascii("MThd"), 0, 0, 0, 6, 0, 0, 0, 1, 0, 96,
      ...ascii("MTrk"), ...u32(track.length), ...track,
    ])
    const events = extractStylePreviewEvents(parseYamahaStyle(source))
    expect(events.map((event) => event.status)).toEqual([0xba, 0xba, 0xca, 0x9a, 0x8a])
    expect(events[2].data).toEqual([4])

    vi.useFakeTimers()
    const port1 = vi.fn()
    const port2 = vi.fn()
    const session = {
      sendPort1: port1,
      sendPort2: port2,
      panic: vi.fn(),
    } as unknown as YamahaMidiSession
    new StylePreviewPlayer(session).play(events, 96, 120, 1)
    vi.advanceTimersByTime(1)

    expect(port2.mock.calls.map(([message]) => [...message])).toEqual([
      [0xf0, 0x43, 0x10, 0x4c, 0x08, 0x0a, 0x01, 8, 0xf7],
      [0xf0, 0x43, 0x10, 0x4c, 0x08, 0x0a, 0x02, 10, 0xf7],
      [0xf0, 0x43, 0x10, 0x4c, 0x08, 0x0a, 0x03, 4, 0xf7],
    ])
    expect([...port1.mock.calls[0][0]]).toEqual([0x9a, 36, 90])
  })
})
