import { describe, expect, it, vi } from "vitest"
import { JamPlayerController } from "@/lib/band-jam/engine/jam-player-controller"
import type { Arrangement, BandPart, PartMixState } from "@/lib/band-jam/engine/types"

const mix: Record<BandPart, PartMixState> = {
  drums: { volume: 1, muted: false },
  bass: { volume: 0.9, muted: false },
  guitar: { volume: 0.8, muted: false },
  keys: { volume: 0.7, muted: false },
  solo: { volume: 0.6, muted: true },
}

const arrangement: Arrangement = {
  styleId: "funk",
  progressionId: "p1",
  tempo: 100,
  keyPc: 0,
  totalBars: 4,
  totalBeats: 16,
  parts: [],
  sections: [],
}

function fakePlayer() {
  return {
    pause: vi.fn(),
    play: vi.fn(),
    stop: vi.fn(),
    dispose: vi.fn(),
    setArrangement: vi.fn(),
    setTempo: vi.fn(),
    setLoop: vi.fn(),
    setCountInBars: vi.fn(),
    setMetronome: vi.fn(),
    setMuted: vi.fn(),
    setVolume: vi.fn(),
    seekToBar: vi.fn(),
    getStatus: vi.fn(() => "ready"),
    getCurrentBeat: vi.fn(() => 4),
    getCurrentBar: vi.fn(() => 2),
    isCountingIn: vi.fn(() => false),
    getTempo: vi.fn(() => 100),
  }
}

function fakeMidi() {
  return {
    pause: vi.fn(),
    play: vi.fn(),
    stop: vi.fn(),
    dispose: vi.fn(),
    setArrangement: vi.fn(),
    setTempo: vi.fn(),
    setLoop: vi.fn(),
    setCountInBars: vi.fn(),
    setPartEnabled: vi.fn(),
    seekToBar: vi.fn(),
  }
}

describe("JamPlayerController", () => {
  it("applies tempo and playback pass to both sinks", () => {
    const controller = new JamPlayerController()
    const player = fakePlayer()
    const midi = fakeMidi()
    const effects = { setTempo: vi.fn(), dispose: vi.fn() }
    controller.attachAudio(
      { state: "running" } as AudioContext,
      player as never,
      effects as never,
    )
    controller.attachMidi(midi as never)
    controller.setMix(mix)

    controller.installPlaybackPass(arrangement, {
      startBar: 3,
      resume: true,
      range: { startBar: 3, endBar: 4 },
      tempo: 128,
      countIn: true,
      metronome: true,
    })

    expect(player.setTempo).toHaveBeenCalledWith(128)
    expect(midi.setTempo).toHaveBeenCalledWith(128)
    expect(effects.setTempo).toHaveBeenCalledWith(128)
    expect(player.seekToBar).toHaveBeenCalledWith(3)
    expect(midi.seekToBar).toHaveBeenCalledWith(3)
    expect(player.play).toHaveBeenCalled()
    expect(midi.play).toHaveBeenCalled()
  })

  it("uses one solo mask for audio and MIDI", () => {
    const controller = new JamPlayerController()
    const player = fakePlayer()
    const midi = fakeMidi()
    controller.attachAudio(
      { state: "running" } as AudioContext,
      player as never,
      { dispose: vi.fn(), setTempo: vi.fn() } as never,
    )
    controller.attachMidi(midi as never)
    controller.setMix(mix)
    controller.setSoloed("guitar")

    expect(player.setMuted).toHaveBeenCalledWith("guitar", false)
    expect(player.setMuted).toHaveBeenCalledWith("drums", true)
    expect(midi.setPartEnabled).toHaveBeenCalledWith("guitar", true)
    expect(midi.setPartEnabled).toHaveBeenCalledWith("drums", false)
  })
})
