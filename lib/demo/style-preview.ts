import type { YamahaMidiSession } from "@/lib/demo/yamaha/midi-session"
import type { MidiPreviewEvent } from "@/lib/demo/style-midi"

export class StylePreviewPlayer {
  private timers: ReturnType<typeof setTimeout>[] = []
  private playing = false

  constructor(
    private readonly session: YamahaMidiSession,
    private readonly onStop: () => void = () => {},
  ) {}

  play(
    events: MidiPreviewEvent[],
    ticksPerQuarter: number,
    bpm: number,
    maxBars = 8,
  ) {
    this.stop()
    if (!events.length) throw new Error("This style section has no MIDI events to preview.")
    const millisecondsPerTick = 60000 / Math.max(20, bpm) / ticksPerQuarter
    const maxTick = ticksPerQuarter * 4 * maxBars
    const preview = events.filter((event) => event.tick <= maxTick)
    const startTick = preview[0]?.tick || 0
    this.playing = true

    preview.forEach((event) => {
      const timer = setTimeout(() => {
        if (!this.playing) return
        this.session.sendPort1(
          Uint8Array.of(event.status, event.data1, event.data2),
        )
      }, Math.max(0, (event.tick - startTick) * millisecondsPerTick))
      this.timers.push(timer)
    })

    const duration =
      Math.max(...preview.map((event) => event.tick - startTick)) *
        millisecondsPerTick +
      250
    this.timers.push(
      setTimeout(() => {
        this.stop()
        this.onStop()
      }, duration),
    )
  }

  stop() {
    this.playing = false
    this.timers.forEach(clearTimeout)
    this.timers = []
    this.session.panic()
  }
}
