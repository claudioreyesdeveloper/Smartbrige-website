import { describe, expect, it } from "vitest"
import {
  findVoiceChoiceByBank,
  libraryDefaultsFromStyle,
  voiceChoiceFromMixerSettings,
} from "@/lib/style-maker/library-style-defaults"
import { StyleMakerLane } from "@/lib/style-maker/lanes"
import type {
  PartMixerMap,
  TemplatePartSnapshot,
} from "@/lib/style-maker/part-mixer"
import {
  BASS_MEGAVOICE_CHOICES,
  DRUM_KIT_CHOICES,
} from "@/lib/style-maker/megavoice-catalog"
import { defaultPartMixerSettings } from "@/lib/style-maker/part-mixer"

describe("libraryDefaultsFromStyle", () => {
  it("matches style bass and drums by bank/program", () => {
    const snapshots: Partial<Record<StyleMakerLane, TemplatePartSnapshot>> = {
      [StyleMakerLane.Bass]: {
        lane: StyleMakerLane.Bass,
        sourceChannels: [11],
        hasCasmPart: true,
        mixer: {
          ...defaultPartMixerSettings(),
          hasVoice: true,
          voiceMSB: 8,
          voiceLSB: 0,
          voiceProgram: 18,
          voiceName: "ElectricBass",
        },
      },
      [StyleMakerLane.Rhythm1]: {
        lane: StyleMakerLane.Rhythm1,
        sourceChannels: [9],
        hasCasmPart: true,
        mixer: {
          ...defaultPartMixerSettings(),
          hasVoice: true,
          voiceMSB: 127,
          voiceLSB: 0,
          voiceProgram: 1,
          voiceName: "StandardKit",
        },
      },
    }

    const defaults = libraryDefaultsFromStyle({
      snapshots,
      sectionMixer: {},
      bassChoices: BASS_MEGAVOICE_CHOICES,
      drumChoices: DRUM_KIT_CHOICES,
    })

    expect(defaults.bassVoice?.id).toBe("ElectricBass")
    expect(defaults.drumVoice?.id).toBe("StandardKit")
    expect(defaults.bassChannel).toBe(11)
    expect(defaults.drumChannel).toBe(9)
  })

  it("prefers section mixer overrides over snapshots", () => {
    const snapshots: Partial<Record<StyleMakerLane, TemplatePartSnapshot>> = {
      [StyleMakerLane.Bass]: {
        lane: StyleMakerLane.Bass,
        sourceChannels: [11],
        hasCasmPart: true,
        mixer: {
          ...defaultPartMixerSettings(),
          hasVoice: true,
          voiceMSB: 8,
          voiceLSB: 0,
          voiceProgram: 18,
          voiceName: "ElectricBass",
        },
      },
    }
    const sectionMixer: PartMixerMap = {
      [StyleMakerLane.Bass]: {
        ...defaultPartMixerSettings(),
        hasVoice: true,
        voiceMSB: 8,
        voiceLSB: 0,
        voiceProgram: 17,
        voiceName: "AcousticBass",
      },
    }

    const defaults = libraryDefaultsFromStyle({
      snapshots,
      sectionMixer,
      bassChoices: BASS_MEGAVOICE_CHOICES,
      drumChoices: DRUM_KIT_CHOICES,
    })

    expect(defaults.bassVoice?.id).toBe("AcousticBass")
  })

  it("builds a From style choice when bank is unknown", () => {
    const choice = voiceChoiceFromMixerSettings(
      {
        ...defaultPartMixerSettings(),
        hasVoice: true,
        voiceMSB: 8,
        voiceLSB: 99,
        voiceProgram: 40,
        voiceName: "MysteryBass",
      },
      BASS_MEGAVOICE_CHOICES,
      "Style bass",
    )
    expect(choice?.id).toBe("style:8:99:40")
    expect(choice?.group).toBe("From style")
    expect(findVoiceChoiceByBank(BASS_MEGAVOICE_CHOICES, 8, 0, 18)?.id).toBe(
      "ElectricBass",
    )
  })
})
