import type { ArrangerSection, StyleWireMapping } from "@/lib/yamaha/types"
import { sysex } from "@/lib/yamaha/protocol-utils"

const YAMAHA = 0x43

export function tempoCommand(bpm: number): Uint8Array {
  const value = Math.max(20, Math.min(300, Math.round(bpm))) * 10
  return sysex([YAMAHA, 0x7e, 0x00, 0x02, (value >> 7) & 0x7f, value & 0x7f])
}

/** F0 43 73 01 51 05 00 03 04 00 00 [b0] [b1] F7 — JamPlayerScreen / YamahaStyleSelection.h */
export function styleSelectCommand(mapping: StyleWireMapping): Uint8Array {
  return sysex([
    YAMAHA,
    0x73,
    0x01,
    0x51,
    0x05,
    0x00,
    0x03,
    0x04,
    0x00,
    0x00,
    mapping.bytes[0],
    mapping.bytes[1],
  ])
}

export const ARRANGER_COMMANDS = {
  start: sysex([YAMAHA, 0x60, 0x7a]),
  stop: sysex([YAMAHA, 0x60, 0x7d]),
  intro1: sysex([YAMAHA, 0x7e, 0x00, 0x00, 0x7f]),
  ending1: sysex([YAMAHA, 0x7e, 0x00, 0x20, 0x7f]),
  break: sysex([YAMAHA, 0x7e, 0x00, 0x18, 0x7f]),
  midiStart: Uint8Array.of(0xfa),
  midiStop: Uint8Array.of(0xfc),
  midiClock: Uint8Array.of(0xf8),
} as const

const MAIN_CODES: Record<ArrangerSection, number> = {
  A: 0x08,
  B: 0x09,
  C: 0x0a,
  D: 0x0b,
}

const FILL_CODES: Record<ArrangerSection, number> = {
  A: 0x10,
  B: 0x11,
  C: 0x12,
  D: 0x13,
}

export function mainCommand(section: ArrangerSection): Uint8Array {
  return sysex([YAMAHA, 0x7e, 0x00, MAIN_CODES[section], 0x7f])
}

export function fillCommand(section: ArrangerSection): Uint8Array {
  return sysex([YAMAHA, 0x7e, 0x00, FILL_CODES[section], 0x7f])
}

const ROOTS: Record<string, number> = {
  C: 0,
  "C#": 1,
  Db: 1,
  D: 2,
  "D#": 3,
  Eb: 3,
  E: 4,
  F: 5,
  "F#": 6,
  Gb: 6,
  G: 7,
  "G#": 8,
  Ab: 8,
  A: 9,
  "A#": 10,
  Bb: 10,
  B: 11,
}

function chordIntervals(quality: string): number[] {
  const q = quality.toLowerCase()
  if (q.includes("dim")) return [0, 3, 6]
  if (q.includes("aug") || q.includes("+")) return [0, 4, 8]
  if (q.includes("sus2")) return [0, 2, 7]
  if (q.includes("sus")) return [0, 5, 7]
  if (q.startsWith("m") && !q.startsWith("maj")) {
    if (q.includes("7")) return [0, 3, 7, 10]
    return [0, 3, 7]
  }
  if (q.includes("maj7") || q.includes("m7")) return [0, 4, 7, 11]
  if (q.includes("7")) return [0, 4, 7, 10]
  return [0, 4, 7]
}

export function chordNotes(chordName: string, baseNote = 36): number[] {
  const [head, slashBass] = chordName.trim().split("/")
  const match = head.match(/^([A-G](?:#|b)?)(.*)$/)
  if (!match) return []

  const root = ROOTS[match[1]]
  if (root === undefined) return []
  const notes = chordIntervals(match[2]).map((interval) => baseNote + root + interval)

  if (slashBass && ROOTS[slashBass] !== undefined) {
    let bass = baseNote + ROOTS[slashBass]
    while (bass >= notes[0]) bass -= 12
    notes.unshift(bass)
  }
  return [...new Set(notes)].filter((note) => note >= 0 && note <= 127)
}

export function chordOnMessages(chordName: string): Uint8Array[] {
  return chordNotes(chordName).map((note) => Uint8Array.of(0x93, note, 1))
}

export function chordOffMessages(notes: number[]): Uint8Array[] {
  return notes.map((note) => Uint8Array.of(0x83, note, 0))
}
