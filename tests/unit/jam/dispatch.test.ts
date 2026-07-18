import { describe, expect, it } from "vitest"
import {
  DEFAULT_LOOKAHEAD_MS,
  PLAN_LIMITS,
  PlanDispatcher,
  PlanValidationError,
  validatePreparedPlan,
  type DispatchClock,
  type DispatchMidiSession,
  type DispatchPlaybackState,
  type DispatchTimer,
  type DispatchTimerHandle,
  type DispatchWallClock,
  type PreparedPerformancePlan,
} from "@/lib/jam/dispatch"
import type { MidiSendTarget } from "@/lib/yamaha/types"

type SentMessage = {
  data: Uint8Array
  timestamp?: number
  target: MidiSendTarget
}

class FakeClock implements DispatchClock {
  current = 0
  now() {
    return this.current
  }
  advance(ms: number) {
    this.current += ms
  }
}

class FakeWallClock implements DispatchWallClock {
  current = Date.parse("2026-07-18T12:00:00.000Z")
  now() {
    return this.current
  }
  advance(ms: number) {
    this.current += ms
  }
}

class FakeTimer implements DispatchTimer {
  private nextId = 1
  private tasks = new Map<number, { due: number; callback: () => void }>()

  constructor(private readonly clock: FakeClock) {}

  setTimeout(callback: () => void, delayMs: number): DispatchTimerHandle {
    const id = this.nextId++
    this.tasks.set(id, { due: this.clock.now() + Math.max(0, delayMs), callback })
    return {
      clear: () => {
        this.tasks.delete(id)
      },
    }
  }

  flush(until?: number) {
    const limit = until ?? this.clock.now()
    for (;;) {
      let next: { id: number; due: number; callback: () => void } | null = null
      for (const [id, task] of this.tasks) {
        if (task.due > limit) continue
        if (!next || task.due < next.due || (task.due === next.due && id < next.id)) {
          next = { id, due: task.due, callback: task.callback }
        }
      }
      if (!next) return
      this.tasks.delete(next.id)
      next.callback()
    }
  }
}

class FakeSession extends EventTarget implements DispatchMidiSession {
  sent: SentMessage[] = []
  panicCount = 0
  connected = true

  get state() {
    return { connected: this.connected }
  }

  send(data: Uint8Array, timestamp?: number, target: MidiSendTarget = "both") {
    this.sent.push({ data: Uint8Array.from(data), timestamp, target })
  }

  panic() {
    this.panicCount += 1
  }

  disconnect() {
    this.connected = false
    this.dispatchEvent(new Event("statechange"))
  }
}

function hex(data: Uint8Array): string {
  return [...data].map((byte) => byte.toString(16).padStart(2, "0")).join(" ")
}

function basePlan(overrides?: Partial<PreparedPerformancePlan>): PreparedPerformancePlan {
  return {
    planId: "plan_opaque_001",
    engineVersion: "jam-v1-test",
    expiresAt: "2026-07-18T18:00:00.000Z",
    display: {
      tempoBpm: 100,
      key: "C",
      timeSignature: [4, 4],
      sections: [
        {
          id: "verse",
          label: "Verse",
          startMs: 0,
          endMs: 2000,
          chords: [{ atMs: 0, name: "C" }],
        },
        {
          id: "chorus",
          label: "Chorus",
          startMs: 2000,
          endMs: 4000,
          chords: [{ atMs: 2000, name: "F" }],
        },
      ],
    },
    full: {
      durationMs: 4000,
      events: [
        { atMs: 0, target: "port1", bytes: [0x90, 60, 100] },
        { atMs: 0, target: "port2", bytes: [0xb0, 7, 100] },
        { atMs: 0, target: "both", bytes: [0xf0, 0x43, 0x10, 0x4c, 0x00, 0x00, 0x7e, 0x00, 0xf7] },
        { atMs: 250, target: "port1", bytes: [0x80, 60, 0] },
        { atMs: 1000, target: "port2", bytes: [0xc0, 4] },
      ],
    },
    sections: {
      verse: {
        durationMs: 2000,
        pauseSafe: true,
        events: [
          { atMs: 0, target: "port1", bytes: [0x91, 64, 90] },
          { atMs: 500, target: "port1", bytes: [0x81, 64, 0] },
        ],
      },
      chorus: {
        durationMs: 2000,
        events: [{ atMs: 0, target: "both", bytes: [0x92, 67, 80] }],
      },
    },
    ...overrides,
  }
}

