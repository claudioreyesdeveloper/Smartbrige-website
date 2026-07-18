import type { MidiSendTarget } from "@/lib/yamaha/types"

/** Opaque MIDI routing target from a server-precomputed plan. */
export type DispatchTarget = MidiSendTarget

/**
 * One precomputed MIDI outbound event.
 * Same-time order is the array order supplied by the server — never reordered.
 */
export type DispatchEvent = {
  atMs: number
  target: DispatchTarget
  bytes: number[]
}

/** A playable slice (full song or one section) with opaque byte schedules. */
export type DispatchPlanSlice = {
  durationMs: number
  events: DispatchEvent[]
  /**
   * When true, pause/resume are allowed.
   * Absent or false means pause is rejected (not safely defined).
   */
  pauseSafe?: boolean
}

export type DisplayTimelineChord = {
  atMs: number
  name: string
}

export type DisplayTimelineSection = {
  id: string
  label: string
  startMs: number
  endMs: number
  chords?: DisplayTimelineChord[]
}

/** UI-only timeline metadata. Never used for MIDI decisions. */
export type DisplayTimeline = {
  sections: DisplayTimelineSection[]
  tempoBpm?: number
  key?: string
  timeSignature?: readonly [number, number]
}

/**
 * Opaque server-precomputed performance plan.
 * Contains no arranger/anticipation/reharmonization logic — only bytes + display.
 */
export type PreparedPerformancePlan = {
  planId: string
  engineVersion: string
  expiresAt: string
  display: DisplayTimeline
  full: DispatchPlanSlice
  sections: Record<string, DispatchPlanSlice>
}

export type ValidatedDispatchEvent = {
  atMs: number
  target: DispatchTarget
  bytes: Uint8Array
}

export type ValidatedPlanSlice = {
  durationMs: number
  events: ValidatedDispatchEvent[]
  pauseSafe: boolean
}

export type ValidatedPerformancePlan = {
  planId: string
  engineVersion: string
  expiresAtMs: number
  expiresAt: string
  display: DisplayTimeline
  full: ValidatedPlanSlice
  sections: Record<string, ValidatedPlanSlice>
}

export type DispatchSelection =
  | { mode: "full" }
  | { mode: "section"; sectionId: string }

export type DispatchStatus =
  | "idle"
  | "ready"
  | "playing"
  | "paused"
  | "stopped"
  | "completed"
  | "error"

export type DispatchPlaybackState = {
  status: DispatchStatus
  generation: number
  planId: string | null
  engineVersion: string | null
  selection: DispatchSelection | null
  positionMs: number
  durationMs: number
  scheduledCount: number
  sentCount: number
  expiresAt: string | null
  pauseSafe: boolean
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

/** Wall clock for plan expiry checks (separate from scheduling clock). */
export type DispatchWallClock = {
  now(): number
}

/**
 * Minimal production YamahaMidiSession surface used by the dispatcher.
 * Does not depend on audition player types.
 */
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
  /** Defaults to Date.now — used only for expiry rejection. */
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

/** Hard limits for opaque plan acceptance (fail closed). */
export const PLAN_LIMITS = {
  maxSections: 64,
  maxEventsPerSlice: 20_000,
  maxTotalEvents: 100_000,
  maxDurationMs: 30 * 60 * 1000,
  maxBytesPerEvent: 256,
  maxSysExBytes: 128,
  maxPlanIdLength: 128,
  maxEngineVersionLength: 64,
  maxDisplaySections: 128,
  maxDisplayChordsPerSection: 512,
  maxChordNameLength: 64,
  maxSectionIdLength: 64,
  maxSectionLabelLength: 128,
} as const
