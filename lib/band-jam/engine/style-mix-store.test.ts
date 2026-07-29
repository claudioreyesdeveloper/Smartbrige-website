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
    saveStyleMix("funk", funk)

    const rock = base()
    rock.guitar.volume = 0.55
    saveStyleMix("rock", rock)

    expect(loadStyleMix("funk", base()).guitar.volume).toBe(0.31)
    expect(loadStyleMix("funk", base()).keys.volume).toBe(0.62)
    expect(loadStyleMix("rock", base()).guitar.volume).toBe(0.55)
  })

  it("never restores temporary mute state", () => {
    const funk = base()
    funk.guitar.muted = true
    saveStyleMix("funk", funk)
    expect(loadStyleMix("funk", base()).guitar.muted).toBe(false)
  })

  it("stores EQ, pan, sends and room with the style", () => {
    const funk = mixer()
    funk.eq.guitar = { low: -2.5, mid: 1.5, high: 3 }
    funk.pan.guitar = -0.35
    funk.sends.guitar = 0.27
    funk.room = 0.31
    saveStyleMixer("funk", 0, funk)

    const loaded = loadStyleMixer("funk", 0, mixer())
    expect(loaded.eq.guitar).toEqual({ low: -2.5, mid: 1.5, high: 3 })
    expect(loaded.pan.guitar).toBe(-0.35)
    expect(loaded.sends.guitar).toBe(0.27)
    expect(loaded.room).toBe(0.31)
  })

  it("keeps A-D mixes independent inside the same style", () => {
    const popA = mixer()
    popA.mix.guitar.volume = 0.28
    saveStyleMixer("pop", 0, popA)

    const popB = mixer()
    popB.mix.guitar.volume = 0.61
    popB.eq.drums.mid = 2.5
    saveStyleMixer("pop", 1, popB)

    expect(loadStyleMixer("pop", 0, mixer()).mix.guitar.volume).toBe(0.28)
    expect(loadStyleMixer("pop", 1, mixer()).mix.guitar.volume).toBe(0.61)
    expect(loadStyleMixer("pop", 0, mixer()).eq.drums.mid).toBe(0)
    expect(loadStyleMixer("pop", 1, mixer()).eq.drums.mid).toBe(2.5)
  })

  it("resets only the selected variation", () => {
    const popA = mixer()
    popA.mix.bass.volume = 0.4
    saveStyleMixer("pop", 0, popA)
    const popB = mixer()
    popB.mix.bass.volume = 0.7
    saveStyleMixer("pop", 1, popB)

    clearStyleMix("pop", 1)
    expect(loadStyleMixer("pop", 0, mixer()).mix.bass.volume).toBe(0.4)
    expect(loadStyleMixer("pop", 1, mixer()).mix.bass.volume).toBe(1)
  })

  it("clears one style without changing the others", () => {
    const funk = base()
    funk.guitar.volume = 0.2
    saveStyleMix("funk", funk)
    const rock = base()
    rock.guitar.volume = 0.4
    saveStyleMix("rock", rock)

    clearStyleMix("funk", 0)
    expect(loadStyleMix("funk", base()).guitar.volume).toBe(0.8)
    expect(loadStyleMix("rock", base()).guitar.volume).toBe(0.4)
    expect(window.localStorage.getItem(STYLE_MIX_STORAGE_KEY)).toContain("rock")
  })
})