function createHarness(options?: {
  lookaheadMs?: number
  scheduleIntervalMs?: number
  wallNow?: number
}) {
  const clock = new FakeClock()
  const timer = new FakeTimer(clock)
  const wallClock = new FakeWallClock()
  if (options?.wallNow !== undefined) wallClock.current = options.wallNow
  const session = new FakeSession()
  const states: DispatchPlaybackState[] = []
  let completed = 0
  const dispatcher = new PlanDispatcher({
    session,
    clock,
    timer,
    wallClock,
    lookaheadMs: options?.lookaheadMs ?? DEFAULT_LOOKAHEAD_MS,
    scheduleIntervalMs: options?.scheduleIntervalMs ?? 25,
    onStateChange: (state) => states.push({ ...state }),
    onComplete: () => {
      completed += 1
    },
  })
  const advance = (ms: number) => {
    clock.advance(ms)
    timer.flush()
  }
  return {
    clock,
    timer,
    wallClock,
    session,
    dispatcher,
    states,
    get completed() {
      return completed
    },
    advance,
  }
}

describe("validatePreparedPlan", () => {
  it("accepts a well-formed opaque plan and preserves same-time order", () => {
    const validated = validatePreparedPlan(basePlan())
    expect(validated.planId).toBe("plan_opaque_001")
    expect(validated.full.events.map((event) => hex(event.bytes))).toEqual([
      "90 3c 64",
      "b0 07 64",
      "f0 43 10 4c 00 00 7e 00 f7",
      "80 3c 00",
      "c0 04",
    ])
    expect(validated.full.events[0].target).toBe("port1")
    expect(validated.full.events[1].target).toBe("port2")
    expect(validated.full.events[2].target).toBe("both")
  })

  it("rejects events beyond duration", () => {
    expect(() =>
      validatePreparedPlan(
        basePlan({
          full: {
            durationMs: 100,
            events: [{ atMs: 101, target: "port1", bytes: [0x90, 60, 100] }],
          },
        }),
      ),
    ).toThrow(PlanValidationError)
    try {
      validatePreparedPlan(
        basePlan({
          full: {
            durationMs: 100,
            events: [{ atMs: 101, target: "port1", bytes: [0x90, 60, 100] }],
          },
        }),
      )
    } catch (error) {
      expect(error).toBeInstanceOf(PlanValidationError)
      expect((error as PlanValidationError).code).toBe("event_beyond_duration")
    }
  })

  it("rejects forbidden MIDI status lengths", () => {
    expect(() =>
      validatePreparedPlan(
        basePlan({
          full: {
            durationMs: 100,
            events: [{ atMs: 0, target: "port1", bytes: [0x90, 60] }],
          },
        }),
      ),
    ).toThrow(/invalid length/)

    expect(() =>
      validatePreparedPlan(
        basePlan({
          full: {
            durationMs: 100,
            events: [{ atMs: 0, target: "port1", bytes: [0xc0, 4, 5] }],
          },
        }),
      ),
    ).toThrow(/invalid length/)

    expect(() =>
      validatePreparedPlan(
        basePlan({
          full: {
            durationMs: 100,
            events: [{ atMs: 0, target: "port1", bytes: [0xf8] }],
          },
        }),
      ),
    ).toThrow(/forbidden/)
  })

  it("rejects dangerous unbounded SysEx", () => {
    expect(() =>
      validatePreparedPlan(
        basePlan({
          full: {
            durationMs: 100,
            events: [{ atMs: 0, target: "both", bytes: [0xf0, 0x43, 0x10] }],
          },
        }),
      ),
    ).toThrow(/0xF7/)

    const huge = [0xf0, ...Array.from({ length: PLAN_LIMITS.maxSysExBytes }, () => 0x01), 0xf7]
    expect(() =>
      validatePreparedPlan(
        basePlan({
          full: {
            durationMs: 100,
            events: [{ atMs: 0, target: "both", bytes: huge }],
          },
        }),
      ),
    ).toThrow(/SysEx exceeds/)
  })

  it("rejects oversized plans", () => {
    const events = Array.from({ length: PLAN_LIMITS.maxEventsPerSlice + 1 }, (_, index) => ({
      atMs: 0,
      target: "port1" as const,
      bytes: [0x90, 60, 1],
    }))
    expect(() =>
      validatePreparedPlan(
        basePlan({
          full: { durationMs: 1000, events },
        }),
      ),
    ).toThrow(/too many events/)
  })
})

