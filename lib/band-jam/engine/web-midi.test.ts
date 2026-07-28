import { beforeEach, describe, expect, it } from "vitest"
import type { Arrangement, NoteEvent } from "@/lib/band-jam/engine/types"
import {
  MidiOut,
  MidiScheduler,
  STYLE_MIDI_CHANNELS,
  type MidiOutputInfo,
} from "@/lib/band-jam/engine/web-midi"

// ---------------------------------------------------------------------------
// Fakes: the Web MIDI API and AudioContext don't exist in jsdom.
// ---------------------------------------------------------------------------

type SentMessage = { outputId: string; data: number[]; timestamp?: number }

class FakeMidiOutputPort {
  constructor(
    public readonly id: string,
    public readonly name: string,
    private readonly log: SentMessage[],
  ) {}
  send(data: number[], timestamp?: number) {
    this.log.push({ outputId: this.id, data: [...data], timestamp })
  }
}

function createFakeAccess(infos: MidiOutputInfo[]) {
  const log: SentMessage[] = []
  const outputs = new Map<string, FakeMidiOutputPort>()
  for (const info of infos) {
    outputs.set(info.id, new FakeMidiOutputPort(info.id, info.name, log))
  }
  // Map.prototype.forEach has the same (value, key, map) signature as
  // MIDIOutputMap.forEach, so this satisfies the interface structurally.
  const access = { outputs } as unknown as MIDIAccess
  return { access, log }
}

/** Minimal AudioContext stand-in: only `currentTime`/`state`/`resume` are
 *  used by MidiScheduler, and `currentTime` is fully test-controlled so
 *  playback can be advanced deterministically without real timers. */
class FakeAudioContext {
  currentTime = 0
  state: AudioContextState = "running"
  async resume() {
    this.state = "running"
  }
}

function makeMidiOut(infos: MidiOutputInfo[] = [{ id: "out-1", name: "Test Keyboard" }]) {
  const { access, log } = createFakeAccess(infos)
  const midiOut = new MidiOut()
  midiOut.useAccess(access)
  midiOut.selectOutput(infos[0]!.id)
  return { midiOut, log }
}

function note(beat: number, pitch: number, velocity: number, durationBeats: number): NoteEvent {
  return { beat, note: pitch, velocity, durationBeats }
}

function arrangementFromParts(
  parts: Arrangement["parts"],
  opts: { tempo?: number; totalBeats?: number } = {},
): Arrangement {
  return {
    styleId: "test-style",
    progressionId: "test-progression",
    keyPc: 0,
    tempo: opts.tempo ?? 100,
    totalBars: 4,
    totalBeats: opts.totalBeats ?? 16,
    parts,
    sections: [],
  }
}

function noteOns(log: SentMessage[]) {
  return log.filter((m) => (m.data[0]! & 0xf0) === 0x90)
}
function noteOffs(log: SentMessage[]) {
  return log.filter((m) => (m.data[0]! & 0xf0) === 0x80)
}
function allNotesOffs(log: SentMessage[]) {
  return log.filter((m) => (m.data[0]! & 0xf0) === 0xb0 && m.data[1] === 123)
}

// ---------------------------------------------------------------------------
// MidiOut
// ---------------------------------------------------------------------------

