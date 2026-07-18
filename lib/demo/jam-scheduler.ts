import type { DemoSong, SongSection, StyleWireMapping } from "@/lib/demo/types"
import {
  ARRANGER_COMMANDS,
  chordNotes,
  chordOffMessages,
  chordOnMessages,
  fillCommand,
  mainCommand,
  styleSelectCommand,
  tempoCommand,
} from "@/lib/demo/yamaha/commands"
import type { MidiMessageDetail, YamahaMidiSession } from "@/lib/demo/yamaha/midi-session"
import { TempoFollower } from "@/lib/demo/yamaha/tempo-follower"

/** Match desktop JamPlayerScreen chord lead (~50ms). */
export const CHORD_ANTICIPATION_MS = 50

/** Wait this long for keyboard F8 before starting the beat clock anyway. */
const CLOCK_FALLBACK_MS = 120

export type ScheduledJamEvent = {
  id: string
  beat: number
  dispatchBeat: number
  type: "chord" | "main" | "fill" | "break" | "ending" | "section"
  chord?: string
  section?: SongSection
}

export type JamPlaybackState = {
  playing: boolean
  beat: number
  totalBeats: number
  bpm: number
  currentChord: string
  upcomingChord: string
  currentSection: string
  arrangerState: string
}

export function buildJamSchedule(
  song: DemoSong,
  anticipationMs = CHORD_ANTICIPATION_MS,
  tempoBpm = song.tempo,
): ScheduledJamEvent[] {
  const beatsPerBar = song.timeSignature[0]
  const anticipationBeats = (anticipationMs * tempoBpm) / 60000
  const events: ScheduledJamEvent[] = []
  let sectionStart = beatsPerBar

  song.sections.forEach((section, sectionIndex) => {
    events.push({
      id: `section-${section.id}`,
      beat: sectionStart,
      dispatchBeat: sectionStart,
      type: "section",
      section,
    })
    events.push({
      id: `main-${section.id}`,
      beat: sectionStart,
      dispatchBeat: sectionStart,
      type: "main",
      section,
    })

    section.chords.forEach((chord, chordIndex) => {
      const beat = sectionStart + chord.beat
      const firstChordOfSong = sectionIndex === 0 && chordIndex === 0
      events.push({
        id: `chord-${section.id}-${chordIndex}`,
        beat,
        dispatchBeat: firstChordOfSong ? beat : Math.max(0, beat - anticipationBeats),
        type: "chord",
        chord: chord.name,
        section,
      })
    })

    const sectionEnd = sectionStart + section.bars * beatsPerBar
    if (sectionIndex < song.sections.length - 1) {
      const next = song.sections[sectionIndex + 1]
      // Desktop fires fill ~0.2 beats before the last-bar line.
      const fillBeat = sectionEnd - beatsPerBar - 0.2
      events.push({
        id: `transition-${section.id}`,
        beat: sectionEnd - beatsPerBar,
        dispatchBeat: fillBeat,
        type: section.transition === "break" ? "break" : "fill",
        section: next,
      })
    } else {
      events.push({
        id: "ending-1",
        beat: sectionEnd,
        dispatchBeat: sectionEnd,
        type: "ending",
      })
    }
    sectionStart = sectionEnd
  })

  return events.sort(
    (a, b) => a.dispatchBeat - b.dispatchBeat || a.id.localeCompare(b.id),
  )
}

/**
 * Jam scheduler matching desktop SmartBridge Slave (Keyboard Master) mode:
 * - Push song tempo to the keyboard via SysEx
 * - Do NOT send MIDI clock / Start / Stop (Tyros ignores external clock for styles)
 * - Follow keyboard Port-1 F8 for live BPM once locked
 * - Hold the beat clock until the keyboard clock starts (avoids playhead lag)
 * - Report a visual beat that includes chord anticipation so the cursor sits on
 *   the sounding block, not behind it
 */
export class JamScheduler {
  private timer: ReturnType<typeof setInterval> | null = null
  private lastTickMs = 0
  private beatPosition = 0
  private startBeat = 0
  private liveBpm = 120
  private songTempo = 120
  private anticipationBeats = 0
  private events: ScheduledJamEvent[] = []
  private sent = new Set<string>()
  private heldNotes: number[] = []
  private playing = false
  private transportArmed = false
  private playCommandMs = 0
  private tempoFollower = new TempoFollower()
  private onMidi: ((event: Event) => void) | null = null
  private state: JamPlaybackState = {
    playing: false,
    beat: 0,
    totalBeats: 0,
    bpm: 120,
    currentChord: "",
    upcomingChord: "",
    currentSection: "",
    arrangerState: "Ready",
  }

