"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { MidiNote } from "@/lib/demo/style-midi"
import type { StylePreviewPlayer } from "@/lib/demo/style-preview"
import type { YamahaMidiSession } from "@/lib/demo/yamaha/midi-session"
import {
  auditionChordForPreview,
  notesToAuditionEvents,
} from "@/lib/style-maker/audition"
import { displayName, styleChannel, type StyleMakerLane } from "@/lib/style-maker/lanes"
import {
  averageVelocity,
  cloneNotesWithIds,
  deleteNotes,
  moveNotes,
  PianoRollHistory,
  pitchRange,
  quantizeNoteStarts,
  setNotesVelocity,
  SNAP_OPTIONS,
  snapGridTicks,
  stripNoteIds,
  type PianoRollNote,
  type SnapDivision,
} from "@/lib/style-maker/piano-roll-model"
import { PianoRoll } from "@/components/style-maker/piano-roll"

/** Horizontal zoom — 100% = 72 px/beat. */
const ZOOM_PRESETS = [
  { label: "50%", px: 36 },
  { label: "75%", px: 54 },
  { label: "100%", px: 72 },
  { label: "125%", px: 90 },
  { label: "150%", px: 108 },
  { label: "175%", px: 126 },
  { label: "200%", px: 140 },
] as const

/** Vertical key size — 100% = 16 px/key. */
const KEY_PRESETS = [
  { label: "75%", h: 12 },
  { label: "100%", h: 16 },
  { label: "125%", h: 20 },
  { label: "150%", h: 22 },
] as const

export type PianoRollOpenTarget = {
  lane: StyleMakerLane
  variant: "major" | "minor"
  sectionLabel: string
  notes: MidiNote[]
  cycleTicks: number
  ticksPerQuarter: number
  bpm: number
}

type Props = {
  target: PianoRollOpenTarget
  preview: StylePreviewPlayer | null
  session: YamahaMidiSession
  midiConnected: boolean
  onAuditionTempo: (bpm: number) => void
  onApply: (notes: MidiNote[], cycleTicks: number) => void
}

