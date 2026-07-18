import { describe, expect, it, vi } from "vitest"
import { createDisplaySafeMixerFakes } from "@/components/genos-mixer/fakes"
import { parseMixFile, serializeMixFile } from "@/components/genos-mixer/mix-file"
import {
  channelsForPage,
  initialMixerWorkspaceState,
  mixerWorkspaceReducer,
  STYLE_PART_LABELS,
  supportsGenosMixer,
} from "@/components/genos-mixer/state"

describe("Genos Mixer state", () => {
  it("preserves verified Style and Song channel hierarchy", () => {
    expect(STYLE_PART_LABELS).toEqual([
      "Right 1", "Right 2", "Right 3", "Left",
      "Multi Pad 1", "Multi Pad 2", "Multi Pad 3", "Multi Pad 4",
      "Rhythm 1", "Rhythm 2", "Bass", "Chord 1", "Chord 2", "Pad",
      "Phrase 1", "Phrase 2",
    ])
    expect(channelsForPage(initialMixerWorkspaceState).map((channel) => channel.part))
      .toEqual(Array.from({ length: 16 }, (_, index) => index + 1))
    const song = mixerWorkspaceReducer(initialMixerWorkspaceState, {
      type: "select-page",
      page: "song",
    })
    expect(channelsForPage(song).map((channel) => channel.label))
      .toEqual(Array.from({ length: 16 }, (_, index) => `Song ${index + 1}`))
  })

  it("clamps essential levels and toggles mute", () => {
    const loud = mixerWorkspaceReducer(initialMixerWorkspaceState, {
      type: "change-level",
      part: 1,
      field: "volume",
      value: 200,
    })
    expect(loud.channels[0]?.volume).toBe(127)
    const muted = mixerWorkspaceReducer(loud, { type: "toggle-mute", part: 1 })
    expect(muted.channels[0]?.mute).toBe(true)
  })

  it("stops unsupported clients clearly", () => {
    expect(supportsGenosMixer(
      "Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/140.0 Safari/537.36",
      true,
    )).toBe(true)
    expect(supportsGenosMixer(
      "Mozilla/5.0 (iPad) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15",
      true,
    )).toBe(false)
    expect(supportsGenosMixer(
      "Mozilla/5.0 (Macintosh) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15",
      true,
    )).toBe(false)
  })
})

describe("mix file save/load", () => {
  it("round-trips essential mixer values", () => {
    const channels = initialMixerWorkspaceState.channels.map((channel) =>
      channel.part === 11
        ? {
            ...channel,
            volume: 73,
            pan: 41,
            reverb: 55,
            chorus: 17,
            mute: true,
            voiceId: "genos-finger-bass",
            voiceName: "MegaVoice Finger Bass",
            known: true,
          }
        : channel,
    )
    const reopened = parseMixFile(serializeMixFile(channels))
    expect(reopened.find((channel) => channel.part === 11)).toMatchObject({
      volume: 73,
      pan: 41,
      reverb: 55,
      chorus: 17,
      mute: true,
      voiceId: "genos-finger-bass",
    })
  })

  it("publishes refresh progress and a typed error state", async () => {
    vi.useFakeTimers()
    const adapters = createDisplaySafeMixerFakes({
      refreshDelayMs: 1,
      refreshError: "Keyboard stopped responding.",
    })
    const phases: string[] = []
    adapters.device.subscribe((state) => phases.push(state.phase))
    const refresh = adapters.device.refresh()
    const rejection = expect(refresh).rejects.toThrow("Keyboard stopped responding.")
    await vi.runAllTimersAsync()
    await rejection
    expect(phases).toContain("refreshing")
    expect(adapters.device.getState()).toMatchObject({
      phase: "error",
      message: "Keyboard stopped responding.",
    })
    vi.useRealTimers()
  })
})
