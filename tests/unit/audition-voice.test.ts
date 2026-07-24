import { describe, expect, it } from "vitest"
import {
  defaultVoiceForInstrument,
  defaultVoiceSelection,
  resolveVoice,
  voiceChoicesForInstrument,
  xgPartForMidiChannel,
} from "@/lib/style-maker/audition-voice"
import {
  BASS_MEGAVOICE_CHOICES,
  GUITAR_MEGAVOICE_CHOICES,
  DRUM_KIT_CHOICES,
} from "@/lib/style-maker/megavoice-catalog"

describe("audition voice setup", () => {
  it("maps MIDI channels to XG multi-part numbers like desktop", () => {
    expect(xgPartForMidiChannel(10)).toBe(9)
    expect(xgPartForMidiChannel(11)).toBe(10)
    expect(xgPartForMidiChannel(12)).toBe(11)
    expect(xgPartForMidiChannel(1)).toBe(1)
  })

  it("defaults to ElectricBass / SolidGuitar1 / Standard Kit", () => {
    const defaults = defaultVoiceSelection()
    expect(defaults.bass).toBe("ElectricBass")
    expect(defaults.guitar).toBe("SolidGuitar1")
    expect(defaults.drums).toBe("StandardKit")
    expect(defaultVoiceForInstrument("bass").programYamaha).toBe(18)
    expect(defaultVoiceForInstrument("guitar")).toMatchObject({
      msb: 8,
      lsb: 1,
      programYamaha: 4,
    })
  })

  it("exposes MegaVoice bass, acoustic/electric guitar, and drum kits", () => {
    expect(BASS_MEGAVOICE_CHOICES.length).toBeGreaterThan(20)
    expect(GUITAR_MEGAVOICE_CHOICES.some((v) => v.group === "Acoustic")).toBe(true)
    expect(GUITAR_MEGAVOICE_CHOICES.some((v) => v.group === "Electric")).toBe(true)
    expect(DRUM_KIT_CHOICES.length).toBe(80)
    expect(DRUM_KIT_CHOICES.some((v) => v.id === "StandardKit")).toBe(true)
    expect(voiceChoicesForInstrument("bass")[0].id).toBeTruthy()
    expect(resolveVoice("guitar", "NylonGuitar").group).toBe("Acoustic")
  })
})