describe("MidiOut", () => {
  it("lists and selects outputs", () => {
    const { midiOut } = makeMidiOut([
      { id: "a", name: "Keyboard A" },
      { id: "b", name: "Keyboard B" },
    ])
    expect(midiOut.listOutputs()).toEqual([
      { id: "a", name: "Keyboard A" },
      { id: "b", name: "Keyboard B" },
    ])
    expect(midiOut.selectOutput("b")).toBe(true)
    expect(midiOut.getSelectedOutputId()).toBe("b")
    expect(midiOut.selectOutput("missing")).toBe(false)
  })

  it("sends note on/off with the right status byte, channel, note and velocity", () => {
    const { midiOut, log } = makeMidiOut()
    midiOut.sendNoteOn(2, 60, 100, 1000)
    midiOut.sendNoteOff(2, 60, 0, 2000)
    expect(log).toEqual([
      { outputId: "out-1", data: [0x90 | 2, 60, 100], timestamp: 1000 },
      { outputId: "out-1", data: [0x80 | 2, 60, 0], timestamp: 2000 },
    ])
  })

  it("allNotesOff emits CC123 on the given channel", () => {
    const { midiOut, log } = makeMidiOut()
    midiOut.allNotesOff(9, 500)
    expect(log).toEqual([{ outputId: "out-1", data: [0xb0 | 9, 123, 0], timestamp: 500 }])
  })

  it("selectVoice sends bank MSB, then bank LSB, then Program Change, in that order", () => {
    const { midiOut, log } = makeMidiOut()
    midiOut.selectVoice(11, 8, 1, 3, 42)
    expect(log).toEqual([
      { outputId: "out-1", data: [0xb0 | 11, 0, 8], timestamp: 42 },
      { outputId: "out-1", data: [0xb0 | 11, 32, 1], timestamp: 42 },
      { outputId: "out-1", data: [0xc0 | 11, 3], timestamp: 42 },
    ])
  })

  it("selectVoice passes the program value straight through (0-127, no PRG conversion)", () => {
    const { midiOut, log } = makeMidiOut()
    // pc0 = 3 from megavoice-map.ts's SolidGuitar1 entry -- callers must NOT
    // do the desktop app's `prg - 1` conversion again here.
    midiOut.selectVoice(11, 8, 1, 3)
    const pc = log.find((m) => (m.data[0]! & 0xf0) === 0xc0)!
    expect(pc.data[1]).toBe(3)
  })

  it("is a no-op when no output is selected", () => {
    const { access, log } = createFakeAccess([{ id: "a", name: "A" }])
    const midiOut = new MidiOut()
    midiOut.useAccess(access)
    // Never call selectOutput.
    midiOut.sendNoteOn(0, 60, 100)
    expect(log).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// MidiScheduler
// ---------------------------------------------------------------------------

describe("MidiScheduler", () => {
  let ctx: FakeAudioContext
  let midiOut: MidiOut
  let log: SentMessage[]

  beforeEach(() => {
    ctx = new FakeAudioContext()
    ;({ midiOut, log } = makeMidiOut())
  })

  function scheduler(overrides: Partial<ConstructorParameters<typeof MidiScheduler>[2]> = {}) {
    return new MidiScheduler(ctx as unknown as AudioContext, midiOut, {
      startLatencySec: 0,
      scheduleAheadSec: 0.25,
      tickMs: 40,
      ...overrides,
    })
  }

  it("emits a matched note on/off pair for every event, on the right channel per part", () => {
    const arr = arrangementFromParts([
      { part: "drums", events: [note(0, 36, 100, 1)] },
      { part: "bass", events: [note(0, 40, 90, 1)] },
      { part: "guitar", events: [note(0, 55, 80, 1)] },
      { part: "keys", events: [note(0, 60, 70, 1)] },
      { part: "solo", events: [note(0, 64, 85, 1)] },
    ])
    const s = scheduler()
    s.setArrangement(arr)
    s.play()

    const ons = noteOns(log)
    const offs = noteOffs(log)
    expect(ons).toHaveLength(5)
    expect(offs).toHaveLength(5)

    for (const part of ["drums", "bass", "guitar", "keys", "solo"] as const) {
      const expectedChannel = STYLE_MIDI_CHANNELS[part]
      const on = ons.find((m) => (m.data[0]! & 0x0f) === expectedChannel)
      expect(on, `note-on for ${part} on channel ${expectedChannel}`).toBeTruthy()
      const off = offs.find(
        (m) => (m.data[0]! & 0x0f) === expectedChannel && m.data[1] === on!.data[1],
      )
      expect(off, `matching note-off for ${part}`).toBeTruthy()
    }
    s.dispose()
  })

  it("passes MegaVoice FX notes above 83 through unchanged", () => {
    // 100 is well above FX_PITCH_MIN (83): a noise-layer trigger, not a pitch.
    const arr = arrangementFromParts([
      { part: "guitar", events: [note(0, 100, 90, 1)] },
    ])
    const s = scheduler()
    s.setArrangement(arr)
    s.play()

    const ons = noteOns(log)
    expect(ons).toHaveLength(1)
    expect(ons[0]!.data[1]).toBe(100)
    const offs = noteOffs(log)
    expect(offs[0]!.data[1]).toBe(100)
    s.dispose()
  })

  it("does not schedule notes for a disabled part", () => {
    const arr = arrangementFromParts([
      { part: "guitar", events: [note(0, 60, 90, 1)] },
      { part: "bass", events: [note(0, 40, 90, 1)] },
    ])
    const s = scheduler()
    s.setPartEnabled("guitar", false)
    s.setArrangement(arr)
    s.play()

    const ons = noteOns(log)
    expect(ons).toHaveLength(1)
    expect((ons[0]!.data[0]! & 0x0f)).toBe(STYLE_MIDI_CHANNELS.bass)
    s.dispose()
  })

  it("emits allNotesOff (CC123) on every channel used, when stopped", () => {
    const arr = arrangementFromParts([
      { part: "drums", events: [note(0, 36, 100, 1)] },
      { part: "bass", events: [note(0, 40, 90, 1)] },
    ])
    const s = scheduler()
    s.setArrangement(arr)
    s.play()
    s.stop()

    const cc123 = allNotesOffs(log)
    const channels = new Set(cc123.map((m) => m.data[0]! & 0x0f))
    expect(channels).toEqual(new Set([STYLE_MIDI_CHANNELS.drums, STYLE_MIDI_CHANNELS.bass]))
  })

  it("stopping mid-playback forces silence immediately instead of waiting out a long note (hung-note guard)", () => {
    // One whole-note-length event (4 beats) at 60bpm (1s/beat): its natural
    // note-off would land 4s after the note-on.
    const arr = arrangementFromParts(
      [{ part: "keys", events: [note(0, 60, 90, 4)] }],
      { tempo: 60 },
    )
    const s = scheduler({ scheduleAheadSec: 0.25 })
    s.setArrangement(arr)
    s.play() // schedules the note-on (at ~t=0) and its natural note-off (at ~t=4)

    const on = noteOns(log)[0]!
    const naturalOff = noteOffs(log)[0]!
    expect(naturalOff.timestamp).toBeGreaterThan(on.timestamp! + 3000)

    // The user hits stop almost immediately -- long before the natural
    // note-off would fire.
    ctx.currentTime = 0.1
    s.stop()

    const cc123 = allNotesOffs(log).filter((m) => (m.data[0]! & 0x0f) === STYLE_MIDI_CHANNELS.keys)
    expect(cc123.length).toBeGreaterThan(0)
    // The forced silence must land well before the note's natural end --
    // that's the whole point of the guard.
    expect(cc123[0]!.timestamp).toBeLessThan(naturalOff.timestamp! - 1000)

    // Invariant: for every note-on in the whole log, there is either a
    // matching note-off, or an allNotesOff on that channel at or after the
    // note-on's timestamp. No note is left permanently sounding.
    for (const onMsg of noteOns(log)) {
      const ch = onMsg.data[0]! & 0x0f
      const coveredByOff = noteOffs(log).some(
        (m) => (m.data[0]! & 0x0f) === ch && m.data[1] === onMsg.data[1],
      )
      const coveredByAllOff = allNotesOffs(log).some(
        (m) => (m.data[0]! & 0x0f) === ch && (m.timestamp ?? 0) >= (onMsg.timestamp ?? 0),
      )
      expect(coveredByOff || coveredByAllOff).toBe(true)
    }
  })

  it("does not duplicate or drop notes at a loop boundary", () => {
    // 1-bar loop (4 beats). At 240bpm, secPerBeat = 0.25s, so the loop
    // period is 1s of real time. A downbeat note recurs every pass; a note
    // near the end of the bar tests the seam itself.
    const arr = arrangementFromParts(
      [
        {
          part: "keys",
          events: [note(0, 60, 90, 0.5), note(3, 62, 90, 0.5)],
        },
      ],
      { tempo: 240, totalBeats: 4 },
    )
    const s = scheduler({ scheduleAheadSec: 2.5, tickMs: 40 })
    s.setLoop({ startBar: 1, endBar: 1 })
    s.setArrangement(arr)
    s.play() // single tick() schedules everything inside the 2.5s horizon

    const ons = noteOns(log)
    const note60 = ons.filter((m) => m.data[1] === 60)
    const note62 = ons.filter((m) => m.data[1] === 62)

    // Horizon covers playback beats [0, 10): the beat-0 event recurs at
    // 0, 4, 8 (three times); the beat-3 event recurs at 3, 7 (twice, since
    // 11 >= 10 falls outside the horizon).
    expect(note60).toHaveLength(3)
    expect(note62).toHaveLength(2)

    // No duplicate at the exact same playback instant, and consecutive
    // occurrences are exactly one loop period (1000ms) apart -- proving the
    // boundary neither drops nor double-fires the event.
    const timestamps = note60.map((m) => m.timestamp!).sort((a, b) => a - b)
    expect(new Set(timestamps).size).toBe(timestamps.length)
    expect(timestamps[1]! - timestamps[0]!).toBeCloseTo(1000, 0)
    expect(timestamps[2]! - timestamps[1]!).toBeCloseTo(1000, 0)
    s.dispose()
  })

  it("fires onLoopWrap once per pass and silences ringing notes at the seam", () => {
    // Sustain spanning the whole bar, so it would still be "on" at the seam
    // if nothing silenced it.
    const arr = arrangementFromParts(
      [{ part: "keys", events: [note(0, 60, 90, 4)] }],
      { tempo: 240, totalBeats: 4 },
    )
    let wraps = 0
    const s = scheduler({ onLoopWrap: () => (wraps += 1) })
    s.setLoop({ startBar: 1, endBar: 1 })
    s.setArrangement(arr)
    s.play()
    for (let i = 0; i < 60; i += 1) {
      ctx.currentTime += 0.04
      s.tick()
    }

    expect(wraps).toBeGreaterThanOrEqual(2)
    // A CC123 should land right at the loop boundary (beat 4 -> 1s after the
    // note-on, which fires at ctxTime 0) to stop the 4-beat sustain from
    // bleeding into the next pass. Timestamps are in performance.now()
    // space (an arbitrary wall-clock origin), so compare relative to the
    // note-on rather than to an absolute value.
    const t0 = noteOns(log).find((m) => (m.data[0]! & 0x0f) === STYLE_MIDI_CHANNELS.keys)!
      .timestamp!
    const cc123 = allNotesOffs(log).filter((m) => (m.data[0]! & 0x0f) === STYLE_MIDI_CHANNELS.keys)
    expect(cc123.some((m) => Math.abs((m.timestamp ?? 0) - t0 - 1000) < 30)).toBe(true)
    s.stop()
  })

  it("counts in like BandPlayer — no band notes during the lead-in", () => {
    const arr = arrangementFromParts(
      [{ part: "keys", events: [note(0, 60, 90, 1)] }],
      { tempo: 240, totalBeats: 16 },
    )
    const s = scheduler({ scheduleAheadSec: 0.5, startLatencySec: 0 })
    s.setArrangement(arr)
    s.setCountInBars(1)
    s.play()

    // During the first bar of count-in, playback beats are still before the
    // musical start. A tick at t=0 must not emit the downbeat note.
    expect(noteOns(log)).toHaveLength(0)
    expect(s.isCountingIn()).toBe(true)

    // Reach the last moment of count-in, then let look-ahead cross the seam
    // so the downbeat is still in the future (not dropped as late).
    ctx.currentTime = 0.9
    expect(s.isCountingIn()).toBe(true)
    s.tick()
    expect(noteOns(log).some((m) => m.data[1] === 60)).toBe(true)
    s.dispose()
  })

  it("hot-swaps arrangement mid-play without re-arming count-in", () => {
    // Regression: stop()+play() from bar 0 re-fired the lead-in whenever
    // React rebuilt the arrangement (tempo / key / variation).
    const arrA = arrangementFromParts(
      [{ part: "keys", events: [note(0, 60, 90, 0.5), note(8, 64, 90, 0.5)] }],
      { tempo: 240, totalBeats: 16 },
    )
    const arrB = arrangementFromParts(
      [{ part: "keys", events: [note(0, 67, 90, 0.5), note(8, 71, 90, 0.5)] }],
      { tempo: 240, totalBeats: 16 },
    )
    const s = scheduler({ scheduleAheadSec: 0.5, startLatencySec: 0 })
    s.setArrangement(arrA)
    s.setCountInBars(1)
    s.play()

    // Leave count-in behind (1 bar = 1s at 240bpm) and land mid-form.
    ctx.currentTime = 2.5 // playback beat 6
    s.tick()
    expect(s.isCountingIn()).toBe(false)
    const beatBefore = s.getCurrentBeat()
    expect(beatBefore).toBeGreaterThan(4)

    log.length = 0
    s.setArrangement(arrB)
    expect(s.isCountingIn()).toBe(false)
    expect(s.getCurrentBeat()).toBeCloseTo(beatBefore, 5)
    // Advance a little and schedule — notes from the new chart, no lead-in gap.
    ctx.currentTime = 2.7
    s.tick()
    expect(s.isCountingIn()).toBe(false)
    expect(noteOns(log).some((m) => m.data[1] === 71)).toBe(true)
    s.dispose()
  })

  it("detects a 1-bar loop wrap even when a single tick spans an exact period", () => {
    // The old next < prev fold test missed this: cursorBeat 0 and chunkEnd 4
    // both fold to arrangement beat 0 on a 1-bar loop.
    const arr = arrangementFromParts(
      [{ part: "keys", events: [note(0, 60, 90, 0.25)] }],
      { tempo: 240, totalBeats: 4 },
    )
    let wraps = 0
    const s = scheduler({
      onLoopWrap: () => (wraps += 1),
      scheduleAheadSec: 1.1,
      startLatencySec: 0,
    })
    s.setLoop({ startBar: 1, endBar: 1 })
    s.setArrangement(arr)
    s.play()
    expect(wraps).toBeGreaterThanOrEqual(1)
    s.dispose()
  })
})
