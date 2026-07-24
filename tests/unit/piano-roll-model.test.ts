import { describe, expect, it } from "vitest"
import {
  cloneNotesWithIds,
  createNote,
  deleteNotes,
  moveNotes,
  notesInRect,
  PianoRollHistory,
  quantizeNoteStarts,
  resizeNotes,
  setNotesVelocity,
  snapGridTicks,
  snapTicks,
  stripNoteIds,
} from "@/lib/style-maker/piano-roll-model"

describe("piano-roll-model", () => {
  it("snaps ticks to subdivision grids", () => {
    expect(snapGridTicks(480, "1/4")).toBe(480)
    expect(snapGridTicks(480, "1/8")).toBe(240)
    expect(snapGridTicks(480, "1/16")).toBe(120)
    expect(snapTicks(130, 480, "1/16")).toBe(120)
    expect(snapTicks(190, 480, "1/16")).toBe(240)
    expect(snapTicks(133, 480, "off")).toBe(133)
  })

  it("moves, resizes, quantizes, and deletes selected notes", () => {
    const notes = cloneNotesWithIds([
      { tick: 0, duration: 120, note: 60, velocity: 100 },
      { tick: 240, duration: 120, note: 64, velocity: 90 },
    ])
    const ids = new Set([notes[0].id])

    const moved = moveNotes(notes, ids, 120, 2, 1920)
    expect(moved[0].tick).toBe(120)
    expect(moved[0].note).toBe(62)
    expect(moved[1].tick).toBe(240)

    const resized = resizeNotes(moved, ids, 120, 1920)
    expect(resized[0].duration).toBe(240)

    const quantized = quantizeNoteStarts(
      [
        { ...notes[0], tick: 50 },
        notes[1],
      ],
      ids,
      480,
      "1/16",
      1920,
    )
    expect(quantized[0].tick).toBe(0)

    const vel = setNotesVelocity(notes, ids, 40)
    expect(vel[0].velocity).toBe(40)
    expect(vel[1].velocity).toBe(90)

    const deleted = deleteNotes(notes, ids)
    expect(deleted).toHaveLength(1)
    expect(deleted[0].id).toBe(notes[1].id)
  })

  it("hit-tests notes in a marquee rect and round-trips ids", () => {
    const a = createNote(0, 60, 100)
    const b = createNote(200, 72, 100)
    const hits = notesInRect([a, b], 0, 150, 55, 65)
    expect(hits).toEqual([a.id])
    expect(stripNoteIds([a])[0]).toEqual({
      tick: 0,
      duration: 100,
      note: 60,
      velocity: 100,
    })
  })

  it("supports undo and redo history", () => {
    const history = new PianoRollHistory()
    const a = [createNote(0, 60, 100)]
    const b = [createNote(120, 62, 100)]
    history.push(a)
    expect(history.canUndo).toBe(true)
    const undone = history.undo(b)
    expect(undone?.[0].tick).toBe(0)
    const redone = history.redo(undone!)
    expect(redone?.[0].tick).toBe(120)
  })
})