describe("PlanDispatcher", () => {
  it("exposes plan id, expiry, and display timeline metadata after load", () => {
    const { dispatcher } = createHarness()
    dispatcher.load(basePlan())
    expect(dispatcher.planMeta).toEqual({
      planId: "plan_opaque_001",
      engineVersion: "jam-v1-test",
      expiresAt: "2026-07-18T18:00:00.000Z",
      display: basePlan().display,
    })
    expect(dispatcher.playbackState.status).toBe("ready")
    expect(dispatcher.playbackState.planId).toBe("plan_opaque_001")
    expect(dispatcher.playbackState.expiresAt).toBe("2026-07-18T18:00:00.000Z")
  })

  it("routes events with exact order and timestamps; no network during playback", () => {
    const fetchCalls: unknown[] = []
    const original = globalThis.fetch
    globalThis.fetch = ((...args: unknown[]) => {
      fetchCalls.push(args)
      return Promise.reject(new Error("unexpected fetch"))
    }) as typeof fetch

    try {
      const { dispatcher, session, advance, clock } = createHarness({
        lookaheadMs: 50,
        scheduleIntervalMs: 25,
      })
      dispatcher.load(basePlan())
      expect(fetchCalls).toHaveLength(0)
      dispatcher.start({ mode: "full" })
      advance(0)
      expect(session.sent).toHaveLength(3)
      const t0 = session.sent[0].timestamp
      expect(session.sent.map((message) => ({
        hex: hex(message.data),
        target: message.target,
        timestamp: message.timestamp,
      }))).toEqual([
        { hex: "90 3c 64", target: "port1", timestamp: t0 },
        { hex: "b0 07 64", target: "port2", timestamp: t0 },
        {
          hex: "f0 43 10 4c 00 00 7e 00 f7",
          target: "both",
          timestamp: t0,
        },
      ])
      advance(250)
      expect(session.sent).toHaveLength(4)
      expect(hex(session.sent[3].data)).toBe("80 3c 00")
      expect(session.sent[3].timestamp).toBe(t0! + 250)
      advance(750)
      expect(session.sent).toHaveLength(5)
      expect(hex(session.sent[4].data)).toBe("c0 04")
      expect(session.sent[4].target).toBe("port2")
      expect(session.sent[4].timestamp).toBe(t0! + 1000)
      expect(clock.now()).toBe(1000)
      expect(fetchCalls).toHaveLength(0)
    } finally {
      globalThis.fetch = original
    }
  })

  it("selects section plans independently of the full plan", () => {
    const { dispatcher, session, advance } = createHarness({
      lookaheadMs: 50,
      scheduleIntervalMs: 25,
    })
    dispatcher.load(basePlan())
    dispatcher.start({ mode: "section", sectionId: "verse" })
    advance(0)
    expect(session.sent).toHaveLength(1)
    expect(hex(session.sent[0].data)).toBe("91 40 5a")
    expect(dispatcher.playbackState.selection).toEqual({
      mode: "section",
      sectionId: "verse",
    })
    expect(dispatcher.playbackState.durationMs).toBe(2000)
    advance(500)
    expect(session.sent).toHaveLength(2)
    expect(hex(session.sent[1].data)).toBe("81 40 00")
  })

  it("rejects unknown section selection", () => {
    const { dispatcher } = createHarness()
    dispatcher.load(basePlan())
    expect(() => dispatcher.start({ mode: "section", sectionId: "bridge" })).toThrow(
      /Unknown section/,
    )
  })

  it("rejects expired plans at load and at start", () => {
    const harness = createHarness({
      wallNow: Date.parse("2026-07-18T19:00:00.000Z"),
    })
    expect(() => harness.dispatcher.load(basePlan())).toThrow(/expired/i)

    const live = createHarness({
      wallNow: Date.parse("2026-07-18T12:00:00.000Z"),
    })
    live.dispatcher.load(basePlan())
    live.wallClock.current = Date.parse("2026-07-18T19:00:00.000Z")
    expect(() => live.dispatcher.start({ mode: "full" })).toThrow(/expired/i)
    expect(live.dispatcher.playbackState.status).toBe("error")
  })

  it("stop cancels timers and restart is generation-safe", () => {
    const { dispatcher, session, advance, clock, timer } = createHarness({
      lookaheadMs: 10,
      scheduleIntervalMs: 25,
    })
    dispatcher.load(basePlan())
    dispatcher.start({ mode: "full" })
    advance(0)
    expect(session.sent.length).toBeGreaterThan(0)
    const panicBefore = session.panicCount
    dispatcher.stop()
    expect(session.panicCount).toBeGreaterThan(panicBefore)
    expect(dispatcher.playbackState.status).toBe("stopped")
    const sentAfterStop = session.sent.length
    clock.advance(10_000)
    timer.flush()
    expect(session.sent).toHaveLength(sentAfterStop)

    session.sent = []
    dispatcher.start({ mode: "section", sectionId: "chorus" })
    advance(0)
    expect(session.sent).toHaveLength(1)
    expect(hex(session.sent[0].data)).toBe("92 43 50")
    advance(10_000)
    expect(session.sent.every((message) => hex(message.data) !== "c0 04")).toBe(true)
  })

  it("pause is rejected unless the active slice defines pauseSafe", () => {
    const { dispatcher, advance } = createHarness({ lookaheadMs: 1_000 })
    dispatcher.load(basePlan())
    dispatcher.start({ mode: "full" })
    advance(0)
    expect(() => dispatcher.pause()).toThrow(/not safely defined/)

    dispatcher.start({ mode: "section", sectionId: "verse" })
    advance(0)
    dispatcher.pause()
    expect(dispatcher.playbackState.status).toBe("paused")
    dispatcher.resume()
    expect(dispatcher.playbackState.status).toBe("playing")
  })

  it("handles disconnect during playback", () => {
    const { dispatcher, session, advance } = createHarness({ lookaheadMs: 1_000 })
    dispatcher.load(basePlan())
    dispatcher.start({ mode: "full" })
    advance(0)
    const panicBefore = session.panicCount
    session.disconnect()
    expect(dispatcher.playbackState.status).toBe("error")
    expect(dispatcher.playbackState.error).toMatch(/disconnected/i)
    expect(session.panicCount).toBeGreaterThan(panicBefore)
  })

  it("rejects start when disconnected", () => {
    const { dispatcher, session } = createHarness()
    dispatcher.load(basePlan())
    session.connected = false
    expect(() => dispatcher.start({ mode: "full" })).toThrow(/not connected/)
  })

  it("uses bounded lookahead for later events", () => {
    const { dispatcher, session, advance } = createHarness({
      lookaheadMs: 50,
      scheduleIntervalMs: 25,
    })
    dispatcher.load(
      basePlan({
        full: {
          durationMs: 1000,
          events: [
            { atMs: 0, target: "port1", bytes: [0x90, 60, 100] },
            { atMs: 200, target: "port1", bytes: [0x80, 60, 0] },
          ],
        },
        sections: {},
      }),
    )
    dispatcher.start({ mode: "full" })
    advance(0)
    expect(session.sent).toHaveLength(1)
    advance(25)
    expect(session.sent).toHaveLength(1)
    advance(150)
    expect(session.sent).toHaveLength(2)
    expect(session.sent[1].timestamp).toBeCloseTo(session.sent[0].timestamp! + 200, 5)
  })

  it("reports completion via UI progress callbacks", () => {
    const harness = createHarness({ lookaheadMs: 1_000, scheduleIntervalMs: 25 })
    harness.dispatcher.load(
      basePlan({
        full: {
          durationMs: 100,
          events: [{ atMs: 0, target: "port1", bytes: [0x90, 60, 100] }],
        },
        sections: {},
      }),
    )
    harness.dispatcher.start({ mode: "full" })
    harness.advance(0)
    expect(harness.dispatcher.playbackState.status).toBe("playing")
    harness.advance(100)
    expect(harness.completed).toBe(1)
    expect(harness.dispatcher.playbackState.status).toBe("completed")
    expect(harness.states.some((state) => state.sentCount === 1)).toBe(true)
  })

  it("panic is callable independently", () => {
    const { dispatcher, session } = createHarness()
    dispatcher.panic()
    expect(session.panicCount).toBe(1)
  })
})
