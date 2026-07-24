/**
 * Map donor style Bass / Rhythm voices onto the library Voice + Channel
 * controls (desktop applyMixerDefaultVoices idea, from template snapshots).
 */

import {
  styleChannel,
  StyleMakerLane,
} from "@/lib/style-maker/lanes"
import type {
  PartMixerMap,
  StyleMakerPartMixerSettings,
  TemplatePartSnapshot,
} from "@/lib/style-maker/part-mixer"
import type { VoiceChoice } from "@/lib/style-maker/megavoice-catalog"

export function findVoiceChoiceByBank(
  list: VoiceChoice[],
  msb: number,
  lsb: number,
  programYamaha: number,
): VoiceChoice | undefined {
  return list.find(
    (voice) =>
      voice.msb === msb &&
      voice.lsb === lsb &&
      voice.programYamaha === programYamaha,
  )
}

export function voiceChoiceFromMixerSettings(
  mixer: StyleMakerPartMixerSettings | undefined,
  list: VoiceChoice[],
  fallbackLabel: string,
): VoiceChoice | null {
  if (!mixer?.hasVoice || mixer.voiceProgram < 1) return null
  const found = findVoiceChoiceByBank(
    list,
    mixer.voiceMSB,
    mixer.voiceLSB,
    mixer.voiceProgram,
  )
  if (found) return found
  return {
    id: `style:${mixer.voiceMSB}:${mixer.voiceLSB}:${mixer.voiceProgram}`,
    label: mixer.voiceName?.trim() || fallbackLabel,
    msb: mixer.voiceMSB,
    lsb: mixer.voiceLSB,
    programYamaha: mixer.voiceProgram,
    group: "From style",
  }
}

function mixerForLane(
  lane: StyleMakerLane,
  sectionMixer: PartMixerMap,
  snapshots: Partial<Record<StyleMakerLane, TemplatePartSnapshot>>,
): StyleMakerPartMixerSettings | undefined {
  const override = sectionMixer[lane]
  if (override?.hasVoice) return override
  const snap = snapshots[lane]?.mixer
  if (snap?.hasVoice) return snap
  return undefined
}

export type LibraryStyleDefaults = {
  bassVoice: VoiceChoice | null
  drumVoice: VoiceChoice | null
  bassChannel: number | null
  drumChannel: number | null
}

/**
 * Prefer saved section mixer voices, else donor CASM/MIDI snapshots for the
 * active section. Channels follow Yamaha style parts (Bass=11, Rhythm1=9, …).
 */
export function libraryDefaultsFromStyle(options: {
  snapshots: Partial<Record<StyleMakerLane, TemplatePartSnapshot>>
  sectionMixer: PartMixerMap
  bassChoices: VoiceChoice[]
  drumChoices: VoiceChoice[]
}): LibraryStyleDefaults {
  const { snapshots, sectionMixer, bassChoices, drumChoices } = options

  const bassMixer = mixerForLane(StyleMakerLane.Bass, sectionMixer, snapshots)
  const bassVoice = voiceChoiceFromMixerSettings(
    bassMixer,
    bassChoices,
    "Style bass",
  )

  let drumVoice: VoiceChoice | null = null
  let drumLane: StyleMakerLane | null = null
  for (const lane of [StyleMakerLane.Rhythm1, StyleMakerLane.Rhythm2]) {
    const mixer = mixerForLane(lane, sectionMixer, snapshots)
    const choice = voiceChoiceFromMixerSettings(
      mixer,
      drumChoices,
      "Style drums",
    )
    if (choice) {
      drumVoice = choice
      drumLane = lane
      break
    }
  }

  return {
    bassVoice,
    drumVoice,
    bassChannel: bassVoice ? styleChannel(StyleMakerLane.Bass) : null,
    drumChannel: drumLane != null ? styleChannel(drumLane) : null,
  }
}
