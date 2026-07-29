import { beforeEach, describe, expect, it } from "vitest"
import { buildDefaultStyleArranger } from "@/lib/band-jam/engine/style-arranger"
import {
  clearStyleArranger,
  loadStyleArranger,
  saveStyleArranger,
  STYLE_ARRANGER_STORAGE_KEY,
} from "@/lib/band-jam/engine/style-arranger-store"
import type { BandStyle } from "@/lib/band-jam/engine/types"

const style: BandStyle = {
  id: "funk",
  name: "Funk",
  tempoDefault: 108,
  tempoMin: 70,
  tempoMax: 150,
  parts: {
    drums: { instrument: "drums", gain: 1, harmonic: false, slots: {} },
    bass: { instrument: "bass", gain: 1, harmonic: true, slots: {} },
    guitar: { instrument: "guitar", gain: 1, harmonic: true, slots: {} },
    keys: { instrument: "keys", gain: 1, harmonic: true, slots: {} },
  },
}

describe("per-style arranger memory", () => {
  beforeEach(() => {
    const values = new Map<string, string>()
    const storage: Storage = {
      get length() { return values.size },
      clear: () => values.clear(),
      getItem: (key) => values.get(key) ?? null,
      key: (index) => [...values.keys()][index] ?? null,
      removeItem: (key) => void values.delete(key),
      setItem: (key, value) => void values.set(key, String(value)),
    }
    Object.defineProperty(window, "localStorage", { configurable: true, value: storage })
  })

  it("saves A-D independently for one style", () => {
    const state = buildDefaultStyleArranger(style, 4)
    state[0].intro.bass = false
    state[3].chorus.guitar = false
    saveStyleArranger("funk", state)

    const loaded = loadStyleArranger("funk", buildDefaultStyleArranger(style, 4))
    expect(loaded[0].intro.bass).toBe(false)
    expect(loaded[3].chorus.guitar).toBe(false)
    expect(loaded[1].intro.bass).toBe(true)
  })

  it("merges partial saved data over new defaults", () => {
    window.localStorage.setItem(
      STYLE_ARRANGER_STORAGE_KEY,
      JSON.stringify({ funk: [{ intro: { drums: false, bass: "invalid" } }] }),
    )
    const loaded = loadStyleArranger("funk", buildDefaultStyleArranger(style, 4))
    expect(loaded[0].intro.drums).toBe(false)
    expect(loaded[0].intro.bass).toBe(true)
    expect(loaded[1].chorus.keys).toBe(true)
  })

  it("clears only the requested style", () => {
    const state = buildDefaultStyleArranger(style, 4)
    state[0].intro.drums = false
    saveStyleArranger("funk", state)
    saveStyleArranger("pop", state)
    clearStyleArranger("funk")
    expect(loadStyleArranger("funk", buildDefaultStyleArranger(style, 4))[0].intro.drums).toBe(true)
    expect(loadStyleArranger("pop", buildDefaultStyleArranger(style, 4))[0].intro.drums).toBe(false)
  })
})
