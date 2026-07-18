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
  type ValidatedPerformancePlan,
  type ValidatedPlanSlice,
} from "./types"
import { PlanValidationError, validatePreparedPlan } from "./validate"

const browserClock: DispatchClock = {
  now: () => (typeof performance !== "undefined" ? performance.now() : Date.now()),
}

const browserWallClock: DispatchWallClock = { now: () => Date.now() }

const browserTimer: DispatchTimer = {
  setTimeout(callback, delayMs) {
    const id = setTimeout(callback, Math.max(0, delayMs))
    return { clear: () => clearTimeout(id) }
  },
}

function idleState(generation = 0): DispatchPlaybackState {
  return {
    status: "idle",
    generation,
    planId: null,
    selection: null,
    positionMs: 0,
    durationMs: 0,
    scheduledCount: 0,
    sentCount: 0,
    expiresAt: null,
    error: null,
  }
}

/**
 * Generic browser dispatcher for already-computed opaque plans.
 * It validates/decodes once at load and performs session-only I/O during play.
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
  private events: ValidatedPlanSlice["events"] = []
  private cursor = 0
  private anchorMs = 0
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
    this.defaultScheduleIntervalMs =
      deps.scheduleIntervalMs ?? DEFAULT_SCHEDULE_INTERVAL_MS
    this.onStateChange = deps.onStateChange
    this.onComplete = deps.onComplete
  }

  get playbackState(): DispatchPlaybackState {
    return this.state
  }

  get planMeta(): {
    planId: string
    expiresAt: string
    display: DisplayTimeline
  } | null {
    if (!this.plan) return null
    return {
      planId: this.plan.planId,
      expiresAt: this.plan.expiresAt,
      display: this.plan.display,
    }
  }

  load(input: unknown): ValidatedPerformancePlan {
    this.cancel(this.state.status === "playing", true)
    const plan = validatePreparedPlan(input)
    if (this.wallClock.now() >= plan.expiresAtMs) {
      throw new PlanValidationError("expired_plan", "Plan has expired.")
    }
    this.plan = plan
    this.publish({
      status: "ready",
      generation: this.generation,
      planId: plan.planId,
      selection: null,
      positionMs: 0,
      durationMs: plan.display.durationMs,
      scheduledCount: 0,
      sentCount: 0,
      expiresAt: plan.expiresAt,
      error: null,
    })
    return plan
  }

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
    this.cancel(true, false)
    this.generation += 1
    const generation = this.generation
    this.events = slice.events
    this.cursor = 0
    this.endMs = slice.durationMs
    this.lookaheadMs = options.lookaheadMs ?? this.defaultLookaheadMs
    this.scheduleIntervalMs =
      options.scheduleIntervalMs ?? this.defaultScheduleIntervalMs
    this.anchorMs = this.clock.now()
    this.attachDisconnectListener()
    this.publish({
      status: "playing",
      generation,
      planId: this.plan.planId,
      selection,
      positionMs: 0,
      durationMs: slice.durationMs,
      scheduledCount: slice.events.length,
      sentCount: 0,
      expiresAt: this.plan.expiresAt,
      error: null,
    })

    if (this.events.length === 0) {
      this.finish(generation)
      return
    }
    this.pump(generation)
  }

  stop(): void {
    this.cancel(true, false)
    this.publish({
      ...this.state,
      status: "stopped",
      generation: this.generation,
      selection: null,
      positionMs: 0,
      error: null,
    })
  }

  panic(): void {
    this.session.panic()
  }

  /** Final prepare contract has no safe-pause marker, so pause is fail-closed. */
  pause(): never {
    throw new PlanValidationError(
      "pause_not_safe",
      "Pause is not safely defined by this plan contract.",
    )
  }

  resume(): never {
    throw new PlanValidationError("not_paused", "No safely paused plan exists.")
  }

  private resolveSlice(selection: DispatchSelection): ValidatedPlanSlice {
    if (!this.plan) throw new PlanValidationError("no_plan", "No plan loaded.")
    if (selection.mode === "full") return this.plan.dispatch.fullSong
    const slice = this.plan.dispatch.sections[selection.sectionId]
    if (!slice) {
      throw new PlanValidationError(
        "unknown_section",
        `Unknown section plan: ${selection.sectionId}`,
      )
    }
    return slice
  }

  private cancel(panic: boolean, clearPlan: boolean): void {
    this.generation += 1
    this.clearTimers()
    this.detachDisconnectListener()
    this.events = []
    this.cursor = 0
    if (panic) this.session.panic()
    if (clearPlan) this.plan = null
  }

  private clearTimers(): void {
    this.pumpHandle?.clear()
    this.pumpHandle = null
    this.completeHandle?.clear()
    this.completeHandle = null
  }

  private attachDisconnectListener(): void {
    this.detachDisconnectListener()
    if (!this.session.addEventListener || !this.session.removeEventListener) return
    const listener = () => {
      if (!this.session.state.connected && this.state.status === "playing") {
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
    this.cancel(true, false)
    this.publish({
      ...this.state,
      status: "error",
      generation: this.generation,
      selection: null,
      error: "Keyboard disconnected.",
    })
  }

  private pump(generation: number): void {
    if (generation !== this.generation) return
    if (!this.session.state.connected) {
      this.handleDisconnect()
      return
    }
    const now = this.clock.now()
    const horizon = now + this.lookaheadMs
    while (this.cursor < this.events.length) {
      if (generation !== this.generation) return
      const event = this.events[this.cursor]
      const timestamp = this.anchorMs + event.atMs
      if (timestamp > horizon) break
      this.session.send(event.bytes, timestamp, event.target)
      this.cursor += 1
    }
    if (generation !== this.generation) return
    // Drive UI from wall-clock tempo, not MIDI event sparsity.
    const elapsed = Math.min(this.endMs, Math.max(0, now - this.anchorMs))
    this.publish({
      ...this.state,
      positionMs: elapsed,
      sentCount: this.cursor,
    })
    if (this.cursor >= this.events.length) {
      const remaining = Math.max(0, this.anchorMs + this.endMs - now)
      this.completeHandle = this.timer.setTimeout(() => this.finish(generation), remaining)
      return
    }
    this.pumpHandle = this.timer.setTimeout(
      () => this.pump(generation),
      this.scheduleIntervalMs,
    )
  }

  private finish(generation: number): void {
    if (generation !== this.generation) return
    this.clearTimers()
    this.detachDisconnectListener()
    this.session.panic()
    this.publish({
      ...this.state,
      status: "completed",
      positionMs: this.endMs,
      durationMs: this.endMs,
      sentCount: this.cursor,
      error: null,
    })
    this.onComplete?.()
  }

  private publishError(code: string, message: string): void {
    this.publish({ ...this.state, status: "error", error: `${code}: ${message}` })
  }

  private publish(next: DispatchPlaybackState): void {
    this.state = next
    this.onStateChange?.(next)
  }
}

export function createPlanDispatcher(deps: PlanDispatcherDeps): PlanDispatcher {
  return new PlanDispatcher(deps)
}
