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
import type { YamahaMidiSession } from "@/lib/demo/yamaha/midi-session"

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
  currentChord: string
  upcomingChord: string
  currentSection: string
  arrangerState: string
}

export function buildJamSchedule(song: DemoSong, anticipationMs = 85): ScheduledJamEvent[] {
  const beatsPerBar = song.timeSignature[0]
  const anticipationBeats = (anticipationMs * song.tempo) / 60000
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
      events.push({
        id: `transition-${section.id}`,
        beat: sectionEnd - beatsPerBar,
        dispatchBeat: sectionEnd - beatsPerBar,
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

export class JamScheduler {
  private timer: ReturnType<typeof setInterval> | null = null
  private anchorMs = 0
  private events: ScheduledJamEvent[] = []
  private sent = new Set<string>()
  private heldNotes: number[] = []
  private lastClockPulse = -1
  private playing = false
  private startBeat = 0
  private state: JamPlaybackState = {
    playing: false,
    beat: 0,
    totalBeats: 0,
    currentChord: "",
    upcomingChord: "",
    currentSection: "",
    arrangerState: "Ready",
  }

  constructor(
    private readonly session: YamahaMidiSession,
    private readonly onState: (state: JamPlaybackState) => void,
  ) {}

  start(song: DemoSong, style: StyleWireMapping, startBeat = 0) {
    this.stop(false)
    this.events = buildJamSchedule(song)
    this.sent.clear()
    this.startBeat = Math.max(0, startBeat)
    this.anchorMs = performance.now()
    this.playing = true
    this.lastClockPulse = Math.floor(this.startBeat * 24) - 1
    const totalBeats =
      song.timeSignature[0] +
      song.sections.reduce(
        (sum, section) => sum + section.bars * song.timeSignature[0],
        0,
      )
    this.state = {
      playing: true,
      beat: this.startBeat,
      totalBeats,
      currentChord: "",
      upcomingChord: "",
      currentSection: this.startBeat < song.timeSignature[0] ? "Intro" : "",
      arrangerState: "Intro",
    }

    // Match desktop LocalMidiConnector: style/arranger SysEx → both ports;
    // FA/FC realtime transport → Port 1 only.
    this.session.sendBoth(styleSelectCommand(style))
    this.session.sendBoth(tempoCommand(song.tempo))
    this.session.sendPort1(ARRANGER_COMMANDS.midiStart)
    this.session.sendBoth(ARRANGER_COMMANDS.start)
    this.session.sendBoth(ARRANGER_COMMANDS.intro1, performance.now() + 50)

    if (this.startBeat > 0) this.primeMidSong(song, this.startBeat)
    this.onState(this.state)
    this.timer = setInterval(() => this.tick(song), 10)
  }

  private primeMidSong(song: DemoSong, beat: number) {
    const activeSection = [...this.events]
      .filter((event) => event.type === "section" && event.beat <= beat)
      .at(-1)
    if (activeSection?.section) {
      this.session.sendBoth(mainCommand(activeSection.section.variation))
      this.sent.add(`main-${activeSection.section.id}`)
      this.sent.add(`section-${activeSection.section.id}`)
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
    const beat = this.currentBeat(song)
    this.events = buildJamSchedule(song)
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
      currentChord: activeChord?.chord || "",
      upcomingChord: upcomingChord?.chord || "",
    }
    this.onState(this.state)

    if (this.timer) clearInterval(this.timer)
    this.timer = setInterval(() => this.tick(song), 10)
  }

  private currentBeat(song: DemoSong) {
    return this.startBeat + ((performance.now() - this.anchorMs) * song.tempo) / 60000
  }

  private tick(song: DemoSong) {
    if (!this.playing) return
    const beat = this.currentBeat(song)
    const clockPulse = Math.floor(beat * 24)
    while (this.lastClockPulse < clockPulse) {
      this.lastClockPulse += 1
      this.session.sendPort1(ARRANGER_COMMANDS.midiClock)
    }

    for (const event of this.events) {
      if (this.sent.has(event.id) || event.dispatchBeat > beat) continue
      this.sent.add(event.id)
      this.dispatch(event)
    }

    const activeChord = [...this.events]
      .filter((event) => event.type === "chord" && event.beat <= beat)
      .at(-1)
    const upcomingChord = this.events.find(
      (event) => event.type === "chord" && event.beat > beat,
    )
    const activeSection = [...this.events]
      .filter((event) => event.type === "section" && event.beat <= beat)
      .at(-1)

    this.state = {
      ...this.state,
      beat: Math.min(beat, this.state.totalBeats),
      currentChord: activeChord?.chord || this.state.currentChord,
      upcomingChord: upcomingChord?.chord || "",
      currentSection:
        beat < song.timeSignature[0]
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
      this.session.sendPort1(ARRANGER_COMMANDS.midiStop)
      this.session.panic()
    }
    this.playing = false
    this.sent.clear()
    this.state = { ...this.state, playing: false, arrangerState: "Stopped" }
    this.onState(this.state)
  }
}
