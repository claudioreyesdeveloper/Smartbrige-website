import { describe, expect, it } from "vitest"
import {
  importSmf,
  exportSmf,
  midiDocumentsEqual,
  MIDI_CONTRACT_VERSION,
  sortMidiEvents,
  type CanonicalMidiDocument,
} from "@/lib/midi"

const ascii = (value: string) => Array.from(new TextEncoder().encode(value))
const u32 = (value: number) => [
  (value >>> 24) & 0xff,
  (value >>> 16) & 0xff,
  (value >>> 8) & 0xff,
  value & 0xff,
]

function buildSmf(
  format: number,
  division: number,
  tracks: number[][],
): Uint8Array {
  return Uint8Array.from([
    ...ascii("MThd"),
    0, 0, 0, 6,
    (format >> 8) & 0xff,
    format & 0xff,
    (tracks.length >> 8) & 0xff,
    tracks.length & 0xff,
    (division >> 8) & 0xff,
    division & 0xff,
    ...tracks.flatMap((track) => [
      ...ascii("MTrk"),
      ...u32(track.length),
      ...track,
    ]),
  ])
}

function withoutEndOfTrack(document: CanonicalMidiDocument): CanonicalMidiDocument {
  return {
    ...document,
    tracks: document.tracks.map((track) => ({
      endTick: track.endTick,
      events: track.events.filter(
        (event) => !(event.kind === "meta" && event.metaType === 0x2f),
      ),
    })),
  }
}

function expectRoundTripParity(source: Uint8Array) {
  const imported = importSmf(source)
  const exported = exportSmf(imported)
  const roundTripped = importSmf(exported)
  expect(midiDocumentsEqual(withoutEndOfTrack(imported), withoutEndOfTrack(roundTripped))).toBe(true)
}

describe("canonical MIDI contract", () => {
  it("tags imported documents with the contract version", () => {
    const source = buildSmf(0, 480, [[0, 0xff, 0x2f, 0]])
    expect(importSmf(source).version).toBe(MIDI_CONTRACT_VERSION)
  })

  it("sorts same-tick events deterministically by sequence", () => {
    const document = importSmf(buildSmf(0, 96, [[
      0, 0xb0, 0x07, 100,
      0, 0x90, 60, 80,
      0, 0x80, 60, 0,
      0, 0xff, 0x2f, 0,
    ]]))
    const ordered = sortMidiEvents(document.tracks[0].events)
    expect(ordered.map((event) => event.sequence)).toEqual([0, 1, 2, 3])
    expect(ordered.map((event) =>
      event.kind === "channel" ? event.status : event.kind,
    )).toEqual([0xb0, 0x90, 0x80, "meta"])
  })
})