  constructor(
    private readonly session: YamahaMidiSession,
    private readonly onState: (state: JamPlaybackState) => void,
  ) {
    this.onMidi = (event: Event) => {
      const detail = (event as CustomEvent<MidiMessageDetail>).detail
      if (!detail) return
      // Desktop follows style clock on Port 1 only (avoid doubled F8 from Port 2).
      if (detail.data[0] === 0xf8) {
        if (detail.port !== 1) return
        this.tempoFollower.handleMessage(detail.data)
        this.armTransportFromClock()
        return
      }
      this.tempoFollower.handleMessage(detail.data)
    }
    this.session.addEventListener("midimessage", this.onMidi)
  }

  dispose() {
    this.stop(false)
    if (this.onMidi) {
      this.session.removeEventListener("midimessage", this.onMidi)
      this.onMidi = null
    }
  }

  start(song: DemoSong, style: StyleWireMapping, startBeat = 0) {
    this.stop(false)
    this.songTempo = song.tempo
    this.liveBpm = song.tempo
    this.anticipationBeats = (CHORD_ANTICIPATION_MS * song.tempo) / 60000
    this.tempoFollower.reset()
    this.events = buildJamSchedule(song, CHORD_ANTICIPATION_MS, this.liveBpm)
    this.sent.clear()
    this.startBeat = Math.max(0, startBeat)
    this.beatPosition = this.startBeat
    this.playing = true
    this.transportArmed = false
    const totalBeats =
      song.timeSignature[0] +
      song.sections.reduce(
        (sum, section) => sum + section.bars * song.timeSignature[0],
        0,
      )
    this.state = {
      playing: true,
      beat: this.displayBeat(),
      totalBeats,
      bpm: this.liveBpm,
      currentChord: "",
      upcomingChord: "",
      currentSection: this.beatPosition < song.timeSignature[0] ? "Intro" : "",
      arrangerState: "Intro",
    }

    // Match desktop LocalMidiConnector Slave mode:
    // style/tempo/arranger SysEx → both ports; no FA/F8/FC outbound.
    this.session.sendBoth(styleSelectCommand(style))
    this.session.sendBoth(tempoCommand(song.tempo))
    this.session.sendBoth(ARRANGER_COMMANDS.start)

    if (this.beatPosition > 0) {
      this.events.forEach((event) => {
        if (event.dispatchBeat <= this.beatPosition) this.sent.add(event.id)
      })
      this.primeMidSong(song, this.beatPosition)
    } else {
      this.session.sendBoth(ARRANGER_COMMANDS.intro1)
    }

    // Desktop anchors the section clock AFTER startup MIDI so the first tick
    // does not include command latency (which made the playhead appear late).
    this.playCommandMs = performance.now()
    this.lastTickMs = this.playCommandMs
    // Section jumps skip intro — start the beat clock immediately (desktop playClip).
    if (this.startBeat > 0) {
      this.transportArmed = true
    }
    this.onState(this.state)
    this.timer = setInterval(() => this.tick(song), 10)
  }

  private armTransportFromClock() {
    if (!this.playing || this.transportArmed) return
    this.transportArmed = true
    this.beatPosition = this.startBeat
    this.lastTickMs = performance.now()
  }

  private displayBeat() {
    // Lead the cursor by the same amount chords are sent early so the line
    // sits on the sounding block instead of trailing it.
    return this.beatPosition + this.anticipationBeats
  }

  private primeMidSong(song: DemoSong, beat: number) {
    const activeSection = [...this.events]
      .filter((event) => event.type === "section" && event.beat <= beat)
      .at(-1)
    if (activeSection?.section) {
      this.session.sendBoth(mainCommand(activeSection.section.variation))
      this.sent.add(`main-${activeSection.section.id}`)
      this.sent.add(`section-${activeSection.section.id}`)
      this.state.arrangerState = `Main ${activeSection.section.variation}`
    }
    const activeChord = [...this.events]
      .filter((event) => event.type === "chord" && event.beat <= beat)
      .at(-1)
    if (activeChord?.chord) this.sendChord(activeChord.chord)
    this.state.currentSection = activeSection?.section?.label || song.sections[0]?.label || ""
  }

  changeStyle(style: StyleWireMapping) {
    this.session.sendBoth(styleSelectCommand(style))
  }

  changeHarmony(song: DemoSong) {
    if (!this.playing) return
    const beat = this.beatPosition
    this.events = buildJamSchedule(song, CHORD_ANTICIPATION_MS, this.liveBpm)
    this.anticipationBeats = (CHORD_ANTICIPATION_MS * this.liveBpm) / 60000
    this.sent.clear()
    this.events.forEach((event) => {
      if (event.dispatchBeat <= beat) this.sent.add(event.id)
    })

    const activeChord = [...this.events]
      .filter((event) => event.type === "chord" && event.beat <= beat)
      .at(-1)
    const upcomingChord = this.events.find(
      (event) => event.type === "chord" && event.beat > beat,
    )
    if (activeChord?.chord) this.sendChord(activeChord.chord)
    this.state = {
      ...this.state,
      beat: this.displayBeat(),
      currentChord: activeChord?.chord || "",
      upcomingChord: upcomingChord?.chord || "",
    }
    this.onState(this.state)

    if (this.timer) clearInterval(this.timer)
    this.timer = setInterval(() => this.tick(song), 10)
  }

