import { beforeEach, describe, expect, it } from "vitest"
import type { BandPart, PartMixState } from "@/lib/band-jam/engine/types"
import {
  clearStyleMix,
  loadStyleMixer,
  loadStyleMix,
  saveStyleMixer,
  saveStyleMix,
  STYLE_MIX_STORAGE_KEY,
  type StyleMixerState,
} from "@/lib/band-jam/engine/style-mix-store"

const base = (): Record<BandPart, PartMixState> => ({
  drums: { volume: 1, muted: false },
  bass: { volume: 1, muted: false },
  guitar: { volume: 0.8, muted: false },
  keys: { volume: 0.75, muted: false },
  solo: { volume: 0.8, muted: true },
})

const mixer = (): StyleMixerState => ({
  mix: base(),
  eq: {
    drums: { low: 0, mid: 0, high: 0 },
    bass: { low: 0, mid: 0, high: 0 },
    guitar: { low: 0, mid: 0, high: 0 },
    keys: { low: 0, mid: 0, high: 0 },
    solo: { low: 0, mid: 0, high: 0 },
  },
  sends: { drums: 0.1, bass: 0.05, guitar: 0.12, keys: 0.18, solo: 0.2 },
  pan: { drums: 0, bass: 0, guitar: -0.2, keys: 0.2, solo: 0 },
  room: 0.22,
})

describe("per-style and variation mixer memory", () => {
  beforeEach(() => {
    const values = new Map<string, string>()
    const storage: Storage = {
      get length() {
        return values.size
      },
      clear: () => values.clear(),
      getItem: (key) => values.get(key) ?? null,
      key: (index) => [...values.keys()][index] ?? null,
      removeItem: (key) => void values.delete(key),
      setItem: (key, value) => void values.set(key, String(value)),
    }
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: storage,
    })
  })

  it("keeps each style's levels independent", () => {
    const funk = base()
    funk.guitar.volume = 0.31
    funk.keys.volume = 0.62
    saveStyleMix("test-funk", funk)

    const rock = base()
    rock.guitar.volume = 0.55
    saveStyleMix("test-rock", rock)

    expect(loadStyleMix("test-funk", base()).guitar.volume).toBe(0.31)
    expect(loadStyleMix("test-funk", base()).keys.volume).toBe(0.62)
    expect(loadStyleMix("test-rock", base()).guitar.volume).toBe(0.55)
  })

  it("never restores temporary mute state", () => {
    const funk = base()
    funk.guitar.muted = true
    saveStyleMix("test-funk", funk)
    expect(loadStyleMix("test-funk", base()).guitar.muted).toBe(false)
  })

  it("stores EQ, pan, sends and room with the style", () => {
    const funk = mixer()
    funk.eq.guitar = { low: -2.5, mid: 1.5, high: 3 }
    funk.pan.guitar = -0.35
    funk.sends.guitar = 0.27
    funk.room = 0.31
    saveStyleMixer("test-funk", 0, funk)

    const loaded = loadStyleMixer("test-funk", 0, mixer())
    expect(loaded.eq.guitar).toEqual({ low: -2.5, mid: 1.5, high: 3 })
    expect(loaded.pan.guitar).toBe(-0.35)
    expect(loaded.sends.guitar).toBe(0.27)
    expect(loaded.room).toBe(0.31)
  })

  it("keeps A-D mixes independent inside the same style", () => {
    const popA = mixer()
    popA.mix.guitar.volume = 0.28
    saveStyleMixer("test-pop", 0, popA)

    const popB = mixer()
    popB.mix.guitar.volume = 0.61
    popB.eq.drums.mid = 2.5
    saveStyleMixer("test-pop", 1, popB)

    expect(loadStyleMixer("test-pop", 0, mixer()).mix.guitar.volume).toBe(0.28)
    expect(loadStyleMixer("test-pop", 1, mixer()).mix.guitar.volume).toBe(0.61)
    expect(loadStyleMixer("test-pop", 0, mixer()).eq.drums.mid).toBe(0)
    expect(loadStyleMixer("test-pop", 1, mixer()).eq.drums.mid).toBe(2.5)
  })

  it("resets only the selected variation", () => {
    const popA = mixer()
    popA.mix.bass.volume = 0.4
    saveStyleMixer("test-pop", 0, popA)
    const popB = mixer()
    popB.mix.bass.volume = 0.7
    saveStyleMixer("test-pop", 1, popB)

    clearStyleMix("test-pop", 1)
    expect(loadStyleMixer("test-pop", 0, mixer()).mix.bass.volume).toBe(0.4)
    expect(loadStyleMixer("test-pop", 1, mixer()).mix.bass.volume).toBe(1)
  })

  it("clears one style without changing the others", () => {
    const funk = base()
    funk.guitar.volume = 0.2
    saveStyleMix("test-funk", funk)
    const rock = base()
    rock.guitar.volume = 0.4
    saveStyleMix("test-rock", rock)

    clearStyleMix("test-funk", 0)
    expect(loadStyleMix("test-funk", base()).guitar.volume).toBe(0.8)
    expect(loadStyleMix("test-rock", base()).guitar.volume).toBe(0.4)
    expect(window.localStorage.getItem(STYLE_MIX_STORAGE_KEY)).toContain("test-rock")
  })

  it("loads the musician-approved production mix for each variation", () => {
    const popB = loadStyleMixer("pop", 1, mixer())

    expect(popB.room).toBe(0.26)
    expect(popB.mix.drums.volume).toBe(0.806182861328125)
    expect(popB.eq.bass).toEqual({ low: 9.5, mid: 2.5, high: -7.5 })
    expect(popB.sends.guitar).toBe(0.55)
    expect(popB.pan.keys).toBe(-0.61)
  })

  it("applies a browser save over the production mix", () => {
    const personalPopB = loadStyleMixer("pop", 1, mixer())
    personalPopB.mix.guitar.volume = 0.33
    personalPopB.eq.drums.mid = -1.5
    saveStyleMixer("pop", 1, personalPopB)

    const loaded = loadStyleMixer("pop", 1, mixer())
    expect(loaded.mix.guitar.volume).toBe(0.33)
    expect(loaded.eq.drums.mid).toBe(-1.5)
    expect(loaded.room).toBe(0.26)
  })

  it("returns to the production mix when a personal override is reset", () => {
    const personalPopB = loadStyleMixer("pop", 1, mixer())
    personalPopB.mix.bass.volume = 0.25
    saveStyleMixer("pop", 1, personalPopB)

    clearStyleMix("pop", 1)
    const reset = loadStyleMixer("pop", 1, mixer())
    expect(reset.mix.bass.volume).toBe(0.791015625)
    expect(reset.room).toBe(0.26)
  })
})
