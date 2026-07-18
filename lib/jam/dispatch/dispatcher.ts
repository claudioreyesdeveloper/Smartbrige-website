import type { MidiSendTarget } from "@/lib/yamaha/types"
import {
  DEFAULT_LOOKAHEAD_MS,
  DEFAULT_SCHEDULE_INTERVAL_MS,
  type DispatchClock,
  type DispatchMidiSession,
  type DispatchPlaybackState,
  type DispatchSelection,
  type DispatchTimer,
  type DispatchTimerHandle,
  type DispatchWallClock,
  type DisplayTimeline,
  type PlanDispatcherDeps,
  type PlanDispatcherStartOptions,
  type ValidatedDispatchEvent,
  type ValidatedPerformancePlan,
  type ValidatedPlanSlice,
} from "./types"
import { PlanValidationError, validatePreparedPlan } from "./validate"

const browserClock: DispatchClock = {
  now() {
    return typeof performance !== "undefined" ? performance.now() : Date.now()
  },
}

const browserWallClock: DispatchWallClock = {
  now() {
    return Date.now()
  },
}

const browserTimer: DispatchTimer = {
  setTimeout(callback, delayMs) {
    const id = setTimeout(callback, Math.max(0, delayMs))
    return {
      clear() {
        clearTimeout(id)
      },
    }
  },
}

function idleState(generation = 0): DispatchPlaybackState {
  return {
    status: "idle",
    generation,
    planId: null,
    engineVersion: null,
    selection: null,
    positionMs: 0,
    durationMs: 0,
    scheduledCount: 0,
    sentCount: 0,
    expiresAt: null,
    pauseSafe: false,
    error: null,
  }
}

/**
 * Generic browser dispatcher for opaque server-precomputed plans.
 *
 * Schedules validated MIDI bytes through YamahaMidiSession with bounded
 * lookahead. Contains no arranger, anticipation, reharmonization, or
 * transition logic. After a plan is loaded, playback performs no network I/O.
 */
export class PlanDispatcher {
  private readonly session: DispatchMidiSession
  private readonly clock: DispatchClock
  private readonly timer: DispatchTimer
  private readonly wallClock: DispatchWallClock
  private readonly defaultLookaheadMs: number
  private readonly defaultScheduleIntervalMs: number
  private readonly onStateChange?: (state: DispatchPlaybackState) => void
  private readonly onComplete?: () => void

  private state: DispatchPlaybackState = idleState()
  private generation = 0
  private plan: ValidatedPerformancePlan | null = null
  private activeSlice: ValidatedPlanSlice | null = null
  private events: ValidatedDispatchEvent[] = []
  private cursor = 0
  private anchorMs = 0
  private pauseOriginMs = 0
  private endMs = 0
  private lookaheadMs = DEFAULT_LOOKAHEAD_MS
  private scheduleIntervalMs = DEFAULT_SCHEDULE_INTERVAL_MS
  private pumpHandle: DispatchTimerHandle | null = null
  private completeHandle: DispatchTimerHandle | null = null
  private disconnectListener: (() => void) | null = null

  constructor(deps: PlanDispatcherDeps) {
    this.session = deps.session
    this.clock = deps.clock ?? browserClock
    this.timer = deps.timer ?? browserTimer
    this.wallClock = deps.wallClock ?? browserWallClock
    this.defaultLookaheadMs = deps.lookaheadMs ?? DEFAULT_LOOKAHEAD_MS
    this.defaultScheduleIntervalMs = deps.scheduleIntervalMs ?? DEFAULT_SCHEDULE_INTERVAL_MS
    this.onStateChange = deps.onStateChange
    this.onComplete = deps.onComplete
  }

  get playbackState(): DispatchPlaybackState {
    return this.state
  }

  /** Display timeline + identity metadata for the loaded plan (UI only). */
  get planMeta(): {
    planId: string
    engineVersion: string
    expiresAt: string
    display: DisplayTimeline
  } | null {
    if (!this.plan) return null
    return {
      planId: this.plan.planId,
      engineVersion: this.plan.engineVersion,
      expiresAt: this.plan.expiresAt,
      display: this.plan.display,
    }
  }

  /**
   * Validate and retain an opaque plan. Does not start playback and never
   * performs network I/O. Rejects expired plans at load time.
   */
  load(input: unknown): ValidatedPerformancePlan {
    this.stopInternal({
      panic: this.state.status === "playing" || this.state.status === "paused",
      status: "idle",
      notifyComplete: false,
      clearPlan: true,
    })

    const plan = validatePreparedPlan(input)
    if (this.wallClock.now() >= plan.expiresAtMs) {
      throw new PlanValidationError("expired_plan", "Plan has expired.")
    }

    this.plan = plan
    this.publish({
      status: "ready",
      generation: this.generation,
      planId: plan.planId,
      engineVersion: plan.engineVersion,
      selection: null,
      positionMs: 0,
      durationMs: plan.full.durationMs,
      scheduledCount: 0,
      sentCount: 0,
      expiresAt: plan.expiresAt,
      pauseSafe: false,
      error: null,
    })
    return plan
  }