  /**
   * Prefer the song tempo we pushed via SysEx until the keyboard clock has a
   * stable lock. Early F8 intervals during style ramp-up read too slow and
   * drag the playhead behind the blocks.
   */
  private syncLiveBpm() {
    if (!this.tempoFollower.isTempoLocked()) {
      this.liveBpm = this.songTempo
      return
    }
    const followed = this.tempoFollower.getCurrentBPM()
    if (followed < 30 || followed > 300) {
      this.liveBpm = this.songTempo
      return
    }
    const rounded = Math.round(followed)
    // Ignore wild readings far from the commanded tempo (missed/duped clocks).
    if (Math.abs(rounded - this.songTempo) > Math.max(8, this.songTempo * 0.08)) {
      this.liveBpm = this.songTempo
      return
    }
    if (Math.abs(rounded - this.liveBpm) >= 1) {
      this.liveBpm = rounded
      this.anticipationBeats = (CHORD_ANTICIPATION_MS * this.liveBpm) / 60000
    }
  }

  private tick(song: DemoSong) {
    if (!this.playing) return

    const now = performance.now()
    if (!this.transportArmed) {
      if (
        this.tempoFollower.hasReceivedClock() ||
        now - this.playCommandMs >= CLOCK_FALLBACK_MS
      ) {
        this.transportArmed = true
        this.beatPosition = this.startBeat
        this.lastTickMs = now
      } else {
        this.onState({
          ...this.state,
          beat: this.displayBeat(),
          bpm: this.liveBpm,
        })
        return
      }
    }

    this.syncLiveBpm()

    const elapsedSec = (now - this.lastTickMs) / 1000
    this.lastTickMs = now
    this.beatPosition += elapsedSec * (this.liveBpm / 60)
    const beat = this.beatPosition
    const uiBeat = this.displayBeat()

    for (const event of this.events) {
      if (this.sent.has(event.id) || event.dispatchBeat > beat) continue
      this.sent.add(event.id)
      this.dispatch(event)
    }

    const activeChord = [...this.events]
      .filter((event) => event.type === "chord" && event.beat <= uiBeat)
      .at(-1)
    const upcomingChord = this.events.find(
      (event) => event.type === "chord" && event.beat > uiBeat,
    )
    const activeSection = [...this.events]
      .filter((event) => event.type === "section" && event.beat <= uiBeat)
      .at(-1)

    this.state = {
      ...this.state,
      beat: Math.min(uiBeat, this.state.totalBeats),
      bpm: this.liveBpm,
      currentChord: activeChord?.chord || this.state.currentChord,
      upcomingChord: upcomingChord?.chord || "",
      currentSection:
        uiBeat < song.timeSignature[0]
          ? "Intro"
          : activeSection?.section?.label || this.state.currentSection,
    }
    this.onState(this.state)
    if (beat > this.state.totalBeats + song.timeSignature[0] * 2) this.stop()
  }

  private dispatch(event: ScheduledJamEvent) {
    switch (event.type) {
      case "chord":
        if (event.chord) this.sendChord(event.chord)
        break
      case "main":
        if (event.section) {
          this.session.sendBoth(mainCommand(event.section.variation))
          this.state.arrangerState = `Main ${event.section.variation}`
        }
        break
      case "fill":
        if (event.section) {
          this.session.sendBoth(fillCommand(event.section.variation))
          this.state.arrangerState = `Fill to Main ${event.section.variation}`
        }
        break
      case "break":
        this.session.sendBoth(ARRANGER_COMMANDS.break)
        this.state.arrangerState = "Break"
        break
      case "ending":
        this.session.sendBoth(ARRANGER_COMMANDS.ending1)
        this.state.arrangerState = "Ending 1"
        this.releaseChord()
        break
      case "section":
        if (event.section) this.state.currentSection = event.section.label
        break
    }
  }

  private releaseChord() {
    chordOffMessages(this.heldNotes).forEach((message) => this.session.sendPort1(message))
    this.heldNotes = []
  }

  private sendChord(chord: string) {
    this.releaseChord()
    this.heldNotes = chordNotes(chord)
    chordOnMessages(chord).forEach((message) => this.session.sendPort1(message))
  }

  stop(sendStop = true) {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    this.releaseChord()
    if (sendStop && this.playing) {
      this.session.sendBoth(ARRANGER_COMMANDS.stop)
      this.session.panic()
    }
    this.playing = false
    this.transportArmed = false
    this.sent.clear()
    this.state = { ...this.state, playing: false, arrangerState: "Stopped" }
    this.onState(this.state)
  }
}
