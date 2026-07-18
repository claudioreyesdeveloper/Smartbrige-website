import { describe, expect, it } from "vitest"
import fixture from "./fixtures/jam-prepare.response.json"
import {
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

type Sent = { data: Uint8Array; timestamp?: number; target: MidiSendTarget }

class FakeClock implements DispatchClock {
  current = 0
  now = () => this.current
  advance(ms: number) {
    this.current += ms
  }
}

class FakeWallClock implements DispatchWallClock {
  current = Date.parse("2026-07-18T12:00:00.000Z")
  now = () => this.current
}

class FakeTimer implements DispatchTimer {
  private id = 0
  private tasks = new Map<number, { due: number; callback: () => void }>()

  constructor(private readonly clock: FakeClock) {}

  setTimeout(callback: () => void, delayMs: number): DispatchTimerHandle {
    const id = ++this.id
    this.tasks.set(id, { due: this.clock.now() + Math.max(0, delayMs), callback })
    return { clear: () => this.tasks.delete(id) }
  }

  flush() {
    for (;;) {
      const due = [...this.tasks.entries()]
        .filter(([, task]) => task.due <= this.clock.now())
        .sort(([aId, a], [bId, b]) => a.due - b.due || aId - bId)[0]
      if (!due) return
      this.tasks.delete(due[0])
      due[1].callback()
    }
  }
}

class FakeSession extends EventTarget implements DispatchMidiSession {
  sent: Sent[] = []
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

function cloneFixture(): PreparedPerformancePlan {
  return structuredClone(fixture) as PreparedPerformancePlan
}

function base64(...bytes: number[]): string {
  return btoa(String.fromCharCode(...bytes))
}

function hex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join(" ")
}

function harness(options: { lookaheadMs?: number } = {}) {
  const clock = new FakeClock()
  const wallClock = new FakeWallClock()
  const timer = new FakeTimer(clock)
  const session = new FakeSession()
  const states: DispatchPlaybackState[] = []
  let completed = 0
  const dispatcher = new PlanDispatcher({
    session,
    clock,
    wallClock,
    timer,
    lookaheadMs: options.lookaheadMs ?? 50,
    scheduleIntervalMs: 25,
    onStateChange: (state) => states.push({ ...state }),
    onComplete: () => completed++,
  })
  const advance = (ms: number) => {
    clock.advance(ms)
    timer.flush()
  }
  return {
    clock,
    wallClock,
    timer,
    session,
    states,
    dispatcher,
    advance,
    completed: () => completed,
  }
}

describe("final prepare contract validation", () => {
  it("consumes the copied final private/A15 fixture exactly", () => {
    const plan = validatePreparedPlan(fixture)
    expect(plan.planId).toBe("pln_fixture_0001")
    expect(plan.display.durationMs).toBe(32_000)
    expect(plan.dispatch.fullSong.events.map((event) => hex(event.bytes))).toEqual([
      "f0 43 10 f7",
      "90 61 00",
    ])
    expect(plan.dispatch.sections["sec-main-b"].events[0].target).toBe("port2")
    expect(plan).not.toHaveProperty("engineVersion")
  })

  it("accepts fractional display chord bars", () => {
    const plan = cloneFixture()
    plan.display.chords[0].startBar = 0.5
    expect(validatePreparedPlan(plan).display.chords[0].startBar).toBe(0.5)
  })

  it("rejects the old invented envelope and unknown fields", () => {
    const plan = cloneFixture() as unknown as Record<string, unknown>
    plan.engineVersion = "invented"
    expect(() => validatePreparedPlan(plan)).toThrow(/Unknown field/)
    expect(() =>
      validatePreparedPlan({
        planId: "old",
        expiresAt: fixture.expiresAt,
        display: fixture.display,
        full: { durationMs: 1, events: [] },
        sections: {},
      }),
    ).toThrow(PlanValidationError)
  })

  it.each(["8EMQ9w", "8EMQ9w===", "8EMQ9w-_", "not base64"])(
    "rejects malformed/noncanonical base64: %s",
    (bytes) => {
      const plan = cloneFixture()
      plan.dispatch.fullSong[0].bytes = bytes
      expect(() => validatePreparedPlan(plan)).toThrow(/canonical standard base64/)
    },
  )

  it("accepts verified one-byte FA, F8, and FC realtime statuses", () => {
    const plan = cloneFixture()
    plan.dispatch.fullSong = [
      { atMs: 0, target: "port1", bytes: base64(0xfa) },
      { atMs: 10, target: "port1", bytes: base64(0xf8) },
      { atMs: 20, target: "port1", bytes: base64(0xfc) },
    ]
    const validated = validatePreparedPlan(plan)
    expect(validated.dispatch.fullSong.events.map((event) => hex(event.bytes))).toEqual([
      "fa",
      "f8",
      "fc",
    ])
  })

  it("rejects malformed realtime, channel, and unsafe SysEx messages", () => {
    for (const bytes of [
      base64(0xfa, 0x00),
      base64(0x90, 60),
      base64(0xf1),
      base64(0xf0, 0x43, 0x10),
    ]) {
      const plan = cloneFixture()
      plan.dispatch.fullSong = [{ atMs: 0, target: "port1", bytes }]
      expect(() => validatePreparedPlan(plan)).toThrow(PlanValidationError)
    }
  })

  it("rejects decoded payloads above 12288 bytes", () => {
    const plan = cloneFixture()
    plan.dispatch.fullSong = [{
      atMs: 0,
      target: "port1",
      bytes: base64(...Array.from({ length: 12_289 }, () => 0x01)),
    }]
    expect(() => validatePreparedPlan(plan)).toThrow(/1-12288 bytes/)
  })

  it("rejects event times beyond display duration and out-of-order arrays", () => {
    const beyond = cloneFixture()
    beyond.dispatch.fullSong[0].atMs = beyond.display.durationMs + 1
    expect(() => validatePreparedPlan(beyond)).toThrow(/exceeds display.durationMs/)

    const unordered = cloneFixture()
    unordered.dispatch.fullSong = [
      { atMs: 10, target: "port1", bytes: base64(0xfa) },
      { atMs: 0, target: "port1", bytes: base64(0xfc) },
    ]
    expect(() => validatePreparedPlan(unordered)).toThrow(/nondecreasing/)
  })
})

describe("PlanDispatcher", () => {
  it("exposes exact plan metadata without invented engine fields", () => {
    const { dispatcher } = harness()
    dispatcher.load(fixture)
    expect(dispatcher.planMeta).toEqual({
      planId: fixture.planId,
      expiresAt: fixture.expiresAt,
      display: fixture.display,
    })
    expect(dispatcher.playbackState).not.toHaveProperty("engineVersion")
    expect(dispatcher.playbackState.status).toBe("ready")
  })

  it("preserves same-time server order, routing, and timestamps", () => {
    const plan = cloneFixture()
    plan.dispatch.fullSong = [
      { atMs: 0, target: "port2", bytes: base64(0xfa) },
      { atMs: 0, target: "port1", bytes: base64(0xf8) },
      { atMs: 0, target: "both", bytes: base64(0xfc) },
      { atMs: 200, target: "port1", bytes: base64(0x90, 60, 100) },
    ]
    const { dispatcher, session, advance } = harness()
    dispatcher.load(plan)
    dispatcher.start({ mode: "full" })
    advance(0)
    expect(session.sent.map((message) => [hex(message.data), message.target])).toEqual([
      ["fa", "port2"],
      ["f8", "port1"],
      ["fc", "both"],
    ])
    expect(new Set(session.sent.map((message) => message.timestamp)).size).toBe(1)
    advance(150)
    expect(session.sent[3].timestamp).toBe(session.sent[0].timestamp! + 200)
  })

  it("selects section arrays from the final contract", () => {
    const { dispatcher, session, advance } = harness()
    dispatcher.load(fixture)
    dispatcher.start({ mode: "section", sectionId: "sec-main-b" })
    advance(0)
    expect(session.sent).toHaveLength(1)
    expect(hex(session.sent[0].data)).toBe("f0 43 11 f7")
    expect(session.sent[0].target).toBe("port2")
    expect(dispatcher.playbackState.selection).toEqual({
      mode: "section",
      sectionId: "sec-main-b",
    })
  })

  it("does not call fetch after load or during playback", () => {
    const calls: unknown[] = []
    const original = globalThis.fetch
    globalThis.fetch = ((...args: unknown[]) => {
      calls.push(args)
      return Promise.reject(new Error("unexpected fetch"))
    }) as typeof fetch
    try {
      const { dispatcher, advance } = harness()
      dispatcher.load(fixture)
      dispatcher.start({ mode: "full" })
      advance(100)
      expect(calls).toEqual([])
    } finally {
      globalThis.fetch = original
    }
  })

  it("keeps bounded lookahead", () => {
    const plan = cloneFixture()
    plan.dispatch.fullSong = [
      { atMs: 0, target: "port1", bytes: base64(0xfa) },
      { atMs: 200, target: "port1", bytes: base64(0xfc) },
    ]
    const { dispatcher, session, advance } = harness({ lookaheadMs: 50 })
    dispatcher.load(plan)
    dispatcher.start({ mode: "full" })
    advance(0)
    expect(session.sent).toHaveLength(1)
    advance(25)
    expect(session.sent).toHaveLength(1)
    advance(125)
    expect(session.sent).toHaveLength(2)
  })

  it("with musical getElapsedMs fires only when due (no wall lookahead)", () => {
    const plan = cloneFixture()
    plan.dispatch.fullSong = [
      { atMs: 0, target: "port1", bytes: base64(0xfa) },
      { atMs: 200, target: "port1", bytes: base64(0xfc) },
    ]
    let musicalMs = 0
    const clock = new FakeClock()
    const wallClock = new FakeWallClock()
    const fakeTimer = new FakeTimer(clock)
    const session = new FakeSession()
    const dispatcher = new PlanDispatcher({
      session,
      clock,
      wallClock,
      timer: fakeTimer,
      lookaheadMs: 100,
      scheduleIntervalMs: 25,
      getElapsedMs: () => musicalMs,
    })
    dispatcher.load(plan)
    dispatcher.start({ mode: "full" })
    fakeTimer.flush()
    expect(session.sent).toHaveLength(1)
    expect(session.sent[0]!.timestamp).toBeUndefined()
    musicalMs = 100
    clock.advance(25)
    fakeTimer.flush()
    expect(session.sent).toHaveLength(1)
    musicalMs = 200
    clock.advance(25)
    fakeTimer.flush()
    expect(session.sent).toHaveLength(2)
    expect(session.sent[1]!.timestamp).toBeUndefined()
  })

  it("cancels stop/restart races and panics", () => {
    const plan = cloneFixture()
    plan.dispatch.fullSong = [
      { atMs: 0, target: "port1", bytes: base64(0xfa) },
      { atMs: 500, target: "port1", bytes: base64(0xfc) },
    ]
    const { dispatcher, session, advance } = harness({ lookaheadMs: 10 })
    dispatcher.load(plan)
    dispatcher.start({ mode: "full" })
    advance(0)
    dispatcher.stop()
    const stoppedCount = session.sent.length
    advance(1000)
    expect(session.sent).toHaveLength(stoppedCount)
    expect(session.panicCount).toBeGreaterThan(0)

    dispatcher.start({ mode: "section", sectionId: "sec-main-a" })
    advance(0)
    expect(hex(session.sent.at(-1)!.data)).toBe("f0 43 10 f7")
    expect(session.sent.some((message) => hex(message.data) === "fc")).toBe(false)
  })

  it("rejects expiry at load and start", () => {
    const expired = harness()
    expired.wallClock.current = Date.parse("2026-07-18T15:00:00.000Z")
    expect(() => expired.dispatcher.load(fixture)).toThrow(/expired/)

    const later = harness()
    later.dispatcher.load(fixture)
    later.wallClock.current = Date.parse("2026-07-18T15:00:00.000Z")
    expect(() => later.dispatcher.start({ mode: "full" })).toThrow(/expired/)
  })

  it("fails closed on pause and handles disconnect", () => {
    const { dispatcher, session, advance } = harness()
    dispatcher.load(fixture)
    dispatcher.start({ mode: "full" })
    advance(0)
    expect(() => dispatcher.pause()).toThrow(/not safely defined/)
    session.disconnect()
    expect(dispatcher.playbackState.status).toBe("error")
    expect(dispatcher.playbackState.error).toMatch(/disconnected/i)
  })

  it("reports progress and completion", () => {
    const plan = cloneFixture()
    plan.display.durationMs = 100
    plan.dispatch.fullSong = [{ atMs: 0, target: "port1", bytes: base64(0xfa) }]
    const { dispatcher, states, completed, advance } = harness()
    dispatcher.load(plan)
    dispatcher.start({ mode: "full" })
    advance(100)
    expect(states.some((state) => state.sentCount === 1)).toBe(true)
    expect(dispatcher.playbackState.status).toBe("completed")
    expect(completed()).toBe(1)
  })
})