  /**
   * Start playback of the full plan or a named section slice.
   * Cancels any in-flight generation first. Rejects expired/disconnected plans.
   */
  start(selection: DispatchSelection, options: PlanDispatcherStartOptions = {}): void {
    if (!this.plan) {
      throw new PlanValidationError("no_plan", "Load a plan before starting playback.")
    }
    if (this.wallClock.now() >= this.plan.expiresAtMs) {
      this.publishError("expired_plan", "Plan has expired.")
      throw new PlanValidationError("expired_plan", "Plan has expired.")
    }
    if (!this.session.state.connected) {
      this.publishError("disconnected", "Keyboard is not connected.")
      throw new PlanValidationError("disconnected", "Keyboard is not connected.")
    }

    const slice = this.resolveSlice(selection)
    this.stopInternal({
      panic: true,
      status: "ready",
      notifyComplete: false,
      clearPlan: false,
    })

    this.generation += 1
    const generation = this.generation
    this.activeSlice = slice
    this.events = slice.events
    this.cursor = 0
    this.endMs = slice.durationMs
    this.pauseOriginMs = 0
    this.lookaheadMs = options.lookaheadMs ?? this.defaultLookaheadMs
    this.scheduleIntervalMs = options.scheduleIntervalMs ?? this.defaultScheduleIntervalMs
    this.anchorMs = this.clock.now()
    this.attachDisconnectListener()

    this.publish({
      status: "playing",
      generation,
      planId: this.plan.planId,
      engineVersion: this.plan.engineVersion,
      selection,
      positionMs: 0,
      durationMs: slice.durationMs,
      scheduledCount: slice.events.length,
      sentCount: 0,
      expiresAt: this.plan.expiresAt,
      pauseSafe: slice.pauseSafe,
      error: null,
    })

    if (this.events.length === 0) {
      this.finish(generation)
      return
    }

    this.pump(generation)
  }

  /** Stop playback, clear timers, and panic. Keeps the loaded plan. */
  stop(): void {
    this.stopInternal({
      panic: true,
      status: this.plan ? "ready" : "stopped",
      notifyComplete: false,
      clearPlan: false,
      forceStopped: true,
    })
  }

  /** All Notes Off via the session. */
  panic(): void {
    this.session.panic()
  }

  /**
   * Pause only when the active slice declares pauseSafe: true.
   * Freezes playback position; panics sounding notes for safety.
   */
  pause(): void {
    if (this.state.status !== "playing" || !this.activeSlice) {
      throw new PlanValidationError("not_playing", "Nothing is playing.")
    }
    if (!this.activeSlice.pauseSafe) {
      throw new PlanValidationError(
        "pause_not_safe",
        "Pause is not safely defined by this plan.",
      )
    }

    this.pauseOriginMs = Math.min(
      this.endMs,
      Math.max(0, this.clock.now() - this.anchorMs),
    )
    this.generation += 1
    this.clearTimers()
    this.session.panic()
    this.publish({
      ...this.state,
      status: "paused",
      generation: this.generation,
      positionMs: this.pauseOriginMs,
    })
  }

  /** Resume after a safe pause. */
  resume(): void {
    if (this.state.status !== "paused" || !this.activeSlice || !this.plan) {
      throw new PlanValidationError("not_paused", "Nothing is paused.")
    }
    if (!this.session.state.connected) {
      this.publishError("disconnected", "Keyboard is not connected.")
      throw new PlanValidationError("disconnected", "Keyboard is not connected.")
    }
    if (this.wallClock.now() >= this.plan.expiresAtMs) {
      this.publishError("expired_plan", "Plan has expired.")
      throw new PlanValidationError("expired_plan", "Plan has expired.")
    }

    this.generation += 1
    const generation = this.generation
    this.anchorMs = this.clock.now() - this.pauseOriginMs
    this.publish({
      ...this.state,
      status: "playing",
      generation,
      positionMs: this.pauseOriginMs,
      error: null,
    })
    this.pump(generation)
  }

  private resolveSlice(selection: DispatchSelection): ValidatedPlanSlice {
    if (!this.plan) {
      throw new PlanValidationError("no_plan", "Load a plan before starting playback.")
    }
    if (selection.mode === "full") return this.plan.full
    const slice = this.plan.sections[selection.sectionId]
    if (!slice) {
      throw new PlanValidationError(
        "unknown_section",
        `Unknown section plan: ${selection.sectionId}`,
      )
    }
    return slice
  }

