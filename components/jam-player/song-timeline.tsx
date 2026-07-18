"use client"

import type { CSSProperties } from "react"
import type { DispatchPlaybackState, JamSong } from "./types"

type SongTimelineProps = {
  song: JamSong
  playback: DispatchPlaybackState
  onPlaySection: (sectionId: string) => void
  disabled?: boolean
}

function sectionWindowMs(song: JamSong, tempo: number): Array<{
  id: string
  startMs: number
  endMs: number
}> {
  const beatMs = 60_000 / tempo
  let cursor = 0
  return song.sections.map((section) => {
    const duration = section.bars * song.timeSignature[0] * beatMs
    const startMs = cursor
    const endMs = startMs + duration
    cursor = endMs
    return { id: section.id, startMs, endMs }
  })
}

export function SongTimeline({
  song,
  playback,
  onPlaySection,
  disabled = false,
}: SongTimelineProps) {
  const beatsPerBar = song.timeSignature[0]
  const tempo = song.tempo
  const windows = sectionWindowMs(song, tempo)
  const playing = playback.status === "playing"

  return (
    <div
      className="paid-jam-timeline"
      aria-label={`${song.title} section timeline`}
    >
      {song.sections.map((section, sectionIndex) => {
        const window = windows[sectionIndex]
        const sectionDuration = window.endMs - window.startMs
        const absolutePos =
          playback.selection?.mode === "section" &&
          playback.selection.sectionId === section.id
            ? window.startMs + playback.positionMs
            : playback.selection?.mode === "full"
              ? playback.positionMs
              : -1
        const active =
          playing &&
          absolutePos >= window.startMs &&
          absolutePos < window.endMs
        const rows = Math.ceil(section.bars / 4)
        const sectionBeats = section.bars * beatsPerBar

        return (
          <section
            key={section.id}
            className={`paid-jam-section${active ? " is-active" : ""}`}
            style={{ "--section-accent": song.accent } as CSSProperties}
            aria-label={`Play ${section.label}`}
            title={
              disabled
                ? section.label
                : `Double-click to play ${section.label}`
            }
            tabIndex={disabled ? -1 : 0}
            onDoubleClick={() => {
              if (!disabled) onPlaySection(section.id)
            }}
            onKeyDown={(event) => {
              if (disabled) return
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault()
                onPlaySection(section.id)
              }
            }}
          >
            <header>
              <div>
                <span>{String(sectionIndex + 1).padStart(2, "0")}</span>
                <strong>{section.label}</strong>
              </div>
              <div className="paid-jam-section-meta">
                <span>Main {section.variation}</span>
                <span>{section.bars} bars</span>
              </div>
            </header>
            <div className="paid-jam-rows">
              {Array.from({ length: rows }, (_, row) => {
                const rowStart = row * 4 * beatsPerBar
                const rowEnd = Math.min(sectionBeats, rowStart + 4 * beatsPerBar)
                const rowBeats = rowEnd - rowStart
                const rowStartMs = window.startMs + (rowStart / sectionBeats) * sectionDuration
                const rowEndMs = window.startMs + (rowEnd / sectionBeats) * sectionDuration
                const progress = active
                  ? Math.max(
                      0,
                      Math.min(1, (absolutePos - rowStartMs) / (rowEndMs - rowStartMs)),
                    )
                  : absolutePos >= rowEndMs
                    ? 1
                    : 0
                const rowChords = section.chords.filter(
                  (chord) =>
                    chord.beat < rowEnd &&
                    chord.beat + chord.duration > rowStart,
                )

                return (
                  <div className="paid-jam-row" key={`${section.id}-${row}`}>
                    <div className="paid-jam-bar-numbers" aria-hidden="true">
                      {Array.from(
                        { length: Math.ceil(rowBeats / beatsPerBar) },
                        (_, bar) => (
                          <span key={bar}>{row * 4 + bar + 1}</span>
                        ),
                      )}
                    </div>
                    <div className="paid-jam-chord-lane">
                      <div className="paid-jam-beat-grid" />
                      {rowChords.map((chord, chordIndex) => {
                        const visibleStart = Math.max(rowStart, chord.beat)
                        const visibleEnd = Math.min(
                          rowEnd,
                          chord.beat + chord.duration,
                        )
                        const left =
                          ((visibleStart - rowStart) / rowBeats) * 100
                        const width = Math.max(
                          3,
                          ((visibleEnd - visibleStart) / rowBeats) * 100,
                        )
                        const chordStartMs =
                          window.startMs +
                          (chord.beat / sectionBeats) * sectionDuration
                        const chordEndMs =
                          window.startMs +
                          ((chord.beat + chord.duration) / sectionBeats) *
                            sectionDuration
                        const isCurrent =
                          active &&
                          absolutePos >= chordStartMs &&
                          absolutePos < chordEndMs
                        return (
                          <span
                            key={`${chord.beat}-${chordIndex}`}
                            className={`paid-jam-chord${isCurrent ? " is-current" : ""}`}
                            style={{ left: `${left}%`, width: `${width}%` }}
                          >
                            {chord.name}
                          </span>
                        )
                      })}
                      {progress > 0 && progress < 1 && (
                        <i
                          className="paid-jam-playhead"
                          style={{ left: `${progress * 100}%` }}
                        />
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}
