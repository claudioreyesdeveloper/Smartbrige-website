import { describe, expect, it } from "vitest"
import { TempoFollower } from "@/lib/demo/yamaha/tempo-follower"

describe("TempoFollower", () => {
  it("measures BPM from F8 beat boundaries like desktop TyrosTempoFollower", () => {
    const follower = new TempoFollower()
    const bpm = 120
    const msPerBeat = 60000 / bpm
    const msPerTick = msPerBeat / 24

    // Two full beats of clock pulses.
    for (let tick = 1; tick <= 48; tick += 1) {
      follower.handleMessage(Uint8Array.of(0xf8), tick * msPerTick)
    }

    expect(follower.getCurrentBPM(48 * msPerTick)).toBeCloseTo(120, 0)
  })

  it("parses Style Tempo Control SysEx into BPM", () => {
    const follower = new TempoFollower()
    // 120 BPM → 500_000 µs/qn → 7-bit packed big-endian
    const micros = 500_000
    const t4 = (micros >> 21) & 0x7f
    const t3 = (micros >> 14) & 0x7f
    const t2 = (micros >> 7) & 0x7f
    const t1 = micros & 0x7f
    const bpm = follower.applyStyleTempoSysex(
      Uint8Array.of(0xf0, 0x43, 0x7e, 0x01, t4, t3, t2, t1, 0xf7),
    )
    expect(bpm).toBe(120)
    expect(follower.getCurrentBPM()).toBe(120)
  })

  it("reports tempo locked after two beat-boundary samples", () => {
    const follower = new TempoFollower()
    const msPerTick = (60000 / 120) / 24
    for (let tick = 1; tick <= 24; tick += 1) {
      follower.handleMessage(Uint8Array.of(0xf8), tick * msPerTick)
    }
    expect(follower.hasReceivedClock()).toBe(true)
    expect(follower.isTempoLocked()).toBe(false)
    for (let tick = 25; tick <= 72; tick += 1) {
      follower.handleMessage(Uint8Array.of(0xf8), tick * msPerTick)
    }
    expect(follower.isTempoLocked()).toBe(true)
    expect(follower.getCurrentBPM(72 * msPerTick)).toBeCloseTo(120, 0)
  })

  it("freezes last BPM after clock loss", () => {
    const follower = new TempoFollower()
    const msPerTick = (60000 / 100) / 24
    for (let tick = 1; tick <= 72; tick += 1) {
      follower.handleMessage(Uint8Array.of(0xf8), tick * msPerTick)
    }
    const locked = follower.getCurrentBPM(72 * msPerTick)
    expect(locked).toBeCloseTo(100, 0)
    expect(follower.getCurrentBPM(72 * msPerTick + 500)).toBeCloseTo(100, 0)
  })
})
