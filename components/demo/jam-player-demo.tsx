"use client"

import { ArrowLeft, Pause, Play, RotateCcw, Sparkles, Square } from "lucide-react"
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
  const [choosingSong, setChoosingSong] = useState(true)
  const [showFullSong, setShowFullSong] = useState(false)
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
      step="Four easy steps"
      onSafeStop={stop}
    >
      <div className="guided-demo-page">
        <nav className="guided-progress" aria-label="Jam Player progress">
          <span className="is-complete"><i>1</i> Keyboard connected</span>
          <span className={choosingSong ? "is-current" : "is-complete"}><i>2</i> Choose a song</span>
          <span className={!choosingSong ? "is-current" : ""}><i>3</i> Play</span>
          <span><i>4</i> Change the band</span>
        </nav>

        {choosingSong ? (
          <section className="guided-card">
            <span className="demo-eyebrow">Step 2 of 4</span>
            <h1>Choose a song</h1>
            <p className="guided-instruction">First choose a type of music, then choose one of the two songs.</p>
            <div className="senior-category-grid" role="tablist" aria-label="Song types">
              {categories.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={item === category ? "is-selected" : ""}
                  onClick={() => setCategory(item)}
                >
                  <span className="selection-light" />{item}
                </button>
              ))}
            </div>
            <div className="senior-song-grid">
              {visibleSongs.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={item.id === song.id ? "is-selected" : ""}
                  onClick={() => {
                    stop()
                    setSongId(item.id)
                    setEngagements((value) => value + 1)
                  }}
                >
                  <span className="selection-light" />
                  <strong>{item.title}</strong>
                  <span>{item.tempo} BPM · Key of {item.key}</span>
                </button>
              ))}
            </div>
            <button className="senior-primary-action" type="button" onClick={() => setChoosingSong(false)}>
              Continue with {song.title}
            </button>
          </section>
        ) : (
        <section className="jam-stage guided-card">
          <button className="senior-back-button" type="button" onClick={() => { stop(); setChoosingSong(true) }}>
            <ArrowLeft size={20} /> Choose a different song
          </button>
          <header className="jam-song-header">
            <div className="song-art" style={{ "--song-accent": song.accent } as React.CSSProperties}>
              <Sparkles size={26} />
              <span>SB</span>
            </div>
            <div>
              <span className="demo-eyebrow">Your selected song</span>
              <h1>{song.title}</h1>
              <p>{song.subtitle}</p>
            </div>
            <div className="song-facts">
              <span><small>Tempo</small><strong>{song.tempo}</strong></span>
              <span><small>Key</small><strong>{song.key}</strong></span>
              <span><small>Meter</small><strong>4/4</strong></span>
            </div>
          </header>

          <div className="performance-strip senior-transport">
            <button className="transport-main" type="button" onClick={togglePlay}>
              {playback.playing ? <Pause size={22} /> : <Play size={22} fill="currentColor" />}
              {playback.playing ? "Pause song" : "Play song"}
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
              <span><small>Song section</small><strong>{playback.currentSection || playback.arrangerState}</strong></span>
            </div>
          </div>

          <div className="genre-transform">
            <div>
              <span className="demo-eyebrow">Step 4 of 4</span>
              <strong>Change the band while the song keeps playing</strong>
            </div>
            <div className="genre-buttons">
              {genres.map((item) => (
                <button
                  key={item}
                  className={item === genre ? "is-active" : ""}
                  type="button"
                  onClick={() => changeGenre(item)}
                >
                  <span className="selection-light" />{item}
                </button>
              ))}
            </div>
          </div>

          {notice && <div className="demo-status" role="status">{notice}</div>}
          <section className="simple-song-progress">
            <div><small>Now playing</small><strong>{playback.currentSection || "Ready to begin"}</strong></div>
            <div><small>Current chord</small><strong>{playback.currentChord || "—"}</strong></div>
            <div><small>Next chord</small><strong>{playback.upcomingChord || "—"}</strong></div>
            <button type="button" onClick={() => setShowFullSong((value) => !value)}>
              {showFullSong ? "Hide full song" : "Show full song"}
            </button>
          </section>
          {showFullSong && <SongTimeline song={song} playback={playback} />}
        </section>
        )}
      </div>
      <FeedbackPrompt meaningfulActions={engagements} />
    </DemoShell>
  )
}
