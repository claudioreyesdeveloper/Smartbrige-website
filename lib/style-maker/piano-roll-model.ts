/**
 * Pure helpers for Style Maker lane piano-roll editing.
 */

import type { MidiNote } from "@/lib/demo/style-midi"

export type PianoRollNote = MidiNote & { id: string }

export type SnapDivision = "1/4" | "1/8" | "1/16" | "1/32" | "off"

export const SNAP_OPTIONS: SnapDivision[] = [
  "1/4",
  "1/8",
  "1/16",
  "1/32",
  "off",
]

let noteIdCounter = 0

export function nextNoteId(): string {
  noteIdCounter += 1
  return `n${noteIdCounter}`
}

export function cloneNotesWithIds(notes: MidiNote[]): PianoRollNote[] {
  return notes.map((note) => ({
    ...note,
    id: nextNoteId(),
  }))
}

export function stripNoteIds(notes: PianoRollNote[]): MidiNote[] {
  return notes.map(({ tick, duration, note, velocity }) => ({
    tick,
    duration,
    note,
    velocity,
  }))
}

export function snapGridTicks(ticksPerQuarter: number, snap: SnapDivision): number {
  const tpq = Math.max(1, ticksPerQuarter)
  switch (snap) {
    case "1/4":
      return tpq
    case "1/8":
      return Math.max(1, Math.round(tpq / 2))
    case "1/16":
      return Math.max(1, Math.round(tpq / 4))
    case "1/32":
      return Math.max(1, Math.round(tpq / 8))
    case "off":
      return 1
  }
}

export function snapTicks(
  tick: number,
  ticksPerQuarter: number,
  snap: SnapDivision,
): number {
  const grid = snapGridTicks(ticksPerQuarter, snap)
  if (grid <= 1) return Math.max(0, Math.round(tick))
  return Math.max(0, Math.round(tick / grid) * grid)
}

export function clampPitch(note: number): number {
  return Math.max(0, Math.min(127, Math.round(note)))
}

export function clampVelocity(velocity: number): number {
  return Math.max(1, Math.min(127, Math.round(velocity)))
}

export function clampDuration(duration: number, min = 1): number {
  return Math.max(min, Math.round(duration))
}

export function moveNotes(
  notes: PianoRollNote[],
  selectedIds: ReadonlySet<string>,
  deltaTick: number,
  deltaPitch: number,
  cycleTicks: number,
): PianoRollNote[] {
  if (!selectedIds.size || (!deltaTick && !deltaPitch)) return notes
  return notes.map((note) => {
    if (!selectedIds.has(note.id)) return note
    const nextTick = Math.max(0, note.tick + deltaTick)
    const maxStart = Math.max(0, cycleTicks - 1)
    return {
      ...note,
      tick: Math.min(maxStart, nextTick),
      note: clampPitch(note.note + deltaPitch),
      duration: Math.min(note.duration, Math.max(1, cycleTicks - Math.min(maxStart, nextTick))),
    }
  })
}

export function resizeNotes(
  notes: PianoRollNote[],
  selectedIds: ReadonlySet<string>,
  deltaDuration: number,
  cycleTicks: number,
): PianoRollNote[] {
  if (!selectedIds.size || !deltaDuration) return notes
  return notes.map((note) => {
    if (!selectedIds.has(note.id)) return note
    const maxDur = Math.max(1, cycleTicks - note.tick)
    return {
      ...note,
      duration: Math.min(maxDur, clampDuration(note.duration + deltaDuration)),
    }
  })
}

export function quantizeNoteStarts(
  notes: PianoRollNote[],
  selectedIds: ReadonlySet<string>,
  ticksPerQuarter: number,
  snap: SnapDivision,
  cycleTicks: number,
): PianoRollNote[] {
  if (snap === "off" || !selectedIds.size) return notes
  return notes.map((note) => {
    if (!selectedIds.has(note.id)) return note
    const tick = Math.min(
      Math.max(0, cycleTicks - 1),
      snapTicks(note.tick, ticksPerQuarter, snap),
    )
    return {
      ...note,
      tick,
      duration: Math.min(note.duration, Math.max(1, cycleTicks - tick)),
    }
  })
}

