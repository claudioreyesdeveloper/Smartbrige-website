import { describe, expect, it } from "vitest"
import {
  copyCurrentSectionVoicesToAllSections,
  displayMixerForLane,
  formatVoiceNameAndCategory,
  MultiPart,
  multiPartMessagesForLane,
  multiPartParamMessage,
  partMixerHasAny,
  partMixerSetupEvents,
  saveCurrentSectionMix,
  type PartMixerMap,
  type StyleMakerPartMixerSettings,
} from "@/lib/style-maker/part-mixer"
import { findLocalVoiceByMsbLsbPrg } from "@/lib/style-maker/local-voices"
import { StyleMakerLane } from "@/lib/style-maker/lanes"
import { xgPartForMidiChannel } from "@/lib/style-maker/audition-voice"

describe("Style Part Mixer (desktop appendPartMixerSetup)", () => {
  it("maps style channels 9–16 to XG parts 8–15", () => {
    expect(xgPartForMidiChannel(9)).toBe(8)
    expect(xgPartForMidiChannel(16)).toBe(15)
  })

  it("builds Multi-Part SysEx F0 43 10 4C 08 part param value F7", () => {
    const msg = multiPartParamMessage(0x08, MultiPart.kVolume, 100)
    expect(Array.from(msg)).toEqual([
      0xf0, 0x43, 0x10, 0x4c, 0x08, 0x08, 0x0b, 100, 0xf7,
    ])
  })

  it("sends voice before mixer params (clean voice slate)", () => {
    const settings: StyleMakerPartMixerSettings = {
      volume: 40,
      pan: 64,
      reverb: 20,
      chorus: 0,
      expression: 127,
      hasVolume: true,
      hasPan: true,
      hasReverb: true,
      hasChorus: false,
      hasExpression: false,
      hasVoice: true,
      voiceMSB: 8,
      voiceLSB: 0,
      voiceProgram: 18,
      voiceName: "ElectricBass",
    }
    const messages = multiPartMessagesForLane(StyleMakerLane.Bass, settings)
    // Voice + cleanVoiceSlate vol/pan/rev/cho (desktop appendPartMixerSetup)
    expect(messages).toHaveLength(7)
    expect(messages[0][6]).toBe(MultiPart.kBankMSB)
    expect(messages[1][6]).toBe(MultiPart.kBankLSB)
    expect(messages[2][6]).toBe(MultiPart.kProgram)
    expect(messages[2][7]).toBe(17) // programYamaha 18 → pc0
    expect(messages[3][6]).toBe(MultiPart.kVolume)
    expect(messages[6][6]).toBe(MultiPart.kChorusSend)
  })

  it("embeds mixer SysEx events at the section start tick", () => {
    const events = partMixerSetupEvents(
      {
        [StyleMakerLane.Rhythm1]: {
          volume: 37,
          pan: 64,
          reverb: 20,
          chorus: 0,
          expression: 127,
          hasVolume: true,
          hasPan: true,
          hasReverb: true,
          hasChorus: true,
          hasExpression: false,
          hasVoice: false,
          voiceMSB: 0,
          voiceLSB: 0,
          voiceProgram: 1,
          voiceName: "",
        },
      },
      1920,
      10,
    )
    expect(events.length).toBe(4)
    expect(events.every((e) => e.tick === 1920)).toBe(true)
    expect(events[0].status).toBe(0xf0)
    expect(events[0].order).toBe(10)
  })

  it("detects whether a partMixer map has overrides", () => {
    expect(partMixerHasAny({})).toBe(false)
    expect(
      partMixerHasAny({
        [StyleMakerLane.Pad]: {
          volume: 24,
          pan: 64,
          reverb: 127,
          chorus: 60,
          expression: 127,
          hasVolume: true,
          hasPan: false,
          hasReverb: true,
          hasChorus: true,
          hasExpression: false,
          hasVoice: false,
          voiceMSB: 0,
          voiceLSB: 0,
          voiceProgram: 1,
          voiceName: "",
        },
      }),
    ).toBe(true)
  })

  it("copies current-section voices to every section (desktop writeVoiceToAllSections)", () => {
    const mainA: PartMixerMap = {
      [StyleMakerLane.Bass]: {
        volume: 100,
        pan: 64,
        reverb: 0,
        chorus: 0,
        expression: 127,
        hasVolume: false,
        hasPan: false,
        hasReverb: false,
        hasChorus: false,
        hasExpression: false,
        hasVoice: true,
        voiceMSB: 8,
        voiceLSB: 0,
        voiceProgram: 18,
        voiceName: "ElectricBass",
      },
    }
    const result = copyCurrentSectionVoicesToAllSections(
      { "Main A": mainA },
      {},
      ["Main A", "Main B", "Fill A"],
      "Main A",
    )
    expect(result.copiedVoiceCount).toBe(1)
    expect(result.dirtySectionNames.sort()).toEqual([
      "Fill A",
      "Main A",
      "Main B",
    ])
    expect(result.working["Main B"]?.[StyleMakerLane.Bass]?.hasVoice).toBe(true)
    expect(result.working["Main B"]?.[StyleMakerLane.Bass]?.voiceProgram).toBe(18)
    expect(result.working["Fill A"]?.[StyleMakerLane.Bass]?.voiceName).toBe(
      "ElectricBass",
    )
  })

  it("formats mixer voice as name · category (no MSB/LSB/PC)", () => {
    expect(formatVoiceNameAndCategory("ElectricBass", "Bass")).toBe(
      "ElectricBass · Bass",
    )
    expect(formatVoiceNameAndCategory("Power Kit", "DrumKit")).toBe(
      "Power Kit · DrumKit",
    )
    const label = displayMixerForLane(
      undefined,
      {
        volume: 100,
        pan: 64,
        reverb: 0,
        chorus: 0,
        expression: 127,
        hasVolume: true,
        hasPan: true,
        hasReverb: false,
        hasChorus: false,
        hasExpression: false,
        hasVoice: true,
        voiceMSB: 127,
        voiceLSB: 0,
        voiceProgram: 48,
        voiceName: "Original voice",
      },
      {
        original: { name: "Power Kit", category: "DrumKit" },
      },
    ).voiceLabel
    expect(label).toBe("Original: Power Kit · DrumKit")
    expect(label).not.toMatch(/MSB|LSB|PC/)
  })

  it("looks up voices from keyboard_voices by MSB/LSB/PRG", () => {
    const voice = findLocalVoiceByMsbLsbPrg(127, 0, 1)
    // Active Genos2 model — Standard Kit 1 is usually present; skip if DB missing.
    if (!voice) return
    expect(voice.name.length).toBeGreaterThan(0)
    expect(voice.category || voice.subCategory).toBeTruthy()
  })

  it("saveCurrentSectionMix commits working into saved partMixer", () => {
    const working: Record<string, PartMixerMap> = {
      "Main A": {
        [StyleMakerLane.Pad]: {
          volume: 31,
          pan: 64,
          reverb: 127,
          chorus: 40,
          expression: 127,
          hasVolume: true,
          hasPan: true,
          hasReverb: true,
          hasChorus: true,
          hasExpression: false,
          hasVoice: false,
          voiceMSB: 0,
          voiceLSB: 0,
          voiceProgram: 1,
          voiceName: "",
        },
      },
    }
    const result = saveCurrentSectionMix(working, {}, "Main A")
    expect(result).not.toBeNull()
    expect(result!.saved["Main A"]?.[StyleMakerLane.Pad]?.volume).toBe(31)
    expect(result!.saved["Main A"]?.[StyleMakerLane.Pad]?.hasReverb).toBe(true)
  })
})
