import type { MidiSendTarget, YamahaMidiSession } from "@/lib/demo/yamaha/midi-session"
import {
  chordNotes,
  chordOffMessages,
  chordOnMessages,
} from "@/lib/demo/yamaha/commands"
import type { MidiPreviewEvent } from "@/lib/demo/style-midi"

export class StylePreviewPlayer {
  private timers: ReturnType<typeof setTimeout>[] = []
  private playing = false
  private heldChordNotes: number[] = []

  constructor(
    private readonly session: YamahaMidiSession,
    private readonly onStop: () => void = () => {},
  ) {}

  private releaseChord() {
    if (!this.heldChordNotes.length) return
    chordOffMessages(this.heldChordNotes).forEach((message) =>
      this.session.sendPort1(message),
    )
    this.heldChordNotes = []
  }

  private holdChord(chordName: string | undefined) {
    this.releaseChord()
    if (!chordName?.trim()) return
    this.heldChordNotes = chordNotes(chordName)
    chordOnMessages(chordName).forEach((message) => this.session.sendPort1(message))
  }

  private sendEvent(event: MidiPreviewEvent, target: MidiSendTarget) {
    const kind = event.status & 0xf0
    const channel = event.status & 0x0f

    // Yamaha style parts are channels 9-16 on Port 2. Match the desktop
    // StyleMakerAudition path for both XG voice setup and performance data.
    if (channel >= 8 && channel <= 15 && target !== "port1") {
      let parameter = 0
      let value = 0
      if (kind === 0xb0 && event.data[0] === 0) {
        parameter = 0x01
        value = event.data[1] || 0
      } else if (kind === 0xb0 && event.data[0] === 32) {
        parameter = 0x02
        value = event.data[1] || 0
      } else if (kind === 0xc0) {
        parameter = 0x03
        value = event.data[0] || 0
      }

      if (parameter) {
        const sysex = Uint8Array.of(
          0xf0, 0x43, 0x10, 0x4c, 0x08, channel, parameter, value & 0x7f, 0xf7,
        )
        if (target === "both") {
          this.session.sendPort2(sysex)
          this.session.sendPort1(Uint8Array.of(event.status, ...event.data))
        } else {
          this.session.sendPort2(sysex)
        }
        return
      }
    }

    const message = Uint8Array.of(event.status, ...event.data)
    if (target === "port1") this.session.sendPort1(message)
    else if (target === "both") this.session.sendBoth(message)
    else this.session.sendPort2(message)
  }

  play(
    events: MidiPreviewEvent[],
    ticksPerQuarter: number,
    bpm: number,
    maxBars = 8,
    options?: {
      holdChord?: string
      port?: MidiSendTarget
      /** Optional setup messages sent immediately before the first note (Port 2). */
      setupMessages?: Uint8Array[]
    },
  ) {
    this.stop({ silent: true })
    if (!events.length) throw new Error("Nothing to audition — no MIDI events in this selection.")
    this.holdChord(options?.holdChord)
    const port = options?.port || "port2"
    options?.setupMessages?.forEach((message) => this.session.sendPort2(message))
    const setupLeadMs = options?.setupMessages?.length ? 60 : 0
    const millisecondsPerTick = 60000 / Math.max(20, bpm) / ticksPerQuarter
    const startTick = events[0]?.tick || 0
    const maxTick = startTick + ticksPerQuarter * 4 * Math.max(1, maxBars)
    const preview = events.filter((event) => event.tick <= maxTick)
    if (!preview.length) {
      throw new Error("Nothing to audition — no MIDI events in this selection.")
    }
    this.playing = true

    preview.forEach((event) => {
      const timer = setTimeout(() => {
        if (!this.playing) return
        this.sendEvent(event, port)
      }, setupLeadMs + Math.max(0, (event.tick - startTick) * millisecondsPerTick))
      this.timers.push(timer)
    })

    const duration =
      setupLeadMs +
      Math.max(...preview.map((event) => event.tick - startTick)) *
        millisecondsPerTick +
      250
    this.timers.push(
      setTimeout(() => {
        this.stop()
      }, duration),
    )
  }

  stop(options?: { silent?: boolean }) {
    const wasPlaying = this.playing
    this.playing = false
    this.timers.forEach(clearTimeout)
    this.timers = []
    this.releaseChord()
    this.session.panic()
    if (!options?.silent && wasPlaying) this.onStop()
  }
}