describe("SMF round-trip fixtures", () => {
  it("preserves note-on and note-off status bytes separately", () => {
    const source = buildSmf(0, 96, [[
      0, 0x90, 60, 80,
      48, 0x80, 60, 64,
      0, 0x91, 62, 70,
      48, 0x91, 62, 0,
      0, 0xff, 0x2f, 0,
    ]])
    const document = importSmf(source)
    const channelEvents = document.tracks[0].events.filter((event) => event.kind === "channel")
    expect(channelEvents.map((event) => event.status)).toEqual([0x90, 0x80, 0x91, 0x91])
    expect(channelEvents[3].kind === "channel" && channelEvents[3].data).toEqual([62, 0])
    expectRoundTripParity(source)
  })

  it("preserves control changes, program changes, and pitch bend", () => {
    const source = buildSmf(0, 480, [[
      0, 0xb2, 7, 100,
      0, 0xb2, 10, 64,
      0, 0xc2, 5,
      0, 0xe2, 0, 64,
      0, 0xff, 0x2f, 0,
    ]])
    const document = importSmf(source)
    const channelEvents = document.tracks[0].events.filter((event) => event.kind === "channel")
    expect(channelEvents.map((event) => [event.status, ...event.data])).toEqual([
      [0xb2, 7, 100],
      [0xb2, 10, 64],
      [0xc2, 5],
      [0xe2, 0, 64],
    ])
    expectRoundTripParity(source)
  })

  it("preserves SysEx payloads for F0 and F7 events", () => {
    const source = buildSmf(0, 96, [[
      0, 0xf0, 4, 0x7e, 0x7f, 0x06, 0x01,
      0, 0xf7, 2, 0x43, 0x10,
      0, 0xff, 0x2f, 0,
    ]])
    const document = importSmf(source)
    const sysexEvents = document.tracks[0].events.filter((event) => event.kind === "sysex")
    expect(sysexEvents.map((event) => [event.status, ...event.data])).toEqual([
      [0xf0, 0x7e, 0x7f, 0x06, 0x01],
      [0xf7, 0x43, 0x10],
    ])
    expectRoundTripParity(source)
  })

  it("preserves meta events needed for tempo and markers", () => {
    const source = buildSmf(0, 480, [[
      0, 0xff, 0x03, 8, ...ascii("Melody 1"),
      0, 0xff, 0x51, 3, 0x07, 0xa1, 0x20,
      0, 0xff, 0x06, 5, ...ascii("Intro"),
      0, 0xff, 0x2f, 0,
    ]])
    const document = importSmf(source)
    const metaEvents = document.tracks[0].events.filter((event) => event.kind === "meta")
    expect(metaEvents.map((event) => event.metaType)).toEqual([0x03, 0x51, 0x06, 0x2f])
    expect(new TextDecoder().decode(metaEvents[0].data)).toBe("Melody 1")
    expect([...metaEvents[1].data]).toEqual([0x07, 0xa1, 0x20])
    expect(new TextDecoder().decode(metaEvents[2].data)).toBe("Intro")
    expectRoundTripParity(source)
  })

  it("preserves event order under running status encoding", () => {
    const source = buildSmf(0, 96, [[
      0, 0x90, 60, 80,
      0, 62, 76,
      48, 0x80, 60, 0,
      0, 62, 0,
      0, 0xff, 0x2f, 0,
    ]])
    const document = importSmf(source)
    const notes = document.tracks[0].events.filter((event) => event.kind === "channel")
    expect(notes.map((event) =>
      event.kind === "channel" ? [event.status, ...event.data] : null,
    )).toEqual([
      [0x90, 60, 80],
      [0x90, 62, 76],
      [0x80, 60, 0],
      [0x80, 62, 0],
    ])
    expectRoundTripParity(source)
  })

  it("round-trips a multi-track format-1 file", () => {
    const source = buildSmf(1, 480, [
      [
        0, 0xff, 0x03, 9, ...ascii("Conductor"),
        0, 0xff, 0x2f, 0,
      ],
      [
        0, 0xc0, 4,
        0, 0x90, 48, 90,
        96, 0x80, 48, 0,
        0, 0xff, 0x2f, 0,
      ],
    ])
    const document = importSmf(source)
    expect(document.format).toBe(1)
    expect(document.tracks).toHaveLength(2)
    expect(document.tracks[0].events.some((event) =>
      event.kind === "meta" && event.metaType === 0x03,
    )).toBe(true)
    expect(document.tracks[1].events.some((event) =>
      event.kind === "channel" && event.status === 0xc0,
    )).toBe(true)
    expectRoundTripParity(source)
  })

  it("rejects SMPTE division and trailing bytes", () => {
    const smpte = buildSmf(0, 0x8000, [[0, 0xff, 0x2f, 0]])
    expect(() => importSmf(smpte)).toThrow(/SMPTE/)

    const withTail = Uint8Array.from([
      ...buildSmf(0, 96, [[0, 0xff, 0x2f, 0]]),
      0x43, 0x41, 0x53, 0x4d,
    ])
    expect(() => importSmf(withTail)).toThrow(/trailing bytes/)
  })
})
