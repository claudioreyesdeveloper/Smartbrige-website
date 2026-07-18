import { describe, expect, it } from "vitest"
import { MixerEngine } from "@/lib/mixer/engine"
import {
  MULTI_PART_OFFSET,
  bulkReply,
  parameterMessage,
  partsForBank,
  xgParameterChange,
} from "@/lib/mixer/protocol"
import type { MixerClock, MixerTransport } from "@/lib/mixer/types"

class FakeClock implements MixerClock {
  private time = 0
  private nextId = 1
  private timers = new Map<number, { at: number; callback: () => void }>()

  now(): number {
    return this.time
  }

  setTimeout(callback: () => void, delayMs: number): unknown {
    const id = this.nextId++
    this.timers.set(id, { at: this.time + delayMs, callback })
    return id
  }

  clearTimeout(handle: unknown): void {
    this.timers.delete(handle as number)
  }

  advance(ms: number): void {
    const target = this.time + ms
    while (true) {
      const next = Array.from(this.timers.entries())
        .filter(([, timer]) => timer.at <= target)
        .sort((left, right) => left[1].at - right[1].at || left[0] - right[0])[0]
      if (!next) break
      this.time = next[1].at
      this.timers.delete(next[0])
      next[1].callback()
    }
    this.time = target
  }
}

class FakeTransport implements MixerTransport {
  readonly port1: Uint8Array[] = []
  readonly port2: Uint8Array[] = []

  sendPort1(data: Uint8Array): void {
    this.port1.push(Uint8Array.from(data))
  }

  sendPort2(data: Uint8Array): void {
    this.port2.push(Uint8Array.from(data))
  }
}

function makeEngine(timeout = 1000) {
  const transport = new FakeTransport()
  const clock = new FakeClock()
  const engine = new MixerEngine(transport, "genos2", clock, timeout)
  engine.setConnected(true)
  return { engine, transport, clock }
}

function mixerPayload(seed: number): Uint8Array {
  const payload = new Uint8Array(0x14)
  payload[MULTI_PART_OFFSET.bankMsb] = seed
  payload[MULTI_PART_OFFSET.bankLsb] = seed + 1
  payload[MULTI_PART_OFFSET.program] = seed + 2
  payload[MULTI_PART_OFFSET.volume] = 90 + seed
  payload[MULTI_PART_OFFSET.pan] = 64
  payload[MULTI_PART_OFFSET.chorus] = 20 + seed
  payload[MULTI_PART_OFFSET.reverb] = 30 + seed
  return payload
}

describe("MixerEngine state and routing", () => {
  it("starts all 32 channels with exact partitions and unknown values", () => {
    const { engine } = makeEngine()
    expect(engine.state.channels).toHaveLength(32)
    expect(engine.state.channels[0]).toMatchObject({
      channel: 1,
      bank: "style",
      port: "port2",
      label: "Right 1",
      protocolPart: 1,
      modelOrigin: "genos2",
      known: false,
      origin: "unknown",
      volume: null,
      voice: null,
    })
    expect(engine.state.channels[16]).toMatchObject({
      channel: 17,
      bank: "song",
      port: "port1",
      label: "Song 1",
      protocolPart: 0,
    })
  })

  it("routes essential UI writes and keeps mute functional", () => {
    const { engine, transport } = makeEngine()
    engine.setParameter(1, "volume", 111)
    engine.setParameter(17, "pan", 70)
    engine.setVoice(17, { msb: 8, lsb: 10, program: 4 })
    engine.setMute(1, true)
    engine.setParameter(1, "volume", 88)
    engine.setMute(1, false)

    expect([...transport.port2[0]]).toEqual([0xf0, 0x43, 0x10, 0x4c, 8, 1, 0x0b, 111, 0xf7])
    expect([...transport.port1[0]]).toEqual([0xb0, 10, 70])
    expect(transport.port1.slice(1, 4).map((message) => Array.from(message))).toEqual([
      [0xb0, 0, 8],
      [0xb0, 32, 10],
      [0xc0, 3],
    ])
    expect(transport.port2.slice(-3).map((message) => message[7])).toEqual([0, 0, 88])
    expect(engine.state.channels[0]).toMatchObject({
      volume: 88,
      muted: false,
      origin: "ui",
    })
  })

  it("completes refresh only from actual bulk replies and handles shared part 0x08", () => {
    const { engine, transport } = makeEngine()
    engine.refresh()

    expect(transport.port2).toHaveLength(15)
    expect(engine.state.refresh.style).toMatchObject({
      status: "loading",
      requested: 15,
      replied: 0,
    })
    partsForBank("style").forEach((part, index) => {
      engine.handleMidi(bulkReply(part, mixerPayload(index)), null)
    })

    expect(engine.state.refresh.style).toMatchObject({
      status: "loaded",
      requested: 15,
      replied: 15,
    })
    expect(engine.state.refresh.song.status).toBe("loading")
    expect(transport.port1).toHaveLength(16)
    expect(engine.state.channels[7].known).toBe(false)
    expect(engine.state.channels[8]).toMatchObject({
      known: true,
      volume: 97,
      origin: "hardware",
    })

    partsForBank("song").forEach((part, index) => {
      engine.handleMidi(bulkReply(part, mixerPayload(index)), null)
    })
    expect(engine.state.refresh.song).toMatchObject({
      status: "loaded",
      requested: 16,
      replied: 16,
    })
  })

  it("uses explicit source ports for spontaneous shared-part updates", () => {
    const { engine } = makeEngine()
    const message = parameterMessage(9, "reverb", 55)
    expect(engine.handleMidi(message, "port2")).toBe(true)
    expect(engine.state.channels[7].reverb).toBe(55)
    expect(engine.state.channels[8].reverb).toBe(55)
    expect(engine.handleMidi(message, null)).toBe(false)
  })

  it("prefers recent CC volume over conflicting SysEx for three seconds", () => {
    const { engine, clock } = makeEngine()
    engine.handleMidi(Uint8Array.of(0xb0, 7, 96), "port1")
    engine.handleMidi(xgParameterChange(0, MULTI_PART_OFFSET.volume, 70), "port1")
    expect(engine.state.channels[16].volume).toBe(96)

    clock.advance(3001)
    engine.handleMidi(xgParameterChange(0, MULTI_PART_OFFSET.volume, 70), "port1")
    expect(engine.state.channels[16]).toMatchObject({
      volume: 70,
      origin: "hardware",
    })
  })

  it("marks timed-out and disconnected state stale, then allows recovery", () => {
    const { engine, clock, transport } = makeEngine()
    engine.setParameter(17, "volume", 80)
    engine.refresh()
    clock.advance(1000)
    expect(engine.state.refresh.style.status).toBe("timed-out")
    expect(engine.state.refresh.song.status).toBe("loading")
    clock.advance(1000)
    expect(engine.state.refresh.song.status).toBe("timed-out")
    expect(engine.state.channels[16].stale).toBe(true)

    engine.setConnected(false)
    expect(engine.state.refresh.style.status).toBe("disconnected")
    expect(() => engine.refresh()).toThrow("Connect the keyboard")

    engine.setConnected(true)
    engine.refresh()
    expect(engine.state.refresh.style.status).toBe("loading")
    expect(transport.port2).toHaveLength(30)
  })
})
