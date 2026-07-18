/**
 * Port of SmartBridge TyrosTempoFollower (Core/TyrosTempoFollower.cpp).
 *
 * Tyros is the tempo master for style playback. SmartBridge follows MIDI Clock
 * (F8) to derive BPM. Desktop Jam Player Slave mode uses that BPM to advance
 * the chord-grid playhead (wall-clock × BPM/60) — not a fixed song tempo.
 */

import { getMidiSession, type YamahaMidiSession } from "@/lib/yamaha/midi-session"

const MIDI_CLOCK = 0xf8
const MIDI_START = 0xfa
const MIDI_CONTINUE = 0xfb
const MIDI_STOP = 0xfc

const SMOOTHING_FACTOR = 0.8
const CLOCK_LOSS_THRESHOLD_MS = 200
const FAST_LOCK_MIN_SAMPLES = 4
const FAST_LOCK_MAX_VARIANCE = 2.0

export class TyrosTempoFollower {
  private enabled = true
  private isPlaying = false
  private clockActive = false

  private tickCount = 0
  private beatCount = 0
  private lastTickTime = 0

  private previousBeatTimestamp = 0
  private smoothedBPM = 0
  private rawBPM = 0
  private tempoStable = false

  private tempoLockedLatch = false
  private fastLockActive = false
  private fastLockBPMSum = 0
  private fastLockSampleCount = 0
  private fastLockVariance = 0

  private beatPhase = 0

  /** Desktop getCurrentBPM — 0 if not stable / clock lost. */
  getCurrentBPM(): number {
    if (this.lastTickTime > 0) {
      const timeSinceLastTick = performance.now() - this.lastTickTime
      if (timeSinceLastTick > CLOCK_LOSS_THRESHOLD_MS) {
        return this.tempoStable ? this.smoothedBPM : 0
      }
    }
    return this.tempoStable ? this.smoothedBPM : 0
  }

  isClockActive(): boolean {
    if (this.clockActive && this.lastTickTime > 0) {
      return performance.now() - this.lastTickTime <= CLOCK_LOSS_THRESHOLD_MS
    }
    return false
  }

  isTempoLocked(): boolean {
    if (this.tempoLockedLatch) return true
    return this.clockActive && this.tempoStable && !this.fastLockActive
  }

  reset() {
    this.tickCount = 0
    this.beatCount = 0
    this.lastTickTime = 0
    this.previousBeatTimestamp = 0
    this.smoothedBPM = 0
    this.rawBPM = 0
    this.tempoStable = false
    this.beatPhase = 0
    this.isPlaying = false
    this.clockActive = false
    this.fastLockActive = false
    this.tempoLockedLatch = false
    this.fastLockBPMSum = 0
    this.fastLockSampleCount = 0
    this.fastLockVariance = 0
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled
    if (!enabled) this.isPlaying = false
  }

  /** Desktop enableFastLock — rapid snap until variance settles. */
  enableFastLock() {
    this.fastLockActive = true
    this.tempoLockedLatch = false
    this.fastLockBPMSum = 0
    this.fastLockSampleCount = 0
    this.fastLockVariance = 0
    this.tempoStable = false
    this.smoothedBPM = 0
  }

  handleMessage(bytes: Uint8Array) {
    if (!this.enabled || !bytes.length) return
    const status = bytes[0]
    switch (status) {
      case MIDI_CLOCK:
        this.handleMidiClock()
        break
      case MIDI_START:
        this.handleMidiStart()
        break
      case MIDI_CONTINUE:
        this.isPlaying = true
        this.clockActive = true
        break
      case MIDI_STOP:
        this.isPlaying = false
        this.clockActive = false
        break
      default:
        break
    }
  }

  private handleMidiClock() {
    const currentTime = performance.now()
    this.clockActive = true
    this.lastTickTime = currentTime
    this.tickCount += 1
    this.beatPhase = this.tickCount % 24

    if (this.beatPhase !== 0) return

    this.beatCount += 1
    if (this.previousBeatTimestamp > 0) {
      const elapsedMs = currentTime - this.previousBeatTimestamp
      if (elapsedMs > 0) {
        this.rawBPM = 60_000 / elapsedMs
        if (this.rawBPM >= 30 && this.rawBPM <= 300) {
          if (this.fastLockActive) {
            this.smoothedBPM = this.rawBPM
            this.tempoStable = true
            this.fastLockBPMSum += this.rawBPM
            this.fastLockSampleCount += 1
            if (this.fastLockSampleCount >= FAST_LOCK_MIN_SAMPLES) {
              const meanBPM = this.fastLockBPMSum / this.fastLockSampleCount
              const squaredDiff = (this.rawBPM - meanBPM) ** 2
              this.fastLockVariance =
                this.fastLockVariance * 0.8 + squaredDiff * 0.2
              const stdDev = Math.sqrt(this.fastLockVariance)
              if (stdDev < FAST_LOCK_MAX_VARIANCE) {
                this.fastLockActive = false
                this.tempoLockedLatch = true
              }
            }
          } else if (!this.tempoStable) {
            this.smoothedBPM = this.rawBPM
            this.tempoStable = true
          } else {
            this.smoothedBPM =
              this.smoothedBPM * SMOOTHING_FACTOR +
              this.rawBPM * (1 - SMOOTHING_FACTOR)
          }
        }
      }
    }
    this.previousBeatTimestamp = currentTime
  }

  private handleMidiStart() {
    this.isPlaying = true
    this.clockActive = true
    this.tickCount = 0
    this.beatCount = 0
    this.beatPhase = 0
    this.previousBeatTimestamp = 0
  }
}

let sharedFollower: TyrosTempoFollower | null = null
let attachedSession: YamahaMidiSession | null = null
let messageListener: ((event: Event) => void) | null = null

/** Singleton follower attached to the production MIDI session (desktop wiring). */
export function getTyrosTempoFollower(
  session: YamahaMidiSession = getMidiSession(),
): TyrosTempoFollower {
  if (!sharedFollower) sharedFollower = new TyrosTempoFollower()
  if (attachedSession !== session) {
    if (attachedSession && messageListener) {
      attachedSession.removeEventListener("midimessage", messageListener)
    }
    messageListener = (event: Event) => {
      const detail = (event as CustomEvent<Uint8Array>).detail
      if (detail) sharedFollower?.handleMessage(detail)
    }
    session.addEventListener("midimessage", messageListener)
    attachedSession = session
  }
  return sharedFollower
}
