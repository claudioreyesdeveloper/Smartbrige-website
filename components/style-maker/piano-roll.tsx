"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  createNote,
  isBlackKey,
  moveNotes,
  notesInRect,
  pitchLabel,
  resizeNotes,
  snapGridTicks,
  snapTicks,
  type PianoRollNote,
  type SnapDivision,
} from "@/lib/style-maker/piano-roll-model"

const KEYBOARD_WIDTH = 56
const RULER_HEIGHT = 28
const RESIZE_EDGE_PX = 6

type DragMode =
  | { kind: "none" }
  | {
      kind: "move"
      ids: Set<string>
      originX: number
      originY: number
      baseNotes: PianoRollNote[]
    }
  | {
      kind: "resize"
      ids: Set<string>
      originX: number
      baseNotes: PianoRollNote[]
    }
  | {
      kind: "draw"
      startTick: number
      noteId: string
      baseNotes: PianoRollNote[]
    }
  | {
      kind: "marquee"
      startTick: number
      startPitch: number
      endTick: number
      endPitch: number
      additive: boolean
    }

type Props = {
  notes: PianoRollNote[]
  selectedIds: Set<string>
  ticksPerQuarter: number
  cycleTicks: number
  snap: SnapDivision
  pxPerBeat: number
  keyHeight: number
  pitchLo: number
  pitchHi: number
  /** Absolute tick of the audition playhead; null when not playing. */
  playheadTick?: number | null
  /** Brief pitch preview when clicking / dragging notes (MIDI note 0–127). */
  onPreviewPitch?: (pitch: number, velocity: number) => void
  onBeginGesture: () => void
  onNotesChange: (notes: PianoRollNote[]) => void
  onSelectedIdsChange: (ids: Set<string>) => void
}

