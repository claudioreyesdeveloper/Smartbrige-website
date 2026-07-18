import type { CanonicalMidiDocument } from "@/lib/midi/contract"
import type { MidiSendTarget } from "@/lib/yamaha/types"
import { prepareAuditionSchedule } from "./schedule"
import type {
  AuditionClock,
  AuditionMidiSession,
  AuditionPlaybackState,
  AuditionPlayerDeps,
  AuditionStartOptions,
  AuditionTimer,
  AuditionTimerHandle,
  ScheduledAuditionEvent,
} from "./types"
import {
  DEFAULT_LOOKAHEAD_MS,
  DEFAULT_SCHEDULE_INTERVAL_MS,
} from "./types"

const browserClock: AuditionClock = {
  now() {
    return typeof performance !== "undefined" ? performance.now() : Date.now()
  },
}

const browserTimer: AuditionTimer = {
  setTimeout(callback, delayMs) {
    const id = setTimeout(callback, Math.max(0, delayMs))
    return {
      clear() {
        clearTimeout(id)
      },
    }
  },
}

function idleState(generation = 0): AuditionPlaybackState {
  return {
    status: "idle",
    generation,
    positionTick: 0,
    endTick: 0,
    scheduledCount: 0,
    sentCount: 0,
  }
}

/**
 * Reusable browser audition player.
 *
 * Schedules MIDI with deterministic Web MIDI timestamps, bounded lookahead,
 * cancellation-safe restart, and no server I/O. Depends only on the canonical
 * MIDI contract and an injectable Yamaha session surface.
 */
export class AuditionPlayer {
  private readonly session: AuditionMidiSession
  private readonly clock: AuditionClock
  private readonly timer: AuditionTimer
  private readonly defaultLookaheadMs: number
  private readonly defaultScheduleIntervalMs: number
  private readonly onStateChange?: (state: AuditionPlaybackState) => void
  private readonly onComplete?: () => void

  private state: AuditionPlaybackState = idleState()
  private generation = 0
  private anchorMs = 0
  private events: ScheduledAuditionEvent[] = []
  private cursor = 0
  private endMs = 0
  private endTick = 0
  private lookaheadMs = DEFAULT_LOOKAHEAD_MS
  private scheduleIntervalMs = DEFAULT_SCHEDULE_INTERVAL_MS
  private pumpHandle: AuditionTimerHandle | null = null
  private completeHandle: AuditionTimerHandle | null = null

  constructor(deps: AuditionPlayerDeps) {
    this.session = deps.session
    this.clock = deps.clock ?? browserClock
    this.timer = deps.timer ?? browserTimer
    this.defaultLookaheadMs = deps.lookaheadMs ?? DEFAULT_LOOKAHEAD_MS
    this.defaultScheduleIntervalMs = deps.scheduleIntervalMs ?? DEFAULT_SCHEDULE_INTERVAL_MS
    this.onStateChange = deps.onStateChange
    this.onComplete = deps.onComplete
  }

  get playbackState(): AuditionPlaybackState {
    return this.state
  }

  /** Start audition. Cancels any in-flight generation first (panic + clear). */
  start(document: CanonicalMidiDocument, options: AuditionStartOptions = {}): void {
    this.stopInternal({ panic: true, status: "stopped", notifyComplete: false })

    const prepared = prepareAuditionSchedule(document, options)
    this.generation += 1
    const generation = this.generation
    this.events = prepared.events
    this.cursor = 0
    this.endMs = prepared.endMs
    this.endTick = prepared.endTick
    this.lookaheadMs = options.lookaheadMs ?? this.defaultLookaheadMs
    this.scheduleIntervalMs = options.scheduleIntervalMs ?? this.defaultScheduleIntervalMs
    this.anchorMs = this.clock.now()

    this.publish({
      status: "playing",
      generation,
      positionTick: 0,
      endTick: this.endTick,
      scheduledCount: this.events.length,
      sentCount: 0,
    })

    if (this.events.length === 0) {
      this.finish(generation)
      return
    }

    this.pump(generation)
  }

  /** Stop playback, clear timers, and panic (All Notes Off on both ports). */
  stop(): void {
    this.stopInternal({ panic: true, status: "stopped", notifyComplete: false })
  }

  /** All Notes Off via the session (both ports / all channels). */
  panic(): void {
    this.session.panic()
  }

  private stopInternal(options: {
    panic: boolean
    status: "stopped" | "completed" | "idle"
    notifyComplete: boolean
  }): void {
    this.generation += 1
    this.clearTimers()
    this.events = []
    this.cursor = 0
    if (options.panic) this.session.panic()
    this.publish({
      status: options.status,
      generation: this.generation,
      positionTick: this.state.positionTick,
      endTick: this.endTick,
      scheduledCount: this.state.scheduledCount,
      sentCount: this.state.sentCount,
    })
    if (options.notifyComplete) this.onComplete?.()
  }

  private clearTimers(): void {
    this.pumpHandle?.clear()
    this.pumpHandle = null
    this.completeHandle?.clear()
    this.completeHandle = null
  }

  private pump(generation: number): void {
    if (generation !== this.generation) return

    const now = this.clock.now()
    const origin = this.anchorMs
    const horizon = now + this.lookaheadMs

    while (this.cursor < this.events.length) {
      const event = this.events[this.cursor]
      const absTime = origin + event.absMs
      if (absTime > horizon) break
      this.sendEvent(event, absTime)
      this.cursor += 1
      this.publish({
        ...this.state,
        positionTick: event.tick,
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

  private sendEvent(event: ScheduledAuditionEvent, timestamp: number): void {
    const target: MidiSendTarget = event.port
    this.session.send(event.bytes, timestamp, target)
  }

  private finish(generation: number): void {
    if (generation !== this.generation) return
    this.clearTimers()
    this.session.panic()
    this.publish({
      status: "completed",
      generation: this.generation,
      positionTick: this.endTick,
      endTick: this.endTick,
      scheduledCount: this.events.length,
      sentCount: this.cursor,
    })
    this.onComplete?.()
  }

  private publish(next: AuditionPlaybackState): void {
    this.state = next
    this.onStateChange?.(next)
  }
}

/** Convenience factory using the shared production Yamaha session surface. */
export function createAuditionPlayer(deps: AuditionPlayerDeps): AuditionPlayer {
  return new AuditionPlayer(deps)
}
