"use client"

import { Pause, Play, RotateCcw, Sparkles, Square } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import rawSongs from "@/data/demo/songs.json"
import type { DemoSong, SongCategory, StyleGenre } from "@/lib/demo/types"
import {
  JamScheduler,
  type JamPlaybackState,
} from "@/lib/demo/jam-scheduler"
import { useMidiSession } from "@/lib/demo/yamaha/use-midi-session"
import { DemoShell } from "@/components/demo/demo-shell"
import { FeedbackPrompt } from "@/components/demo/feedback-prompt"

const songs = rawSongs as DemoSong[]
const categories: SongCategory[] = [
  "Pop",
  "Rock",
  "Ballad",
  "Dance",
  "Latin",
  "Swing & Jazz",
  "R&B",
  "Country",
]
const genres: StyleGenre[] = ["Pop", "Jazz", "Gospel", "Neo Soul", "Funk"]

const initialPlayback: JamPlaybackState = {
  playing: false,
  beat: 0,
  totalBeats: 0,
  currentChord: "",
  upcomingChord: "",
  currentSection: "",
  arrangerState: "Ready",
}

function SongTimeline({
  song,
  playback,
}: {
  song: DemoSong
  playback: JamPlaybackState
}) {
  const beatsPerBar = song.timeSignature[0]
  const introBeats = beatsPerBar
  let sectionOffset = introBeats

  return (
    <div className="song-timeline" aria-label={`${song.title} arrangement timeline`}>
      <div className={`timeline-intro${playback.beat < introBeats && playback.playing ? " is-active" : ""}`}>
        <span>INTRO 1</span>
        <strong>Automatic keyboard intro</strong>
        <small>{beatsPerBar}/4 · Main A armed</small>
      </div>
      {song.sections.map((section, sectionIndex) => {
        const start = sectionOffset
        const sectionBeats = section.bars * beatsPerBar
        const end = start + sectionBeats
        sectionOffset = end
        const active = playback.beat >= start && playback.beat < end
        const rows = Math.ceil(section.bars / 4)
        return (
          <section
            key={section.id}
            className={`timeline-section${active ? " is-active" : ""}`}
            style={{ "--section-accent": song.accent } as React.CSSProperties}
          >
            <header>
              <div>
                <span>{String(sectionIndex + 1).padStart(2, "0")}</span>
                <strong>{section.label}</strong>
              </div>
              <div className="timeline-section-meta">
                <span>Main {section.variation}</span>
                <span>{section.bars} bars</span>
                {sectionIndex < song.sections.length - 1 && <span>Fill armed</span>}
              </div>
            </header>
            <div className="timeline-rows">
              {Array.from({ length: rows }, (_, row) => {
                const rowStart = row * 4 * beatsPerBar
                const rowEnd = Math.min(sectionBeats, rowStart + 4 * beatsPerBar)
                const rowBeats = rowEnd - rowStart
                const rowGlobalStart = start + rowStart
                const progress = active
                  ? Math.max(0, Math.min(1, (playback.beat - rowGlobalStart) / rowBeats))
                  : playback.beat >= rowGlobalStart + rowBeats ? 1 : 0
                const rowChords = section.chords.filter(
                  (chord) => chord.beat < rowEnd && chord.beat + (chord.duration || 0.25) > rowStart,
                )
                return (
                  <div className="timeline-row" key={`${section.id}-${row}`}>
                    <div className="timeline-bar-numbers">
                      {Array.from({ length: Math.ceil(rowBeats / beatsPerBar) }, (_, bar) => (
                        <span key={bar}>{row * 4 + bar + 1}</span>
                      ))}
                    </div>
                    <div className="timeline-chord-lane">
                      <div className="timeline-beat-grid" />
                      {rowChords.map((chord, chordIndex) => {
                        const visibleStart = Math.max(rowStart, chord.beat)
                        const visibleEnd = Math.min(rowEnd, chord.beat + (chord.duration || beatsPerBar))
                        const left = ((visibleStart - rowStart) / rowBeats) * 100
                        const width = Math.max(3, ((visibleEnd - visibleStart) / rowBeats) * 100)
                        const isCurrent =
                          playback.beat >= start + chord.beat &&
                          playback.beat < start + chord.beat + (chord.duration || beatsPerBar)
                        return (
                          <span
                            key={`${chord.beat}-${chordIndex}`}
                            className={`timeline-chord${isCurrent ? " is-current" : ""}${chord.beat < rowStart ? " is-spill" : ""}`}
                            style={{ left: `${left}%`, width: `${width}%` }}
                          >
                            {chord.name}
                          </span>
                        )
                      })}
                      {progress > 0 && progress < 1 && (
                        <i className="timeline-playhead" style={{ left: `${progress * 100}%` }} />
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

export function JamPlayerDemo() {
  const [session, midi] = useMidiSession()
  const [category, setCategory] = useState<SongCategory>("Pop")
  const [songId, setSongId] = useState(songs[0].id)
  const [genre, setGenre] = useState<StyleGenre>("Pop")
  const [playback, setPlayback] = useState(initialPlayback)
  const [notice, setNotice] = useState("")
  const [engagements, setEngagements] = useState(0)
  const scheduler = useRef<JamScheduler | null>(null)

  const visibleSongs = useMemo(
    () => songs.filter((song) => song.category === category),
    [category],
  )
  const song = songs.find((candidate) => candidate.id === songId) || visibleSongs[0]

  useEffect(() => {
    scheduler.current = new JamScheduler(session, setPlayback)
    return () => scheduler.current?.stop()
  }, [session])

  useEffect(() => {
    if (!visibleSongs.some((candidate) => candidate.id === songId)) {
      setSongId(visibleSongs[0].id)
    }
  }, [songId, visibleSongs])

  const stop = () => scheduler.current?.stop()

  const togglePlay = () => {
    if (playback.playing) {
      stop()
      return
    }
    if (!midi.connected || !midi.profile) {
      setNotice("Connect a supported Yamaha keyboard before starting the arrangement.")
      return
    }
    setNotice("")
    scheduler.current?.start(song, midi.profile.styleMappings[genre])
    setEngagements((value) => value + 1)
  }

  const changeGenre = (next: StyleGenre) => {
    setGenre(next)
    if (midi.profile && playback.playing) {
      scheduler.current?.changeStyle(midi.profile.styleMappings[next])
      setNotice(`Same arrangement, now playing ${next} on ${midi.profile.displayName}.`)
      setEngagements((value) => value + 1)
    }
  }

  return (
    <DemoShell
      title="Jam Player"
      eyebrow="Play any song instantly"
      step="Choose · Connect · Play · Transform"
      onSafeStop={stop}
    >
      <div className="jam-layout">
        <aside className="jam-library">
          <div className="panel-heading">
            <span>Song library</span>
            <strong>16 complete 4/4 arrangements</strong>
          </div>
          <div className="category-tabs" role="tablist" aria-label="Song categories">
            {categories.map((item) => (
              <button
                key={item}
                type="button"
                className={item === category ? "is-active" : ""}
                onClick={() => setCategory(item)}
              >
                {item}
                <span>{songs.filter((songItem) => songItem.category === item).length}</span>
              </button>
            ))}
          </div>
          <div className="song-list">
            {visibleSongs.map((item) => (
              <button
                key={item.id}
                type="button"
                className={item.id === song.id ? "is-active" : ""}
                onClick={() => {
                  stop()
                  setSongId(item.id)
                  setEngagements((value) => value + 1)
                }}
              >
                <i style={{ background: item.accent }} />
                <span>
                  <strong>{item.title}</strong>
                  <small>{item.key} · {item.tempo} BPM · {item.sections.length} sections</small>
                </span>
              </button>
            ))}
          </div>
        </aside>

        <section className="jam-stage">
          <header className="jam-song-header">
            <div className="song-art" style={{ "--song-accent": song.accent } as React.CSSProperties}>
              <Sparkles size={26} />
              <span>SB</span>
            </div>
            <div>
              <span className="demo-eyebrow">{song.category} · Original progression</span>
              <h1>{song.title}</h1>
              <p>{song.subtitle}</p>
            </div>
            <div className="song-facts">
              <span><small>Tempo</small><strong>{song.tempo}</strong></span>
              <span><small>Key</small><strong>{song.key}</strong></span>
              <span><small>Meter</small><strong>4/4</strong></span>
            </div>
          </header>

          <div className="performance-strip">
            <button className="transport-main" type="button" onClick={togglePlay}>
              {playback.playing ? <Pause size={22} /> : <Play size={22} fill="currentColor" />}
              {playback.playing ? "Pause" : "Play arrangement"}
            </button>
            <button className="transport-stop" type="button" onClick={stop} disabled={!playback.playing}>
              <Square size={17} fill="currentColor" /> Stop
            </button>
            <button
              className="transport-stop"
              type="button"
              onClick={() => {
                stop()
                if (midi.connected && midi.profile) scheduler.current?.start(song, midi.profile.styleMappings[genre])
              }}
              disabled={!playback.playing}
            >
              <RotateCcw size={17} /> Restart
            </button>
            <div className="live-readout">
              <span><small>Now</small><strong>{playback.currentChord || "—"}</strong></span>
              <span><small>Next</small><strong>{playback.upcomingChord || "—"}</strong></span>
              <span><small>Arranger</small><strong>{playback.arrangerState}</strong></span>
            </div>
          </div>

          <div className="genre-transform">
            <div>
              <span className="demo-eyebrow">Transform the keyboard</span>
              <strong>Keep the song. Change the entire band.</strong>
            </div>
            <div className="genre-buttons">
              {genres.map((item) => (
                <button
                  key={item}
                  className={item === genre ? "is-active" : ""}
                  type="button"
                  onClick={() => changeGenre(item)}
                >
                  {item}
                  {midi.profile && <small>{midi.profile.styleMappings[item].name}</small>}
                </button>
              ))}
            </div>
          </div>

          {notice && <div className="demo-status" role="status">{notice}</div>}
          <SongTimeline song={song} playback={playback} />
        </section>
      </div>
      <FeedbackPrompt meaningfulActions={engagements} />
    </DemoShell>
  )
}
