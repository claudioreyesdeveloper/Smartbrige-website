/**
 * Port of SmartBridge TyrosTempoFollower.
 *
 * Yamaha arrangers own style tempo and do not follow external MIDI clock.
 * SmartBridge (and this demo) measure BPM from the keyboard's F8 pulses and
 * Style Tempo Control SysEx, then advance the timeline with that rate.
 */

const MIDI_CLOCK = 0xf8
const MIDI_START = 0xfa
const MIDI_CONTINUE = 0xfb
const MIDI_STOP = 0xfc

const SMOOTHING_FACTOR = 0.8
const CLOCK_LOSS_THRESHOLD_MS = 200
const LOCK_MIN_BEATS = 2

export class TempoFollower {
  private enabled = true
  private playing = false
  private clockActive = false
  private tickCount = 0
  private lastTickTime = 0
  private previousBeatTimestamp = 0
  private smoothedBpm = 0
  private tempoStable = false
  private beatPhase = 0
  private beatSamples = 0
  private sawFirstClock = false

  reset() {
    this.tickCount = 0
    this.lastTickTime = 0
    this.previousBeatTimestamp = 0
    this.smoothedBpm = 0
    this.tempoStable = false
    this.beatPhase = 0
    this.beatSamples = 0
    this.sawFirstClock = false
    this.playing = false
    this.clockActive = false
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled
    if (!enabled) this.playing = false
  }

  /** True after the first F8 since reset — style transport is running. */
  hasReceivedClock(): boolean {
    return this.sawFirstClock
  }

  getTickCount(): number {
    return this.tickCount
  }

  /** Smoothed BPM from keyboard F8, or 0 if not yet locked. */
  getCurrentBPM(nowMs = performance.now()): number {
    if (this.lastTickTime > 0 && nowMs - this.lastTickTime > CLOCK_LOSS_THRESHOLD_MS) {
      return this.tempoStable ? this.smoothedBpm : 0
    }
    return this.tempoStable ? this.smoothedBpm : 0
  }

  /** True once we have enough beat-boundary samples for a trustworthy rate. */
  isTempoLocked(): boolean {
    return this.tempoStable && this.beatSamples >= LOCK_MIN_BEATS
  }

  isClockActive(nowMs = performance.now()): boolean {
    return (
      this.clockActive &&
      this.lastTickTime > 0 &&
      nowMs - this.lastTickTime <= CLOCK_LOSS_THRESHOLD_MS
    )
  }

  /** Apply Style Tempo Control SysEx: F0 43 7E 01 t4 t3 t2 t1 F7 → BPM. */
  applyStyleTempoSysex(data: Uint8Array): number | null {
    let body = data
    if (data[0] === 0xf0) body = data.subarray(1, data.length - (data[data.length - 1] === 0xf7 ? 1 : 0))
    if (body.length < 7 || body[0] !== 0x43 || body[1] !== 0x7e || body[2] !== 0x01) {
      return null
    }
    const micros =
      ((body[3] & 0x7f) << 21) |
      ((body[4] & 0x7f) << 14) |
      ((body[5] & 0x7f) << 7) |
      (body[6] & 0x7f)
    if (micros <= 0) return null
    const bpm = Math.round(60_000_000 / micros)
    if (bpm < 20 || bpm > 400) return null
    this.smoothedBpm = bpm
    this.tempoStable = true
    this.beatSamples = Math.max(this.beatSamples, LOCK_MIN_BEATS)
    return bpm
  }

  handleMessage(data: Uint8Array, nowMs = performance.now()) {
    if (!this.enabled || data.length === 0) return
    switch (data[0]) {
      case MIDI_CLOCK:
        this.handleClock(nowMs)
        break
      case MIDI_START:
        this.handleStart()
        break
      case MIDI_CONTINUE:
        this.playing = true
        this.clockActive = true
        break
      case MIDI_STOP:
        this.playing = false
        this.clockActive = false
        break
      default:
        this.applyStyleTempoSysex(data)
        break
    }
  }

  private handleStart() {
    this.playing = true
    this.clockActive = true
    this.tickCount = 0
    this.beatPhase = 0
    this.previousBeatTimestamp = 0
    this.beatSamples = 0
    this.sawFirstClock = false
  }

  private handleClock(nowMs: number) {
    this.clockActive = true
    this.sawFirstClock = true
    this.lastTickTime = nowMs
    this.tickCount += 1
    this.beatPhase = this.tickCount % 24

    if (this.beatPhase !== 0) return

    if (this.previousBeatTimestamp > 0) {
      const elapsedMs = nowMs - this.previousBeatTimestamp
      if (elapsedMs > 0) {
        const rawBpm = 60000 / elapsedMs
        if (rawBpm >= 30 && rawBpm <= 300) {
          this.beatSamples += 1
          if (!this.tempoStable) {
            this.smoothedBpm = rawBpm
            this.tempoStable = true
          } else {
            this.smoothedBpm =
              this.smoothedBpm * SMOOTHING_FACTOR + rawBpm * (1 - SMOOTHING_FACTOR)
          }
        }
      }
    }
    this.previousBeatTimestamp = nowMs
  }
}
