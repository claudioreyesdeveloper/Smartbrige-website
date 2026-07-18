import type { MidiSendTarget } from "@/lib/yamaha/types"

export type DispatchTarget = MidiSendTarget

/** Exact public/private prepare-contract event shape. */
export type DispatchEvent = {
  atMs: number
  target: DispatchTarget
  bytes: string
}

export type TimeSignature = {
  numerator: number
  denominator: 1 | 2 | 4 | 8 | 16
}

export type DisplayChord = {
  symbol: string
  startBar: number
  durationBars: number
}

export type DisplayTimelineSection = {
  id: string
  name: string
  startBar: number
  barCount: number
}

/** Exact public/private prepare-contract display shape. */
export type DisplayTimeline = {
  tempoBpm: number
  key: string
  timeSignature: TimeSignature
  durationMs: number
  sections: DisplayTimelineSection[]
  chords: DisplayChord[]
}

/** Exact final response from private prepare and the A15 proxy. */
export type PreparedPerformancePlan = {
  planId: string
  expiresAt: string
  display: DisplayTimeline
  dispatch: {
    fullSong: DispatchEvent[]
    sections: Record<string, DispatchEvent[]>
  }
}

export type ValidatedDispatchEvent = {
  atMs: number
  target: DispatchTarget
  bytes: Uint8Array
}

export type ValidatedPlanSlice = {
  durationMs: number
  events: ValidatedDispatchEvent[]
}

export type ValidatedPerformancePlan = {
  planId: string
  expiresAtMs: number
  expiresAt: string
  display: DisplayTimeline
  dispatch: {
    fullSong: ValidatedPlanSlice
    sections: Record<string, ValidatedPlanSlice>
  }
}

export type DispatchSelection =
  | { mode: "full" }
  | { mode: "section"; sectionId: string }

export type DispatchStatus =
  | "idle"
  | "ready"
  | "playing"
  | "stopped"
  | "completed"
  | "error"

export type DispatchPlaybackState = {
  status: DispatchStatus
  generation: number
  planId: string | null
  selection: DispatchSelection | null
  positionMs: number
  durationMs: number
  scheduledCount: number
  sentCount: number
  expiresAt: string | null
  error: string | null
}

export type DispatchClock = {
  now(): number
}

export type DispatchTimerHandle = {
  clear(): void
}

export type DispatchTimer = {
  setTimeout(callback: () => void, delayMs: number): DispatchTimerHandle
}

export type DispatchWallClock = {
  now(): number
}

/** Minimal surface implemented by the production YamahaMidiSession. */
export type DispatchMidiSession = {
  readonly state: { connected: boolean }
  send(data: Uint8Array, timestamp?: number, target?: MidiSendTarget): void
  panic(): void
  addEventListener?(
    type: "statechange",
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ): void
  removeEventListener?(
    type: "statechange",
    listener: EventListenerOrEventListenerObject,
    options?: boolean | EventListenerOptions,
  ): void
}

export type PlanDispatcherDeps = {
  session: DispatchMidiSession
  clock?: DispatchClock
  timer?: DispatchTimer
  wallClock?: DispatchWallClock
  lookaheadMs?: number
  scheduleIntervalMs?: number
  onStateChange?: (state: DispatchPlaybackState) => void
  onComplete?: () => void
}

export type PlanDispatcherStartOptions = {
  lookaheadMs?: number
  scheduleIntervalMs?: number
}

export const DEFAULT_LOOKAHEAD_MS = 100
export const DEFAULT_SCHEDULE_INTERVAL_MS = 25

/** Mirrors final contract limits where they affect browser acceptance. */
export const PLAN_LIMITS = {
  maxSections: 64,
  maxFullSongEvents: 20_000,
  maxEventsPerSection: 5_000,
  maxDurationMs: 86_400_000,
  maxBytesFieldChars: 16_384,
  maxDecodedBytes: 12_288,
  maxSysExBytes: 12_288,
  maxPlanIdLength: 128,
  maxDisplayChords: 512,
  maxChordNameLength: 32,
  maxSectionIdLength: 64,
  maxSectionNameLength: 64,
} as const
