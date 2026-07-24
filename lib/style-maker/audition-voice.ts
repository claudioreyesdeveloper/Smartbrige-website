/**
 * Live audition voice setup — LibraryPhraseService::sendDrumKitProgram /
 * sendBassMegaVoiceProgram / sendGuitarMegaVoiceProgram (Port 2 XG SysEx).
 */

import type { YamahaMidiSession } from "@/lib/demo/yamaha/midi-session"
import type { AuditionInstrument } from "@/lib/style-maker/audition"
import { clampMidiChannel } from "@/lib/style-maker/audition"
import {
  BASS_MEGAVOICE_CHOICES,
  DEFAULT_BASS_VOICE_ID,
  DEFAULT_DRUM_KIT_ID,
  DEFAULT_GUITAR_VOICE_ID,
  DRUM_KIT_CHOICES,
  findVoiceChoice,
  GUITAR_MEGAVOICE_CHOICES,
  type VoiceChoice,
} from "@/lib/style-maker/megavoice-catalog"

export type XgVoice = {
  msb: number
  lsb: number
  /** Yamaha program number 1–128 */
  programYamaha: number
  label: string
}

export type VoiceSelectionMap = Record<AuditionInstrument, string>

export function defaultVoiceSelection(): VoiceSelectionMap {
  return {
    bass: DEFAULT_BASS_VOICE_ID,
    drums: DEFAULT_DRUM_KIT_ID,
    guitar: DEFAULT_GUITAR_VOICE_ID,
    brass: "BrassSection",
  }
}

export function voiceChoicesForInstrument(instrument: AuditionInstrument): VoiceChoice[] {
  switch (instrument) {
    case "bass":
      return BASS_MEGAVOICE_CHOICES
    case "guitar":
      return GUITAR_MEGAVOICE_CHOICES
    case "drums":
      return DRUM_KIT_CHOICES
    case "brass":
      return [
        {
          id: "BrassSection",
          label: "Brass MegaVoice",
          msb: 8,
          lsb: 0,
          programYamaha: 56,
          group: "Brass",
        },
      ]
  }
}

export function resolveVoice(
  instrument: AuditionInstrument,
  voiceId: string,
): VoiceChoice {
  return findVoiceChoice(voiceChoicesForInstrument(instrument), voiceId)
}

/** @deprecated use resolveVoice — kept for tests */
export function defaultVoiceForInstrument(instrument: AuditionInstrument): XgVoice {
  const selection = defaultVoiceSelection()
  return resolveVoice(instrument, selection[instrument])
}

/**
 * LibraryPhraseService::tyrosMultiPartNumberForChannel
 * ch 1–8 → part = ch; ch 9–16 → part = ch − 1
 */
export function xgPartForMidiChannel(channel1Based: number): number {
  const ch = clampMidiChannel(channel1Based)
  if (ch <= 8) return ch
  return ch - 1
}

export function xgVoiceSetupMessages(
  channel1Based: number,
  voice: XgVoice,
): Uint8Array[] {
  const part = xgPartForMidiChannel(channel1Based) & 0x7f
  const msb = voice.msb & 0x7f
  const lsb = voice.lsb & 0x7f
  const pc0 = Math.max(0, Math.min(127, voice.programYamaha - 1))
  return [
    Uint8Array.of(0xf0, 0x43, 0x10, 0x4c, 0x08, part, 0x01, msb, 0xf7),
    Uint8Array.of(0xf0, 0x43, 0x10, 0x4c, 0x08, part, 0x02, lsb, 0xf7),
    Uint8Array.of(0xf0, 0x43, 0x10, 0x4c, 0x08, part, 0x03, pc0, 0xf7),
  ]
}

/** Send MSB / LSB / Program as XG multi-part SysEx on Port 2 (desktop path). */
export function sendXgPartVoice(
  session: YamahaMidiSession,
  channel1Based: number,
  voice: XgVoice,
) {
  xgVoiceSetupMessages(channel1Based, voice).forEach((message) =>
    session.sendPort2(message),
  )
}