export function setNotesVelocity(
  notes: PianoRollNote[],
  selectedIds: ReadonlySet<string>,
  velocity: number,
): PianoRollNote[] {
  if (!selectedIds.size) return notes
  const vel = clampVelocity(velocity)
  return notes.map((note) =>
    selectedIds.has(note.id) ? { ...note, velocity: vel } : note,
  )
}

export function deleteNotes(
  notes: PianoRollNote[],
  selectedIds: ReadonlySet<string>,
): PianoRollNote[] {
  if (!selectedIds.size) return notes
  return notes.filter((note) => !selectedIds.has(note.id))
}

export function createNote(
  tick: number,
  pitch: number,
  duration: number,
  velocity = 100,
): PianoRollNote {
  return {
    id: nextNoteId(),
    tick: Math.max(0, Math.round(tick)),
    note: clampPitch(pitch),
    duration: clampDuration(duration),
    velocity: clampVelocity(velocity),
  }
}

export function notesInRect(
  notes: PianoRollNote[],
  tick0: number,
  tick1: number,
  pitch0: number,
  pitch1: number,
): string[] {
  const tMin = Math.min(tick0, tick1)
  const tMax = Math.max(tick0, tick1)
  const pMin = Math.min(pitch0, pitch1)
  const pMax = Math.max(pitch0, pitch1)
  return notes
    .filter((note) => {
      const noteEnd = note.tick + note.duration
      const overlapsTime = note.tick < tMax && noteEnd > tMin
      const overlapsPitch = note.note >= pMin && note.note <= pMax
      return overlapsTime && overlapsPitch
    })
    .map((note) => note.id)
}

export function averageVelocity(
  notes: PianoRollNote[],
  selectedIds: ReadonlySet<string>,
): number {
  const selected = notes.filter((note) => selectedIds.has(note.id))
  if (!selected.length) return 100
  return Math.round(
    selected.reduce((sum, note) => sum + note.velocity, 0) / selected.length,
  )
}

export function pitchRange(notes: PianoRollNote[]): { lo: number; hi: number } {
  if (!notes.length) return { lo: 48, hi: 72 }
  let lo = 127
  let hi = 0
  for (const note of notes) {
    lo = Math.min(lo, note.note)
    hi = Math.max(hi, note.note)
  }
  return { lo: Math.max(0, lo - 4), hi: Math.min(127, hi + 4) }
}

/** Undo/redo stack for one piano-roll session. */
export class PianoRollHistory {
  private past: PianoRollNote[][] = []
  private future: PianoRollNote[][] = []

  push(notes: PianoRollNote[]) {
    this.past.push(notes.map((n) => ({ ...n })))
    this.future = []
    if (this.past.length > 100) this.past.shift()
  }

  undo(current: PianoRollNote[]): PianoRollNote[] | null {
    const prev = this.past.pop()
    if (!prev) return null
    this.future.push(current.map((n) => ({ ...n })))
    return prev.map((n) => ({ ...n }))
  }

  redo(current: PianoRollNote[]): PianoRollNote[] | null {
    const next = this.future.pop()
    if (!next) return null
    this.past.push(current.map((n) => ({ ...n })))
    return next.map((n) => ({ ...n }))
  }

  get canUndo() {
    return this.past.length > 0
  }

  get canRedo() {
    return this.future.length > 0
  }
}

export function isBlackKey(midiNote: number): boolean {
  const pc = ((midiNote % 12) + 12) % 12
  return pc === 1 || pc === 3 || pc === 6 || pc === 8 || pc === 10
}

export function pitchLabel(midiNote: number): string {
  const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
  const pc = ((midiNote % 12) + 12) % 12
  const octave = Math.floor(midiNote / 12) - 1
  return `${names[pc]}${octave}`
}