export function PianoRoll({
  notes,
  selectedIds,
  ticksPerQuarter,
  cycleTicks,
  snap,
  pxPerBeat,
  keyHeight,
  pitchLo,
  pitchHi,
  playheadTick = null,
  onPreviewPitch,
  onBeginGesture,
  onNotesChange,
  onSelectedIdsChange,
}: Props) {
  const previewPitchRef = useRef(onPreviewPitch)
  previewPitchRef.current = onPreviewPitch
  const moveLastPitchRef = useRef<number | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const notesRef = useRef(notes)
  notesRef.current = notes
  const [drag, setDrag] = useState<DragMode>({ kind: "none" })

  const tpq = Math.max(1, ticksPerQuarter)
  const pxPerTick = pxPerBeat / tpq
  const pitchCount = Math.max(1, pitchHi - pitchLo + 1)
  const gridWidth = Math.max(pxPerBeat * 4, cycleTicks * pxPerTick)
  const gridHeight = pitchCount * keyHeight
  const beats = Math.max(1, Math.ceil(cycleTicks / tpq))
  const bars = Math.max(1, Math.ceil(beats / 4))
  const defaultDur = Math.max(1, snapGridTicks(tpq, snap) * (snap === "off" ? 2 : 2))

  const pitches = useMemo(() => {
    const list: number[] = []
    for (let p = pitchHi; p >= pitchLo; p -= 1) list.push(p)
    return list
  }, [pitchHi, pitchLo])

  const tickFromClientX = useCallback(
    (clientX: number) => {
      const el = scrollRef.current
      if (!el) return 0
      const rect = el.getBoundingClientRect()
      const x = clientX - rect.left + el.scrollLeft - KEYBOARD_WIDTH
      return Math.max(0, Math.min(cycleTicks, x / pxPerTick))
    },
    [cycleTicks, pxPerTick],
  )

  const pitchFromClientY = useCallback(
    (clientY: number) => {
      const el = scrollRef.current
      if (!el) return pitchLo
      const rect = el.getBoundingClientRect()
      const y = clientY - rect.top + el.scrollTop - RULER_HEIGHT
      const index = Math.floor(y / keyHeight)
      const pitch = pitchHi - index
      return Math.max(pitchLo, Math.min(pitchHi, pitch))
    },
    [keyHeight, pitchHi, pitchLo],
  )

  useEffect(() => {
    if (drag.kind === "none") return

    const onMove = (event: PointerEvent) => {
      if (drag.kind === "move") {
        const dx = event.clientX - drag.originX
        const dy = event.clientY - drag.originY
        let dTick = Math.round(dx / pxPerTick)
        const dPitch = -Math.round(dy / keyHeight)
        if (snap !== "off") {
          const sample = drag.baseNotes.find((n) => drag.ids.has(n.id))
          if (sample) {
            const target = snapTicks(sample.tick + dTick, tpq, snap)
            dTick = target - sample.tick
          }
        }
        const moved = moveNotes(
          drag.baseNotes,
          drag.ids,
          dTick,
          dPitch,
          cycleTicks,
        )
        onNotesChange(moved)
        const primary = moved.find((n) => drag.ids.has(n.id))
        if (
          primary &&
          moveLastPitchRef.current != null &&
          primary.note !== moveLastPitchRef.current
        ) {
          moveLastPitchRef.current = primary.note
          previewPitchRef.current?.(primary.note, primary.velocity)
        }
      } else if (drag.kind === "resize") {
        const dx = event.clientX - drag.originX
        let dDur = Math.round(dx / pxPerTick)
        if (snap !== "off") {
          const sample = drag.baseNotes.find((n) => drag.ids.has(n.id))
          if (sample) {
            const targetEnd = snapTicks(
              sample.tick + sample.duration + dDur,
              tpq,
              snap,
            )
            dDur = targetEnd - sample.tick - sample.duration
          }
        }
        onNotesChange(
          resizeNotes(drag.baseNotes, drag.ids, dDur, cycleTicks),
        )
      } else if (drag.kind === "draw") {
        const tick = tickFromClientX(event.clientX)
        const end = snap !== "off" ? snapTicks(tick, tpq, snap) : Math.round(tick)
        const left = Math.min(drag.startTick, end)
        const right = Math.max(drag.startTick, end)
        const dur = Math.max(
          snapGridTicks(tpq, snap),
          right - left || defaultDur,
        )
        onNotesChange(
          drag.baseNotes.map((note) =>
            note.id === drag.noteId
              ? {
                  ...note,
                  tick: left,
                  duration: Math.min(dur, Math.max(1, cycleTicks - left)),
                }
              : note,
          ),
        )
      } else if (drag.kind === "marquee") {
        setDrag({
          ...drag,
          endTick: tickFromClientX(event.clientX),
          endPitch: pitchFromClientY(event.clientY),
        })
      }
    }

    const onUp = () => {
      if (drag.kind === "marquee") {
        const hit = notesInRect(
          notesRef.current,
          drag.startTick,
          drag.endTick,
          drag.startPitch,
          drag.endPitch,
        )
        if (drag.additive) {
          const next = new Set(selectedIds)
          hit.forEach((id) => next.add(id))
          onSelectedIdsChange(next)
        } else {
          onSelectedIdsChange(new Set(hit))
        }
      }
      moveLastPitchRef.current = null
      setDrag({ kind: "none" })
    }

    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
    return () => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
    }
  }, [
    cycleTicks,
    defaultDur,
    drag,
    keyHeight,
    onNotesChange,
    onSelectedIdsChange,
    pitchFromClientY,
    pxPerTick,
    selectedIds,
    snap,
    tickFromClientX,
    tpq,
  ])

  const onGridPointerDown = (event: React.PointerEvent) => {
    if (event.button !== 0) return
    const tickRaw = tickFromClientX(event.clientX)
    const pitch = pitchFromClientY(event.clientY)
    const tick =
      snap !== "off" ? snapTicks(tickRaw, tpq, snap) : Math.round(tickRaw)

    if (event.shiftKey) {
      setDrag({
        kind: "marquee",
        startTick: tickRaw,
        startPitch: pitch,
        endTick: tickRaw,
        endPitch: pitch,
        additive: true,
      })
      return
    }

    onBeginGesture()
    const note = createNote(tick, pitch, defaultDur)
    const baseNotes = [...notesRef.current, note]
    onNotesChange(baseNotes)
    onSelectedIdsChange(new Set([note.id]))
    previewPitchRef.current?.(note.note, note.velocity)
    setDrag({
      kind: "draw",
      startTick: tick,
      noteId: note.id,
      baseNotes,
    })
  }

  const onNotePointerDown = (
    event: React.PointerEvent,
    note: PianoRollNote,
  ) => {
    event.stopPropagation()
    if (event.button !== 0) return
    const el = event.currentTarget as HTMLElement
    const rect = el.getBoundingClientRect()
    const nearRight = rect.right - event.clientX <= RESIZE_EDGE_PX

    let ids = selectedIds
    if (event.shiftKey) {
      const next = new Set(selectedIds)
      if (next.has(note.id)) next.delete(note.id)
      else next.add(note.id)
      onSelectedIdsChange(next)
      ids = next
      previewPitchRef.current?.(note.note, note.velocity)
      return
    }
    if (!selectedIds.has(note.id)) {
      ids = new Set([note.id])
      onSelectedIdsChange(ids)
    }

    previewPitchRef.current?.(note.note, note.velocity)
    onBeginGesture()
    const baseNotes = notesRef.current.map((n) => ({ ...n }))
    if (nearRight) {
      setDrag({
        kind: "resize",
        ids: new Set(ids),
        originX: event.clientX,
        baseNotes,
      })
    } else {
      moveLastPitchRef.current = note.note
      setDrag({
        kind: "move",
        ids: new Set(ids),
        originX: event.clientX,
        originY: event.clientY,
        baseNotes,
      })
    }
  }

  const marqueeStyle =
    drag.kind === "marquee"
      ? (() => {
          const t0 = Math.min(drag.startTick, drag.endTick)
          const t1 = Math.max(drag.startTick, drag.endTick)
          const p0 = Math.min(drag.startPitch, drag.endPitch)
          const p1 = Math.max(drag.startPitch, drag.endPitch)
          return {
            left: KEYBOARD_WIDTH + t0 * pxPerTick,
            top: RULER_HEIGHT + (pitchHi - p1) * keyHeight,
            width: Math.max(2, (t1 - t0) * pxPerTick),
            height: Math.max(2, (p1 - p0 + 1) * keyHeight),
          }
        })()
      : null

  // Keep the audition cursor in view.
  useEffect(() => {
    if (playheadTick == null || !scrollRef.current) return
    const el = scrollRef.current
    const x = KEYBOARD_WIDTH + playheadTick * pxPerTick
    const left = el.scrollLeft
    const right = left + el.clientWidth
    const margin = 80
    if (x < left + KEYBOARD_WIDTH + margin) {
      el.scrollLeft = Math.max(0, x - KEYBOARD_WIDTH - margin)
    } else if (x > right - margin) {
      el.scrollLeft = x - el.clientWidth + margin
    }
  }, [playheadTick, pxPerTick])

  return (
    <div className="sm-pianoroll" ref={scrollRef}>
      <div
        className="sm-pianoroll-canvas"
        style={{
          width: KEYBOARD_WIDTH + gridWidth,
          height: RULER_HEIGHT + gridHeight,
        }}
      >
        <div className="sm-pianoroll-ruler" style={{ height: RULER_HEIGHT }}>
          <div
            className="sm-pianoroll-ruler-gutter"
            style={{ width: KEYBOARD_WIDTH }}
          />
          <div className="sm-pianoroll-ruler-marks" style={{ width: gridWidth }}>
            {Array.from({ length: bars * 4 + 1 }, (_, beat) => (
              <div
                key={beat}
                className={`sm-pianoroll-ruler-beat${
                  beat % 4 === 0 ? " is-bar" : ""
                }`}
                style={{ left: beat * pxPerBeat }}
              >
                {beat % 4 === 0 ? `${beat / 4 + 1}` : ""}
              </div>
            ))}
          </div>
        </div>

        <div className="sm-pianoroll-body">
          <div className="sm-pianoroll-keys" style={{ width: KEYBOARD_WIDTH }}>
            {pitches.map((pitch) => (
              <div
                key={pitch}
                className={`sm-pianoroll-key${
                  isBlackKey(pitch) ? " is-black" : " is-white"
                }`}
                style={{ height: keyHeight }}
              >
                {pitch % 12 === 0 ? pitchLabel(pitch) : ""}
              </div>
            ))}
          </div>

          <div
            className="sm-pianoroll-grid"
            style={{ width: gridWidth, height: gridHeight }}
            onPointerDown={onGridPointerDown}
          >
            {pitches.map((pitch, index) => (
              <div
                key={pitch}
                className={`sm-pianoroll-row${isBlackKey(pitch) ? " is-black" : ""}`}
                style={{ top: index * keyHeight, height: keyHeight }}
              />
            ))}
            {Array.from({ length: beats + 1 }, (_, beat) => (
              <div
                key={`b${beat}`}
                className={`sm-pianoroll-vline${beat % 4 === 0 ? " is-bar" : ""}`}
                style={{ left: beat * pxPerBeat }}
              />
            ))}

            {notes.map((note) => {
              if (note.note < pitchLo || note.note > pitchHi) return null
              const top = (pitchHi - note.note) * keyHeight + 1
              const left = note.tick * pxPerTick
              const width = Math.max(4, note.duration * pxPerTick)
              const selected = selectedIds.has(note.id)
              const sounding =
                playheadTick != null &&
                playheadTick >= note.tick &&
                playheadTick < note.tick + note.duration
              const alpha = sounding
                ? 1
                : 0.35 + (note.velocity / 127) * 0.65
              return (
                <div
                  key={note.id}
                  className={`sm-pianoroll-note${
                    selected ? " is-selected" : ""
                  }${sounding ? " is-playing" : ""}`}
                  style={{
                    left,
                    top,
                    width,
                    height: keyHeight - 2,
                    opacity: alpha,
                  }}
                  title={`${pitchLabel(note.note)} · vel ${note.velocity}`}
                  onPointerDown={(event) => onNotePointerDown(event, note)}
                />
              )
            })}

            {playheadTick != null && (
              <div
                className="sm-pianoroll-playhead"
                style={{ left: playheadTick * pxPerTick }}
              />
            )}
          </div>
        </div>

        {marqueeStyle && (
          <div className="sm-pianoroll-marquee" style={marqueeStyle} />
        )}
      </div>
    </div>
  )
}
