import { describe, expect, it } from "vitest"
import {
  MIDI_CONTRACT_VERSION,
  type CanonicalMidiDocument,
  type CanonicalMidiEvent,
} from "@/lib/midi"
import {
  AuditionPlayer,
  DEFAULT_LOOKAHEAD_MS,
  prepareAuditionSchedule,
  stylePartVoiceSetupSysEx,
  tickToMs,
  buildTempoMap,
  xgMultiPartMessage,
  type AuditionClock,
  type AuditionMidiSession,
  type AuditionPlaybackState,
  type AuditionTimer,
  type AuditionTimerHandle,
} from "@/lib/midi/audition"
import type { MidiSendTarget } from "@/lib/yamaha/types"

type SentMessage = {
  data: Uint8Array
  timestamp?: number
  target: MidiSendTarget
}

class FakeClock implements AuditionClock {
  current = 0
  now() {
    return this.current
  }
  advance(ms: number) {
    this.current += ms
  }
}

class FakeTimer implements AuditionTimer {
  private nextId = 1
  private tasks = new Map<number, { due: number; callback: () => void }>()

  constructor(private readonly clock: FakeClock) {}

  setTimeout(callback: () => void, delayMs: number): AuditionTimerHandle {
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

class FakeSession implements AuditionMidiSession {
  sent: SentMessage[] = []
  panicCount = 0

  send(data: Uint8Array, timestamp?: number, target: MidiSendTarget = "both") {
    this.sent.push({ data: Uint8Array.from(data), timestamp, target })
  }
  sendPort1(data: Uint8Array, timestamp?: number) {
    this.send(data, timestamp, "port1")
  }
  sendPort2(data: Uint8Array, timestamp?: number) {
    this.send(data, timestamp, "port2")
  }
  sendBoth(data: Uint8Array, timestamp?: number) {
    this.send(data, timestamp, "both")
  }
  panic() {
    this.panicCount += 1
  }
}

function channel(
  tick: number,
  sequence: number,
  status: number,
  data: number[],
): CanonicalMidiEvent {
  return { kind: "channel", tick, sequence, status, data }
}

function meta(
  tick: number,
  sequence: number,
  metaType: number,
  data: number[],
): CanonicalMidiEvent {
  return { kind: "meta", tick, sequence, metaType, data: Uint8Array.from(data) }
}

function sysex(
  tick: number,
  sequence: number,
  status: 0xf0 | 0xf7,
  data: number[],
): CanonicalMidiEvent {
  return { kind: "sysex", tick, sequence, status, data: Uint8Array.from(data) }
}

function documentOf(
  ticksPerQuarter: number,
  tracks: CanonicalMidiEvent[][],
  endTicks?: number[],
): CanonicalMidiDocument {
  return {
    version: MIDI_CONTRACT_VERSION,
    format: tracks.length > 1 ? 1 : 0,
    ticksPerQuarter,
    tracks: tracks.map((events, index) => ({
      events,
      endTick: endTicks?.[index] ?? (events.reduce((max, event) => Math.max(max, event.tick), 0)),
    })),
  }
}

function hex(data: Uint8Array): string {
  return [...data].map((byte) => byte.toString(16).padStart(2, "0")).join(" ")
}

function createHarness(options?: { lookaheadMs?: number; scheduleIntervalMs?: number }) {
  const clock = new FakeClock()
  const timer = new FakeTimer(clock)
  const session = new FakeSession()
  const states: AuditionPlaybackState[] = []
  let completed = 0
  const player = new AuditionPlayer({
    session,
    clock,
    timer,
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
  return { clock, timer, session, player, states, get completed() { return completed }, advance }
}

describe("XG Multi-Part voice setup parity", () => {
  it("matches demo/desktop bytes for bank MSB/LSB and program on channels 9–16", () => {
    // Demo style-preview.ts + YamahaProtocol MultiPart offsets 0x01/0x02/0x03
    expect(hex(xgMultiPartMessage(8, 0x01, 0x7f))).toBe("f0 43 10 4c 08 08 01 7f f7")
    expect(hex(xgMultiPartMessage(15, 0x02, 0x00))).toBe("f0 43 10 4c 08 0f 02 00 f7")
    expect(hex(xgMultiPartMessage(10, 0x03, 0x21))).toBe("f0 43 10 4c 08 0a 03 21 f7")

    expect(hex(stylePartVoiceSetupSysEx(0xb8, [0, 12])!)).toBe("f0 43 10 4c 08 08 01 0c f7")
    expect(hex(stylePartVoiceSetupSysEx(0xb9, [32, 5])!)).toBe("f0 43 10 4c 08 09 02 05 f7")
    expect(hex(stylePartVoiceSetupSysEx(0xca, [33])!)).toBe("f0 43 10 4c 08 0a 03 21 f7")
    expect(stylePartVoiceSetupSysEx(0xb0, [0, 12])).toBeNull()
    expect(stylePartVoiceSetupSysEx(0x98, [60, 100])).toBeNull()
  })
})

describe("tempo / tick conversion", () => {
  it("converts ticks with tempo changes", () => {
    const doc = documentOf(480, [[
      meta(0, 0, 0x51, [0x07, 0xa1, 0x20]), // 120 BPM = 500_000 us/qn
      channel(480, 1, 0x90, [60, 100]),
      meta(480, 2, 0x51, [0x03, 0xd0, 0x90]), // 240 BPM = 250_000 us/qn
      channel(960, 3, 0x80, [60, 0]),
    ]])
    const map = buildTempoMap(doc, 120)
    expect(tickToMs(480, 480, map)).toBeCloseTo(500, 5)
    expect(tickToMs(960, 480, map)).toBeCloseTo(750, 5)

    const prepared = prepareAuditionSchedule(doc, { port: "port1", stylePartVoiceSetup: false })
    expect(prepared.events[0].absMs).toBeCloseTo(500, 5)
    expect(prepared.events[1].absMs).toBeCloseTo(750, 5)
  })
})

describe("AuditionPlayer", () => {
  it("preserves same-tick note-off / controller / program / SysEx ordering", () => {
    const { player, session, advance } = createHarness({ lookaheadMs: 1_000 })
    const doc = documentOf(96, [[
      channel(0, 0, 0xb0, [7, 100]),
      channel(0, 1, 0xc0, [4]),
      sysex(0, 2, 0xf0, [0x7e, 0x7f, 0x06, 0x01]),
      channel(0, 3, 0x90, [60, 80]),
      channel(0, 4, 0x80, [60, 0]),
    ]])
    player.start(doc, { port: "port1", stylePartVoiceSetup: false })
    advance(0)
    const payloads = session.sent.map((message) => hex(message.data))
    expect(payloads).toEqual([
      "b0 07 64",
      "c0 04",
      "f0 7e 7f 06 01 f7",
      "90 3c 50",
      "80 3c 00",
    ])
  })

  it("routes Port 2 style-part channels 9–16 with XG bank/program setup", () => {
    const { player, session, advance } = createHarness({ lookaheadMs: 1_000 })
    const doc = documentOf(96, [[
      channel(0, 0, 0xb8, [0, 0x7f]),
      channel(0, 1, 0xb8, [32, 0]),
      channel(0, 2, 0xc8, [0x30]),
      channel(0, 3, 0x98, [36, 100]),
      channel(48, 4, 0x88, [36, 0]),
      channel(0, 5, 0xbf, [0, 1]),
      channel(0, 6, 0xcf, [2]),
      channel(0, 7, 0x9f, [40, 90]),
    ]])
    player.start(doc, { port: "port2" })
    advance(0)
    expect(session.sent.every((message) => message.target === "port2")).toBe(true)
    expect(session.sent.map((message) => hex(message.data))).toEqual([
      "f0 43 10 4c 08 08 01 7f f7",
      "f0 43 10 4c 08 08 02 00 f7",
      "f0 43 10 4c 08 08 03 30 f7",
      "98 24 64",
      "f0 43 10 4c 08 0f 01 01 f7",
      "f0 43 10 4c 08 0f 03 02 f7",
      "9f 28 5a",
      "88 24 00",
    ])
  })

  it("honors explicit Port 1 / Port 2 / both routing", () => {
    const doc = documentOf(96, [[channel(0, 0, 0x90, [60, 100])]])
    for (const port of ["port1", "port2", "both"] as const) {
      const { player, session, advance } = createHarness({ lookaheadMs: 1_000 })
      player.start(doc, { port, stylePartVoiceSetup: false })
      advance(0)
      expect(session.sent).toHaveLength(1)
      expect(session.sent[0].target).toBe(port)
    }
  })

  it("filters by selected track and channel", () => {
    const doc = documentOf(96, [
      [
        channel(0, 0, 0x90, [60, 100]),
        channel(0, 1, 0x91, [62, 100]),
      ],
      [
        channel(0, 0, 0x92, [64, 100]),
        channel(0, 1, 0x90, [65, 100]),
      ],
    ])
    const prepared = prepareAuditionSchedule(doc, {
      tracks: [1],
      channels: [0],
      stylePartVoiceSetup: false,
    })
    expect(prepared.events).toHaveLength(1)
    expect(hex(prepared.events[0].bytes)).toBe("90 41 64")
  })

  it("skips malformed channel and empty SysEx events", () => {
    const doc = documentOf(96, [[
      channel(0, 0, 0x90, [60]), // missing velocity
      channel(0, 1, 0xc0, []), // missing program
      sysex(0, 2, 0xf0, []),
      channel(0, 3, 0x90, [60, 100]),
    ]])
    const prepared = prepareAuditionSchedule(doc, { stylePartVoiceSetup: false })
    expect(prepared.events).toHaveLength(1)
    expect(hex(prepared.events[0].bytes)).toBe("90 3c 64")
  })

  it("Stop clears timers, panics, and ignores late pump work", () => {
    const { player, session, advance, clock, timer } = createHarness({
      lookaheadMs: 10,
      scheduleIntervalMs: 25,
    })
    const doc = documentOf(96, [[
      channel(0, 0, 0x90, [60, 100]),
      channel(480, 1, 0x80, [60, 0]),
    ]], [480])
    player.start(doc, { port: "port1", stylePartVoiceSetup: false, bpm: 120 })
    advance(0)
    expect(session.sent).toHaveLength(1)
    const panicBefore = session.panicCount
    player.stop()
    expect(session.panicCount).toBeGreaterThan(panicBefore)
    expect(player.playbackState.status).toBe("stopped")
    const sentAfterStop = session.sent.length
    clock.advance(10_000)
    timer.flush()
    expect(session.sent).toHaveLength(sentAfterStop)
  })

  it("panic is callable independently", () => {
    const { player, session } = createHarness()
    player.panic()
    expect(session.panicCount).toBe(1)
  })

  it("restart is cancellation-safe (prior generation cannot send)", () => {
    const { player, session, advance } = createHarness({
      lookaheadMs: 10,
      scheduleIntervalMs: 25,
    })
    const long = documentOf(96, [[
      channel(0, 0, 0x90, [60, 100]),
      channel(960, 1, 0x80, [60, 0]),
    ]])
    const short = documentOf(96, [[
      channel(0, 0, 0x91, [64, 90]),
    ]])
    player.start(long, { port: "port1", stylePartVoiceSetup: false, bpm: 120 })
    advance(0)
    expect(hex(session.sent[0].data)).toBe("90 3c 64")
    player.start(short, { port: "port2", stylePartVoiceSetup: false, bpm: 120 })
    advance(0)
    const afterRestart = session.sent.filter((message) => message.target === "port2")
    expect(afterRestart).toHaveLength(1)
    expect(hex(afterRestart[0].data)).toBe("91 40 5a")
    advance(10_000)
    expect(session.sent.filter((message) => hex(message.data) === "80 3c 00")).toHaveLength(0)
  })

  it("uses bounded lookahead and deterministic timestamps", () => {
    const { player, session, advance, clock } = createHarness({
      lookaheadMs: 50,
      scheduleIntervalMs: 25,
    })
    // 120 BPM, tpq 96 → 1 beat = 500 ms = 96 ticks; 48 ticks = 250 ms
    const doc = documentOf(96, [[
      channel(0, 0, 0x90, [60, 100]),
      channel(48, 1, 0x80, [60, 0]),
    ]])
    player.start(doc, { port: "both", stylePartVoiceSetup: false, bpm: 120 })
    advance(0)
    expect(session.sent).toHaveLength(1)
    expect(session.sent[0].timestamp).toBe(clock.now())
    advance(25)
    expect(session.sent).toHaveLength(1)
    advance(200)
    expect(session.sent).toHaveLength(2)
    expect(session.sent[1].timestamp).toBeCloseTo(session.sent[0].timestamp! + 250, 5)
  })

  it("reaches on-complete state after the last event", () => {
    const harness = createHarness({ lookaheadMs: 1_000, scheduleIntervalMs: 25 })
    const doc = documentOf(96, [[
      channel(0, 0, 0x90, [60, 100]),
      channel(48, 1, 0x80, [60, 0]),
    ]])
    harness.player.start(doc, { port: "port1", stylePartVoiceSetup: false, bpm: 120 })
    harness.advance(0)
    expect(harness.player.playbackState.status).toBe("playing")
    harness.advance(250)
    expect(harness.completed).toBe(1)
    expect(harness.player.playbackState.status).toBe("completed")
    expect(harness.session.panicCount).toBeGreaterThan(0)
  })

  it("sends no server requests (session-only I/O)", () => {
    const fetchCalls: unknown[] = []
    const original = globalThis.fetch
    globalThis.fetch = ((...args: unknown[]) => {
      fetchCalls.push(args)
      return Promise.reject(new Error("unexpected fetch"))
    }) as typeof fetch
    try {
      const { player, advance } = createHarness({ lookaheadMs: 1_000 })
      player.start(
        documentOf(96, [[channel(0, 0, 0x90, [60, 100])]]),
        { port: "port1", stylePartVoiceSetup: false },
      )
      advance(0)
      advance(100)
      expect(fetchCalls).toHaveLength(0)
    } finally {
      globalThis.fetch = original
    }
  })
})
