import { describe, expect, it } from "vitest"
import {
  MIDI_CONTRACT_VERSION,
  exportSmf,
  type CanonicalMidiDocument,
} from "@/lib/midi"
import {
  MAX_RENDERED_AUDITION_SMF_BYTES,
  RhythmRenderedAuditionPlayer,
  type AuditionClock,
  type AuditionMidiSession,
  type AuditionTimer,
  type AuditionTimerHandle,
  type RhythmRenderedAuditionPayload,
  type RhythmRenderedAuditionState,
  type RhythmRenderedPart,
  type RhythmRenderedPlaybackDescriptor,
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
    return { clear: () => this.tasks.delete(id) }
  }

  flush() {
    for (;;) {
      const ready = [...this.tasks.entries()]
        .filter(([, task]) => task.due <= this.clock.now())
        .sort((a, b) => a[1].due - b[1].due || a[0] - b[0])[0]
      if (!ready) return
      this.tasks.delete(ready[0])
      ready[1].callback()
    }
  }
}

class FakeSession implements AuditionMidiSession {
  sent: SentMessage[] = []
  panicCount = 0
  sendError: Error | null = null

  send(data: Uint8Array, timestamp?: number, target: MidiSendTarget = "both") {
    if (this.sendError) throw this.sendError
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

function base64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
}

function smf(channel: number, endTick = 480): string {
  const statusChannel = channel - 1
  const document: CanonicalMidiDocument = {
    version: MIDI_CONTRACT_VERSION,
    format: 0,
    ticksPerQuarter: 480,
    tracks: [{
      endTick,
      events: [
        {
          kind: "channel",
          tick: 0,
          sequence: 0,
          status: 0x90 | statusChannel,
          data: [60, 100],
        },
        {
          kind: "channel",
          tick: endTick,
          sequence: 1,
          status: 0x80 | statusChannel,
          data: [60, 0],
        },
      ],
    }],
  }
  return base64(exportSmf(document))
}

function playback(
  channel: number,
  kind: RhythmRenderedPlaybackDescriptor["kind"],
): RhythmRenderedPlaybackDescriptor {
  if (kind === "channel-current") {
    return {
      channel,
      kind,
      label: "Current channel",
      bankMsb: null,
      bankLsb: null,
      programYamaha: null,
    }
  }
  return {
    channel,
    kind,
    label: kind === "drum-kit" ? "Percussion kit" : "Bass voice",
    bankMsb: kind === "drum-kit" ? 126 : 8,
    bankLsb: kind === "drum-kit" ? 8 : 0,
    programYamaha: kind === "drum-kit" ? 46 : 18,
  }
}

function payload(
  part: RhythmRenderedPart,
  descriptor: RhythmRenderedPlaybackDescriptor,
  renderedSmf = smf(descriptor.channel),
): RhythmRenderedAuditionPayload {
  return {
    part,
    durationMs: 500,
    renderedSmf,
    playback: descriptor,
  }
}

function hex(data: Uint8Array): string {
  return [...data].map((byte) => byte.toString(16).padStart(2, "0")).join(" ")
}

function harness() {
  const clock = new FakeClock()
  const timer = new FakeTimer(clock)
  const session = new FakeSession()
  const player = new RhythmRenderedAuditionPlayer({
    session,
    clock,
    timer,
    lookaheadMs: 10,
    scheduleIntervalMs: 25,
  })
  const advance = (ms: number) => {
    clock.advance(ms)
    timer.flush()
  }
  return { clock, timer, session, player, advance }
}

describe("RhythmRenderedAuditionPlayer", () => {
  it("strictly rejects malformed, noncanonical, and oversized base64 before SMF parsing", () => {
    const cases = [
      "not base64",
      smf(11).replace(/=+$/, ""),
      "A".repeat(Math.ceil(MAX_RENDERED_AUDITION_SMF_BYTES / 3) * 4 + 4),
    ]
    for (const renderedSmf of cases) {
      const { player, session } = harness()
      expect(() => player.start(payload("bass", playback(11, "mega-voice"), renderedSmf)))
        .toThrow(/base64|size limit/)
      expect(session.sent).toHaveLength(0)
      expect(player.playbackState.status).toBe("error")
    }
  })

  it("parses with the canonical MIDI module and rejects mismatched MIDI channels", () => {
    const { player } = harness()
    expect(() => player.start(payload("bass", playback(11, "mega-voice"), smf(10))))
      .toThrow(/does not match playback channel/)
  })

  it("sets the bass voice on channel 11 through XG Port 2 before scheduling", () => {
    const { player, session } = harness()
    player.start(payload("bass", playback(11, "mega-voice")))

    expect(session.sent.map((message) => [message.target, hex(message.data)])).toEqual([
      ["port2", "f0 43 10 4c 08 0a 01 08 f7"],
      ["port2", "f0 43 10 4c 08 0a 02 00 f7"],
      ["port2", "f0 43 10 4c 08 0a 03 11 f7"],
      ["port2", "9a 3c 64"],
    ])
    expect(player.playbackState.status).toBe("playing")
  })

  it("uses current channel 10 for drums and sends no voice setup", () => {
    const { player, session } = harness()
    player.start(payload("drums", playback(10, "channel-current")))

    expect(session.sent).toHaveLength(1)
    expect(session.sent[0].target).toBe("port2")
    expect(hex(session.sent[0].data)).toBe("99 3c 64")
  })

  it("auditions rendered Solo MIDI on canonical channel 1 without voice setup", () => {
    const { player, session } = harness()
    player.start(payload("solo", playback(1, "channel-current")))

    expect(session.sent).toHaveLength(1)
    expect(session.sent[0].target).toBe("port2")
    expect(hex(session.sent[0].data)).toBe("90 3c 64")
  })

  it("sets a Genos percussion kit on channel 9 through XG Port 2", () => {
    const { player, session } = harness()
    player.start(payload("drums", playback(9, "drum-kit")))

    expect(session.sent.map((message) => hex(message.data))).toEqual([
      "f0 43 10 4c 08 08 01 7e f7",
      "f0 43 10 4c 08 08 02 08 f7",
      "f0 43 10 4c 08 08 03 2d f7",
      "98 3c 64",
    ])
    expect(session.sent.every((message) => message.target === "port2")).toBe(true)
  })

  it("accepts fill live channels 9 and 10", () => {
    const current = harness()
    current.player.start(payload("fill", playback(10, "channel-current")))
    expect(hex(current.session.sent.at(-1)!.data)).toBe("99 3c 64")

    const percussion = harness()
    percussion.player.start(payload("fill", playback(9, "drum-kit")))
    expect(hex(percussion.session.sent.at(-1)!.data)).toBe("98 3c 64")
  })

  it.each([
    ["bass", 3, "mega-voice"],
    ["drums", 2, "channel-current"],
    ["fill", 2, "channel-current"],
    ["bass", 11, "channel-current"],
    ["drums", 10, "drum-kit"],
  ] as const)(
    "rejects unexpected stored or mismatched descriptor: %s channel %i %s",
    (part, channel, kind) => {
      const { player, session } = harness()
      expect(() => player.start(payload(part, playback(channel, kind)))).toThrow(
        /stored-project channels are not playable/,
      )
      expect(session.sent).toHaveLength(0)
    },
  )

  it("Stop cancels late scheduling and panics", () => {
    const { player, session, advance } = harness()
    player.start(payload("drums", playback(10, "channel-current"), smf(10, 960)))
    const sentBeforeStop = session.sent.length
    const panicBeforeStop = session.panicCount

    player.stop()
    advance(10_000)

    expect(session.panicCount).toBeGreaterThan(panicBeforeStop)
    expect(session.sent).toHaveLength(sentBeforeStop)
    expect(player.playbackState.status).toBe("stopped")
  })

  it("exposes panic and cancellation-safe state subscriptions", () => {
    const { player, session } = harness()
    const states: RhythmRenderedAuditionState[] = []
    const unsubscribe = player.subscribe((state) => states.push(state))

    player.start(payload("drums", playback(10, "channel-current")))
    player.panic()
    unsubscribe()
    player.stop()

    expect(session.panicCount).toBeGreaterThan(0)
    expect(states[0].status).toBe("idle")
    expect(states.some((state) => state.status === "playing")).toBe(true)
    expect(states.at(-1)?.status).toBe("playing")
  })

  it("reports Yamaha connection failures as error state", () => {
    const { player, session } = harness()
    session.sendError = new Error("Connect the keyboard before sending MIDI.")

    expect(() => player.start(payload("bass", playback(11, "mega-voice")))).toThrow(
      /Connect the keyboard/,
    )
    expect(player.playbackState.status).toBe("error")
    expect(player.playbackState.error).toMatch(/Connect the keyboard/)
  })

  it("cancels playback and reports a connection failure from a later scheduling pump", () => {
    const { player, session, advance } = harness()
    player.start(payload("drums", playback(10, "channel-current")))
    session.sendError = new Error("Keyboard disconnected.")

    advance(500)

    expect(player.playbackState.status).toBe("error")
    expect(player.playbackState.error).toBe("Keyboard disconnected.")
    expect(session.sent).toHaveLength(1)
  })
})

