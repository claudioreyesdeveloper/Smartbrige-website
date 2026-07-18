"use client"

import type { CSSProperties, MouseEvent } from "react"
import { desktopSectionAccent } from "./section-colors"
import type { DispatchPlaybackState, JamSong } from "./types"

type SongTimelineProps = {
  song: JamSong
  playback: DispatchPlaybackState
  onPlaySection: (sectionId: string) => void
  /** Desktop: right-click → "Record This Section..." */
  onRecordSection?: (sectionId: string) => void
  disabled?: boolean
}

/**
 * Demo-style chord blocks + section rows. Playhead uses dispatcher positionMs
 * (Keyboard Master / F8-integrated in the production adapter) — one clock with MIDI.
 */
export function SongTimeline({
  song,
  playback,
  onPlaySection,
  onRecordSection,
  disabled = false,
}: SongTimelineProps) {
  const beatsPerBar = song.timeSignature[0]
  const introBeats = beatsPerBar
  const planTempo = Math.max(20, song.tempo)
  const beatMs = 60_000 / planTempo
  const playing = playback.status === "playing"
  const sectionMode =
    playback.selection?.mode === "section" ? playback.selection.sectionId : null

  // Full-song plans include a 1-bar intro before section content.
  const playbackBeat = playback.positionMs / beatMs

  let sectionOffset = introBeats

  return (
    <div className="song-timeline" aria-label={`${song.title} arrangement timeline`}>
      {sectionMode == null ? (
        <div
          className={`timeline-intro${
            playing && playbackBeat < introBeats ? " is-active" : ""
          }`}
        >
          <span>INTRO</span>
          <strong>Automatic keyboard intro</strong>
          <small>
            {beatsPerBar}/{song.timeSignature[1]} · Main A armed
          </small>
        </div>
      ) : null}

      {song.sections.map((section, sectionIndex) => {
        const start = sectionOffset
        const sectionBeats = section.bars * beatsPerBar
        const end = start + sectionBeats
        sectionOffset = end

        const localBeat =
          sectionMode != null
            ? sectionMode === section.id
              ? playbackBeat
              : -1
            : playbackBeat - start

        const active =
          playing &&
          (sectionMode != null
            ? sectionMode === section.id && localBeat >= 0 && localBeat < sectionBeats
            : playbackBeat >= start && playbackBeat < end)

        // Prefer chord coverage so factory padding bars don't leave empty rows.
        // While this section plays past that coverage, expand to the full bar count.
        const chordEndBars = section.chords.map((chord) =>
          Math.ceil((chord.beat + (chord.duration || beatsPerBar)) / beatsPerBar),
        )
        const contentBars = chordEndBars.length > 0 ? Math.max(...chordEndBars) : 1
        const playheadBars =
          active && localBeat >= 0
            ? Math.ceil(Math.min(sectionBeats, localBeat + 0.001) / beatsPerBar)
            : 0
        const displayBars = Math.min(
          section.bars,
          Math.max(contentBars, playheadBars, 1),
        )
        const rows = Math.ceil(displayBars / 4)
        const accent = desktopSectionAccent(section.label, sectionIndex)

        return (
          <section
            key={section.id}
            className={`timeline-section${active ? " is-active" : ""}`}
            style={{ "--section-accent": accent } as CSSProperties}
            aria-label={`Play ${section.label}`}
            title={
              disabled
                ? section.label
                : `Double-click to play · Right-click to record ${section.label}`
            }
            tabIndex={disabled ? -1 : 0}
            onDoubleClick={() => {
              if (!disabled) onPlaySection(section.id)
            }}
            onContextMenu={(event: MouseEvent) => {
              if (disabled || !onRecordSection) return
              event.preventDefault()
              onRecordSection(section.id)
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
              <div className="timeline-section-meta">
                <span>Main {section.variation}</span>
                <span>{section.bars} bars</span>
                {sectionIndex < song.sections.length - 1 ? (
                  <span>Fill armed</span>
                ) : null}
              </div>
            </header>
            <div className="timeline-rows">
              {Array.from({ length: rows }, (_, row) => {
                const rowStart = row * 4 * beatsPerBar
                const rowEnd = Math.min(sectionBeats, rowStart + 4 * beatsPerBar)
                const rowBeats = rowEnd - rowStart
                const progress = active
                  ? Math.max(0, Math.min(1, (localBeat - rowStart) / rowBeats))
                  : localBeat >= rowEnd
                    ? 1
                    : 0
                const rowChords = section.chords.filter(
                  (chord) =>
                    chord.beat < rowEnd &&
                    chord.beat + (chord.duration || 0.25) > rowStart,
                )

                const barWidthPercent = (beatsPerBar / rowBeats) * 100
                const beatWidthPercent = (1 / rowBeats) * 100

                return (
                  <div className="timeline-row" key={`${section.id}-${row}`}>
                    <div
                      className="timeline-chord-lane"
                      style={
                        {
                          "--bar-w": `${barWidthPercent}%`,
                          "--beat-w": `${beatWidthPercent}%`,
                        } as CSSProperties
                      }
                    >
                      <div className="timeline-beat-grid" />
                      <div className="timeline-bar-numbers" aria-hidden="true">
                        {Array.from(
                          { length: Math.ceil(rowBeats / beatsPerBar) },
                          (_, bar) => (
                            <span
                              key={bar}
                              style={{ left: `${bar * barWidthPercent}%` }}
                            >
                              {row * 4 + bar + 1}
                            </span>
                          ),
                        )}
                      </div>
                      {rowChords.map((chord, chordIndex) => {
                        const visibleStart = Math.max(rowStart, chord.beat)
                        const visibleEnd = Math.min(
                          rowEnd,
                          chord.beat + (chord.duration || beatsPerBar),
                        )
                        const left =
                          ((visibleStart - rowStart) / rowBeats) * 100
                        const width = Math.max(
                          3,
                          ((visibleEnd - visibleStart) / rowBeats) * 100,
                        )
                        const isCurrent =
                          active &&
                          localBeat >= chord.beat &&
                          localBeat < chord.beat + (chord.duration || beatsPerBar)
                        return (
                          <span
                            key={`${chord.beat}-${chordIndex}`}
                            className={`timeline-chord${isCurrent ? " is-current" : ""}${
                              chord.beat < rowStart ? " is-spill" : ""
                            }`}
                            style={{ left: `${left}%`, width: `${width}%` }}
                          >
                            {chord.name}
                          </span>
                        )
                      })}
                      {progress > 0 && progress < 1 ? (
                        <i
                          className="timeline-playhead"
                          style={{ left: `${progress * 100}%` }}
                        />
                      ) : null}
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