export function PianoRollModal({
  target,
  preview,
  session,
  midiConnected,
  onAuditionTempo,
  onApply,
}: Props) {
  const historyRef = useRef(new PianoRollHistory())
  const [notes, setNotes] = useState<PianoRollNote[]>(() =>
    cloneNotesWithIds(target.notes),
  )
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [snap, setSnap] = useState<SnapDivision>("1/16")
  const [pxPerBeat, setPxPerBeat] = useState(72) // 100% zoom
  const [keyHeight, setKeyHeight] = useState(16) // 100% key size
  const [historyTick, setHistoryTick] = useState(0)
  const [auditioning, setAuditioning] = useState(false)
  const [playheadTick, setPlayheadTick] = useState<number | null>(null)
  const auditionClock = useRef<{
    wallStartMs: number
    startTick: number
    endTick: number
    msPerTick: number
    raf: number
  } | null>(null)
  const pitchPreviewRef = useRef<{
    pitch: number
    channel0: number
    timer: ReturnType<typeof setTimeout>
  } | null>(null)

  const releasePitchPreview = useCallback(() => {
    const held = pitchPreviewRef.current
    if (!held) return
    clearTimeout(held.timer)
    try {
      session.sendPort2(
        Uint8Array.of(0x80 | held.channel0, held.pitch & 0x7f, 0),
      )
    } catch {
      /* disconnect mid-preview */
    }
    pitchPreviewRef.current = null
  }, [session])

  const previewPitch = useCallback(
    (pitch: number, velocity: number) => {
      if (!midiConnected) return
      const channel0 = (styleChannel(target.lane) - 1) & 0x0f
      const note = pitch & 0x7f
      const vel = Math.max(1, Math.min(127, Math.round(velocity) || 100))
      releasePitchPreview()
      try {
        session.sendPort2(Uint8Array.of(0x90 | channel0, note, vel))
      } catch {
        return
      }
      pitchPreviewRef.current = {
        pitch: note,
        channel0,
        timer: setTimeout(() => {
          try {
            session.sendPort2(Uint8Array.of(0x80 | channel0, note, 0))
          } catch {
            /* ignore */
          }
          pitchPreviewRef.current = null
        }, 200),
      }
    },
    [midiConnected, releasePitchPreview, session, target.lane],
  )

  useEffect(() => () => releasePitchPreview(), [releasePitchPreview])

  const cycleTicks = Math.max(
    target.cycleTicks,
    target.ticksPerQuarter * 4,
    ...notes.map((n) => n.tick + n.duration),
  )

  const range = useMemo(() => pitchRange(notes), [notes])
  const pitchLo = Math.min(range.lo, 36)
  const pitchHi = Math.max(range.hi, 84)

  const beginGesture = useCallback(() => {
    historyRef.current.push(notes)
    setHistoryTick((n) => n + 1)
  }, [notes])

  const setNotesLive = useCallback((next: PianoRollNote[]) => {
    setNotes(next)
  }, [])

  const commitEdit = useCallback(
    (next: PianoRollNote[]) => {
      historyRef.current.push(notes)
      setNotes(next)
      setHistoryTick((n) => n + 1)
    },
    [notes],
  )

  const undo = useCallback(() => {
    const prev = historyRef.current.undo(notes)
    if (!prev) return
    setNotes(prev)
    setSelectedIds(new Set())
    setHistoryTick((n) => n + 1)
  }, [notes])

  const redo = useCallback(() => {
    const next = historyRef.current.redo(notes)
    if (!next) return
    setNotes(next)
    setSelectedIds(new Set())
    setHistoryTick((n) => n + 1)
  }, [notes])

  const clearPlayheadClock = useCallback(() => {
    if (auditionClock.current?.raf) {
      cancelAnimationFrame(auditionClock.current.raf)
    }
    auditionClock.current = null
    setPlayheadTick(null)
  }, [])

  const stopAudition = useCallback(() => {
    preview?.stop()
    setAuditioning(false)
    clearPlayheadClock()
  }, [clearPlayheadClock, preview])

  const audition = useCallback(
    (selectionOnly: boolean) => {
      if (!midiConnected) return
      const playNotes =
        selectionOnly && selectedIds.size
          ? notes.filter((n) => selectedIds.has(n.id))
          : notes
      if (!playNotes.length) return
      const events = notesToAuditionEvents(
        stripNoteIds(playNotes),
        styleChannel(target.lane),
      )
      const bars = Math.max(
        1,
        Math.ceil(cycleTicks / (target.ticksPerQuarter * 4)),
      )
      onAuditionTempo(target.bpm)
      preview?.play(events, target.ticksPerQuarter, target.bpm, bars, {
        holdChord: auditionChordForPreview(target.variant === "minor"),
      })

      // Match StylePreviewPlayer: first event tick is t=0 on the wire,
      // but the cursor should travel through absolute note ticks.
      const startTick = Math.min(...playNotes.map((n) => n.tick))
      const endTick = Math.max(
        ...playNotes.map((n) => n.tick + n.duration),
        startTick + target.ticksPerQuarter * 4 * bars,
      )
      const msPerTick =
        60000 / Math.max(20, target.bpm) / Math.max(1, target.ticksPerQuarter)

      if (auditionClock.current?.raf) {
        cancelAnimationFrame(auditionClock.current.raf)
      }
      const clock = {
        wallStartMs: performance.now(),
        startTick,
        endTick,
        msPerTick,
        raf: 0,
      }
      const tick = () => {
        const elapsed = performance.now() - clock.wallStartMs
        const current = clock.startTick + elapsed / clock.msPerTick
        if (current >= clock.endTick) {
          setPlayheadTick(clock.endTick)
          setAuditioning(false)
          auditionClock.current = null
          return
        }
        setPlayheadTick(current)
        clock.raf = requestAnimationFrame(tick)
        if (auditionClock.current) auditionClock.current.raf = clock.raf
      }
      auditionClock.current = clock
      setPlayheadTick(startTick)
      setAuditioning(true)
      clock.raf = requestAnimationFrame(tick)
    },
    [
      cycleTicks,
      midiConnected,
      notes,
      onAuditionTempo,
      preview,
      selectedIds,
      target.bpm,
      target.lane,
      target.ticksPerQuarter,
      target.variant,
    ],
  )

  useEffect(() => () => clearPlayheadClock(), [clearPlayheadClock])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const targetEl = event.target as HTMLElement | null
      if (
        targetEl &&
        (targetEl.tagName === "INPUT" ||
          targetEl.tagName === "SELECT" ||
          targetEl.tagName === "TEXTAREA")
      ) {
        return
      }

      if (event.key === "Escape") {
        event.preventDefault()
        // Persistent editor: Esc only stops audition, does not close.
        stopAudition()
        return
      }
      if (event.key === " " || event.code === "Space") {
        event.preventDefault()
        if (auditioning) stopAudition()
        else audition(false)
        return
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        event.preventDefault()
        if (event.shiftKey) redo()
        else undo()
        return
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "y") {
        event.preventDefault()
        redo()
        return
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        if (!selectedIds.size) return
        event.preventDefault()
        commitEdit(deleteNotes(notes, selectedIds))
        setSelectedIds(new Set())
        return
      }
      if (event.key.toLowerCase() === "q" && selectedIds.size && snap !== "off") {
        event.preventDefault()
        commitEdit(
          quantizeNoteStarts(
            notes,
            selectedIds,
            target.ticksPerQuarter,
            snap,
            cycleTicks,
          ),
        )
        return
      }
      if (event.key.startsWith("Arrow") && selectedIds.size) {
        event.preventDefault()
        const grid = snapGridTicks(target.ticksPerQuarter, snap)
        const dTick =
          event.key === "ArrowLeft" ? -grid : event.key === "ArrowRight" ? grid : 0
        const dPitch =
          event.key === "ArrowUp" ? 1 : event.key === "ArrowDown" ? -1 : 0
        const moved = moveNotes(notes, selectedIds, dTick, dPitch, cycleTicks)
        commitEdit(moved)
        if (dPitch !== 0) {
          const primary = moved.find((n) => selectedIds.has(n.id))
          if (primary) previewPitch(primary.note, primary.velocity)
        }
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [
    audition,
    auditioning,
    commitEdit,
    cycleTicks,
    notes,
    previewPitch,
    redo,
    selectedIds,
    snap,
    stopAudition,
    target.ticksPerQuarter,
    undo,
  ])

  const velocity = averageVelocity(notes, selectedIds)

  return (
    <div className="sm-modal-backdrop" role="presentation">
      <div
        className="sm-modal sm-pianoroll-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Piano roll editor"
      >
        <header className="sm-pianoroll-header">
          <div>
            <strong>
              {displayName(target.lane)} · {target.sectionLabel} ·{" "}
              {target.variant === "minor" ? "MIN" : "MAJ"}
            </strong>
            <span className="sm-pianoroll-meta">
              {notes.length} notes · ch {styleChannel(target.lane)} ·{" "}
              {Math.round(target.bpm)} BPM
            </span>
          </div>
          <p className="sm-pianoroll-select-tip">
            Select several notes: <kbd>Shift</kbd>+click to add or remove ·{" "}
            <kbd>Shift</kbd>+drag on empty grid for a marquee
          </p>
          <div className="sm-pianoroll-toolbar">
            <label>
              Snap
              <select
                value={snap}
                onChange={(event) => setSnap(event.target.value as SnapDivision)}
              >
                {SNAP_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Zoom
              <select
                value={String(pxPerBeat)}
                onChange={(event) => setPxPerBeat(Number(event.target.value))}
              >
                {ZOOM_PRESETS.map((preset) => (
                  <option key={preset.label} value={String(preset.px)}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Keys
              <select
                value={String(keyHeight)}
                onChange={(event) => setKeyHeight(Number(event.target.value))}
              >
                {KEY_PRESETS.map((preset) => (
                  <option key={preset.label} value={String(preset.h)}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="sm-btn"
              disabled={!historyRef.current.canUndo}
              onClick={undo}
              title="Undo"
            >
              Undo
            </button>
            <button
              type="button"
              className="sm-btn"
              disabled={!historyRef.current.canRedo}
              onClick={redo}
              title="Redo"
            >
              Redo
            </button>
            <button
              type="button"
              className="sm-btn"
              disabled={!selectedIds.size || snap === "off"}
              onClick={() =>
                commitEdit(
                  quantizeNoteStarts(
                    notes,
                    selectedIds,
                    target.ticksPerQuarter,
                    snap,
                    cycleTicks,
                  ),
                )
              }
            >
              Quantize
            </button>
          </div>
        </header>

        <PianoRoll
          notes={notes}
          selectedIds={selectedIds}
          ticksPerQuarter={target.ticksPerQuarter}
          cycleTicks={cycleTicks}
          snap={snap}
          pxPerBeat={pxPerBeat}
          keyHeight={keyHeight}
          pitchLo={pitchLo}
          pitchHi={pitchHi}
          playheadTick={playheadTick}
          onPreviewPitch={previewPitch}
          onBeginGesture={beginGesture}
          onNotesChange={setNotesLive}
          onSelectedIdsChange={setSelectedIds}
        />

        <footer className="sm-pianoroll-footer">
          <label className="sm-pianoroll-velocity">
            Velocity
            <input
              type="range"
              min={1}
              max={127}
              disabled={!selectedIds.size}
              value={velocity}
              onPointerDown={() => {
                if (selectedIds.size) beginGesture()
              }}
              onChange={(event) => {
                const nextVel = Number(event.target.value)
                setNotes(setNotesVelocity(notes, selectedIds, nextVel))
              }}
            />
            <span>{selectedIds.size ? velocity : "—"}</span>
          </label>

          <div className="sm-pianoroll-footer-actions">
            <button
              type="button"
              className="sm-btn"
              disabled={!midiConnected || !notes.length}
              onClick={() => (auditioning ? stopAudition() : audition(false))}
            >
              {auditioning ? "Stop" : "Audition"}
            </button>
            <button
              type="button"
              className="sm-btn"
              disabled={!midiConnected || !selectedIds.size}
              onClick={() => audition(true)}
            >
              Audition selection
            </button>
            <button
              type="button"
              className="sm-btn is-primary"
              onClick={() => {
                stopAudition()
                onApply(stripNoteIds(notes), cycleTicks)
              }}
            >
              Done
            </button>
          </div>
        </footer>
        <p className="sm-pianoroll-help">
          Draw on empty grid · drag notes · resize from right edge · Shift+click
          to add/remove · Shift+drag marquee · Del delete · Q quantize · Space
          audition · Esc stops · Done saves and closes
        </p>
      </div>
    </div>
  )
}
