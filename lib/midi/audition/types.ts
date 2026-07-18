import type { MidiSendTarget } from "@/lib/yamaha/types"

export type AuditionClock = {
  now(): number
}

export type AuditionTimerHandle = {
  clear(): void
}

export type AuditionTimer = {
  setTimeout(callback: () => void, delayMs: number): AuditionTimerHandle
}

/** Minimal MIDI output surface used by the audition player (matches YamahaMidiSession). */
export type AuditionMidiSession = {
  send(data: Uint8Array, timestamp?: number, target?: MidiSendTarget): void
  sendPort1(data: Uint8Array, timestamp?: number): void
  sendPort2(data: Uint8Array, timestamp?: number): void
  sendBoth(data: Uint8Array, timestamp?: number): void
  panic(): void
}

export type AuditionPort = MidiSendTarget

export type AuditionStatus = "idle" | "playing" | "stopped" | "completed"

export type AuditionPlaybackState = {
  status: AuditionStatus
  generation: number
  positionTick: number
  endTick: number
  scheduledCount: number
  sentCount: number
}

export type AuditionStartOptions = {
  /** Initial tempo when the document has no tempo meta at tick 0. Default 120. */
  bpm?: number
  /** Explicit Yamaha output routing. Default "port2" (style-part path). */
  port?: AuditionPort
  /** When set, only these track indices are auditioned. */
  tracks?: number[]
  /** When set, only these MIDI channels (0–15) are auditioned. */
  channels?: number[]
  /**
   * Convert bank/program on style-part channels 9–16 (0-based 8–15) into
   * verified XG Multi-Part SysEx. Default true.
   */
  stylePartVoiceSetup?: boolean
  /** Bound on how far ahead events may be timestamp-scheduled. Default 100 ms. */
  lookaheadMs?: number
  /** Pump interval for bounded lookahead scheduling. Default 25 ms. */
  scheduleIntervalMs?: number
}

export type AuditionPlayerDeps = {
  session: AuditionMidiSession
  clock?: AuditionClock
  timer?: AuditionTimer
  lookaheadMs?: number
  scheduleIntervalMs?: number
  onStateChange?: (state: AuditionPlaybackState) => void
  onComplete?: () => void
  onError?: (error: unknown) => void
}

export type ScheduledAuditionEvent = {
  tick: number
  sequence: number
  trackIndex: number
  absMs: number
  bytes: Uint8Array
  port: AuditionPort
}

export const DEFAULT_BPM = 120
export const DEFAULT_LOOKAHEAD_MS = 100
export const DEFAULT_SCHEDULE_INTERVAL_MS = 25
export const STYLE_PART_CHANNEL_FIRST = 8
export const STYLE_PART_CHANNEL_LAST = 15
