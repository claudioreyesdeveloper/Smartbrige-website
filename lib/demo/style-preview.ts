import type { YamahaMidiSession } from "@/lib/demo/yamaha/midi-session"
import type { MidiPreviewEvent } from "@/lib/demo/style-midi"

export class StylePreviewPlayer {
  private timers: ReturnType<typeof setTimeout>[] = []
  private playing = false

  constructor(
    private readonly session: YamahaMidiSession,
    private readonly onStop: () => void = () => {},
  ) {}

  private sendEvent(event: MidiPreviewEvent) {
    const kind = event.status & 0xf0
    const channel = event.status & 0x0f

    // Yamaha style parts are channels 9-16 on Port 2. Match the desktop
    // StyleMakerAudition path for both XG voice setup and performance data.
    if (channel >= 8 && channel <= 15) {
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
        this.session.sendPort2(Uint8Array.of(
          0xf0, 0x43, 0x10, 0x4c, 0x08, channel, parameter, value & 0x7f, 0xf7,
        ))
        return
      }
    }

    this.session.sendPort2(Uint8Array.of(event.status, ...event.data))
  }

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
        this.sendEvent(event)
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