  private stopInternal(options: {
    panic: boolean
    status: DispatchPlaybackState["status"]
    notifyComplete: boolean
    clearPlan: boolean
    forceStopped?: boolean
  }): void {
    this.generation += 1
    this.clearTimers()
    this.detachDisconnectListener()
    this.events = []
    this.cursor = 0
    this.activeSlice = null
    if (options.panic) this.session.panic()
    if (options.clearPlan) this.plan = null

    const status = options.forceStopped
      ? "stopped"
      : options.clearPlan
        ? "idle"
        : options.status

    this.publish({
      status,
      generation: this.generation,
      planId: this.plan?.planId ?? null,
      engineVersion: this.plan?.engineVersion ?? null,
      selection: null,
      positionMs: this.state.positionMs,
      durationMs: this.plan?.full.durationMs ?? this.state.durationMs,
      scheduledCount: this.state.scheduledCount,
      sentCount: this.state.sentCount,
      expiresAt: this.plan?.expiresAt ?? null,
      pauseSafe: false,
      error: null,
    })
    if (options.notifyComplete) this.onComplete?.()
  }

  private attachDisconnectListener(): void {
    this.detachDisconnectListener()
    if (!this.session.addEventListener || !this.session.removeEventListener) return
    const listener = () => {
      if (!this.session.state.connected &&
        (this.state.status === "playing" || this.state.status === "paused")) {
        this.handleDisconnect()
      }
    }
    this.disconnectListener = listener
    this.session.addEventListener("statechange", listener)
  }

  private detachDisconnectListener(): void {
    if (this.disconnectListener && this.session.removeEventListener) {
      this.session.removeEventListener("statechange", this.disconnectListener)
    }
    this.disconnectListener = null
  }

  private handleDisconnect(): void {
    this.generation += 1
    this.clearTimers()
    this.detachDisconnectListener()
    this.events = []
    this.cursor = 0
    this.activeSlice = null
    this.session.panic()
    this.publish({
      status: "error",
      generation: this.generation,
      planId: this.plan?.planId ?? null,
      engineVersion: this.plan?.engineVersion ?? null,
      selection: null,
      positionMs: this.state.positionMs,
      durationMs: this.state.durationMs,
      scheduledCount: this.state.scheduledCount,
      sentCount: this.state.sentCount,
      expiresAt: this.plan?.expiresAt ?? null,
      pauseSafe: false,
      error: "Keyboard disconnected.",
    })
  }

  private clearTimers(): void {
    this.pumpHandle?.clear()
    this.pumpHandle = null
    this.completeHandle?.clear()
    this.completeHandle = null
  }

  private pump(generation: number): void {
    if (generation !== this.generation) return
    if (!this.session.state.connected) {
      this.handleDisconnect()
      return
    }

    const now = this.clock.now()
    const origin = this.anchorMs
    const horizon = now + this.lookaheadMs

    while (this.cursor < this.events.length) {
      if (generation !== this.generation) return
      const event = this.events[this.cursor]
      const absTime = origin + event.atMs
      if (absTime > horizon) break
      this.sendEvent(event, absTime)
      this.cursor += 1
      this.publish({
        ...this.state,
        positionMs: event.atMs,
        sentCount: this.cursor,
      })
    }

    if (generation !== this.generation) return

    if (this.cursor >= this.events.length) {
      const remaining = Math.max(0, origin + this.endMs - this.clock.now())
      this.completeHandle?.clear()
      this.completeHandle = this.timer.setTimeout(() => {
        this.finish(generation)
      }, remaining)
      return
    }

    this.pumpHandle?.clear()
    this.pumpHandle = this.timer.setTimeout(() => {
      this.pump(generation)
    }, this.scheduleIntervalMs)
  }

  private sendEvent(event: ValidatedDispatchEvent, timestamp: number): void {
    const target: MidiSendTarget = event.target
    this.session.send(event.bytes, timestamp, target)
  }

  private finish(generation: number): void {
    if (generation !== this.generation) return
    this.clearTimers()
    this.detachDisconnectListener()
    this.session.panic()
    this.activeSlice = null
    this.publish({
      status: "completed",
      generation: this.generation,
      planId: this.plan?.planId ?? null,
      engineVersion: this.plan?.engineVersion ?? null,
      selection: this.state.selection,
      positionMs: this.endMs,
      durationMs: this.endMs,
      scheduledCount: this.events.length,
      sentCount: this.cursor,
      expiresAt: this.plan?.expiresAt ?? null,
      pauseSafe: false,
      error: null,
    })
    this.onComplete?.()
  }

  private publishError(code: string, message: string): void {
    this.publish({
      ...this.state,
      status: "error",
      error: `${code}: ${message}`,
    })
  }

  private publish(next: DispatchPlaybackState): void {
    this.state = next
    this.onStateChange?.(next)
  }
}

/** Convenience factory for the production Yamaha session surface. */
export function createPlanDispatcher(deps: PlanDispatcherDeps): PlanDispatcher {
  return new PlanDispatcher(deps)
}
