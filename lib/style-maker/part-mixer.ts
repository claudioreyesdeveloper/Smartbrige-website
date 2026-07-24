/**
 * Style Part Mixer — port of StyleMakerPartMixerSettings + appendPartMixerSetup
 * (StyleMakerTypes.h / StyleMakerEngine.cpp) for Yamaha style channels 9–16.
 *
 * Live audition: XG Multi-Part SysEx on Port 2.
 * Export: same SysEx (and CC11 for expression) at the section start tick.
 */

import type { MidiEvent, ParsedYamahaStyle, StyleSectionRange } from "@/lib/demo/style-midi"
import type { YamahaMidiSession } from "@/lib/demo/yamaha/midi-session"
import { xgPartForMidiChannel } from "@/lib/style-maker/audition-voice"
import {
  ALL_STYLE_MAKER_LANES,
  displayName,
  StyleMakerLane,
  styleChannel,
} from "@/lib/style-maker/lanes"
import { sourceChannelsForSectionLane } from "@/lib/style-maker/template"
import { yamahaTemplateSectionName } from "@/lib/style-maker/section-names"

/** StyleMakerTypes.h StyleMakerPartMixerSettings */
export type StyleMakerPartMixerSettings = {
  volume: number
  pan: number
  reverb: number
  chorus: number
  expression: number
  hasVolume: boolean
  hasPan: boolean
  hasReverb: boolean
  hasChorus: boolean
  hasExpression: boolean
  hasVoice: boolean
  voiceMSB: number
  voiceLSB: number
  /** Yamaha UI program 1–128 */
  voiceProgram: number
  voiceName: string
}

export type PartMixerMap = Partial<
  Record<StyleMakerLane, StyleMakerPartMixerSettings>
>

export type TemplatePartSnapshot = {
  lane: StyleMakerLane
  sourceChannels: number[]
  mixer: StyleMakerPartMixerSettings
  hasCasmPart: boolean
}

/** YamahaProtocol::MultiPart offsets */
export const MultiPart = {
  kBankMSB: 0x01,
  kBankLSB: 0x02,
  kProgram: 0x03,
  kVolume: 0x0b,
  kPan: 0x0e,
  kChorusSend: 0x12,
  kReverbSend: 0x13,
} as const

export function defaultPartMixerSettings(): StyleMakerPartMixerSettings {
  return {
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
    hasVoice: false,
    voiceMSB: 0,
    voiceLSB: 0,
    voiceProgram: 1,
    voiceName: "",
  }
}

export function laneForStyleChannel(channel1Based: number): StyleMakerLane | null {
  if (channel1Based < 9 || channel1Based > 16) return null
  return (channel1Based - 9) as StyleMakerLane
}

export function partMixerHasAny(map: PartMixerMap | undefined | null): boolean {
  if (!map) return false
  return Object.values(map).some(
    (s) =>
      s &&
      (s.hasVoice ||
        s.hasVolume ||
        s.hasPan ||
        s.hasReverb ||
        s.hasChorus ||
        s.hasExpression),
  )
}

function clamp7(value: number): number {
  return Math.max(0, Math.min(127, Math.round(value)))
}

function writeVlq(value: number): number[] {
  let buffer = Math.max(0, Math.floor(value)) & 0x7f
  const bytes: number[] = []
  let v = Math.max(0, Math.floor(value))
  while ((v >>= 7)) {
    buffer <<= 8
    buffer |= (v & 0x7f) | 0x80
  }
  for (;;) {
    bytes.push(buffer & 0xff)
    if (buffer & 0x80) buffer >>= 8
    else break
  }
  return bytes
}

/** F0 43 10 4C 08 part param value F7 */
export function multiPartParamMessage(
  xgPart: number,
  paramOffset: number,
  value: number,
): Uint8Array {
  return Uint8Array.of(
    0xf0,
    0x43,
    0x10,
    0x4c,
    0x08,
    xgPart & 0x7f,
    paramOffset & 0x7f,
    value & 0x7f,
    0xf7,
  )
}

export function multiPartMessagesForLane(
  lane: StyleMakerLane,
  settings: StyleMakerPartMixerSettings,
): Uint8Array[] {
  const channel = styleChannel(lane)
  const part = xgPartForMidiChannel(channel) & 0x7f
  const out: Uint8Array[] = []
  const cleanVoiceSlate = settings.hasVoice

  if (settings.hasVoice) {
    const pc0 = Math.max(0, Math.min(127, settings.voiceProgram - 1))
    out.push(multiPartParamMessage(part, MultiPart.kBankMSB, clamp7(settings.voiceMSB)))
    out.push(multiPartParamMessage(part, MultiPart.kBankLSB, clamp7(settings.voiceLSB)))
    out.push(multiPartParamMessage(part, MultiPart.kProgram, pc0))
  }

  if (settings.hasVolume || cleanVoiceSlate) {
    out.push(multiPartParamMessage(part, MultiPart.kVolume, clamp7(settings.volume)))
  }
  if (settings.hasPan || cleanVoiceSlate) {
    out.push(multiPartParamMessage(part, MultiPart.kPan, clamp7(settings.pan)))
  }
  if (settings.hasReverb || cleanVoiceSlate) {
    out.push(
      multiPartParamMessage(part, MultiPart.kReverbSend, clamp7(settings.reverb)),
    )
  }
  if (settings.hasChorus || cleanVoiceSlate) {
    out.push(
      multiPartParamMessage(part, MultiPart.kChorusSend, clamp7(settings.chorus)),
    )
  }

  return out
}

/** Expression stays CC11 on the style channel (appendPartMixerSetup). */
export function expressionCcMessage(
  lane: StyleMakerLane,
  expression: number,
): Uint8Array {
  const ch = (styleChannel(lane) - 1) & 0x0f
  return Uint8Array.of(0xb0 | ch, 11, clamp7(expression))
}

function sysexToMidiEvent(
  tick: number,
  order: number,
  message: Uint8Array,
): MidiEvent {
  const inner = Array.from(message.slice(1))
  return {
    tick,
    order,
    status: 0xf0,
    data: [...writeVlq(inner.length), ...inner],
  }
}

function ccToMidiEvent(
  tick: number,
  order: number,
  channel1Based: number,
  cc: number,
  value: number,
): MidiEvent {
  return {
    tick,
    order,
    status: 0xb0 | ((channel1Based - 1) & 0x0f),
    data: [cc & 0x7f, clamp7(value)],
  }
}

/**
 * StyleMakerEngine::appendPartMixerSetup — SysEx at section start beat/tick.
 * Returns events to insert; caller assigns order.
 */
export function partMixerSetupEvents(
  partMixer: PartMixerMap,
  tick: number,
  startingOrder: number,
): MidiEvent[] {
  const events: MidiEvent[] = []
  let order = startingOrder
  for (const lane of ALL_STYLE_MAKER_LANES) {
    const settings = partMixer[lane]
    if (!settings) continue

    for (const msg of multiPartMessagesForLane(lane, settings)) {
      events.push(sysexToMidiEvent(tick, order++, msg))
    }

    const cleanVoiceSlate = settings.hasVoice
    if (settings.hasExpression || cleanVoiceSlate) {
      events.push(
        ccToMidiEvent(
          tick,
          order++,
          styleChannel(lane),
          11,
          settings.expression,
        ),
      )
    }
  }
  return events
}

/** Push resolved section mixer to Genos Port 2 (live Audition Lab path). */
export function applyPartMixerToHardware(
  session: YamahaMidiSession,
  partMixer: PartMixerMap,
  templateSnapshots?: Partial<Record<StyleMakerLane, TemplatePartSnapshot>>,
) {
  for (const lane of ALL_STYLE_MAKER_LANES) {
    const merged = mergeLaneMixer(templateSnapshots?.[lane]?.mixer, partMixer[lane])
    if (!merged) continue

    for (const msg of multiPartMessagesForLane(lane, merged)) {
      session.sendPort2(msg)
    }
    if (merged.hasExpression || merged.hasVoice) {
      session.sendPort2(expressionCcMessage(lane, merged.expression))
    }
  }
}

/** Field-wise merge: override wins only where has* is set (desktop mergeMixer). */
export function mergeLaneMixer(
  base: StyleMakerPartMixerSettings | undefined,
  override: StyleMakerPartMixerSettings | undefined,
): StyleMakerPartMixerSettings | null {
  if (!base && !override) return null
  const out = defaultPartMixerSettings()
  const apply = (m: StyleMakerPartMixerSettings) => {
    if (m.hasVoice) {
      out.hasVoice = true
      out.voiceMSB = m.voiceMSB
      out.voiceLSB = m.voiceLSB
      out.voiceProgram = m.voiceProgram
      out.voiceName = m.voiceName
    }
    if (m.hasVolume) {
      out.hasVolume = true
      out.volume = m.volume
    }
    if (m.hasPan) {
      out.hasPan = true
      out.pan = m.pan
    }
    if (m.hasReverb) {
      out.hasReverb = true
      out.reverb = m.reverb
    }
    if (m.hasChorus) {
      out.hasChorus = true
      out.chorus = m.chorus
    }
    if (m.hasExpression) {
      out.hasExpression = true
      out.expression = m.expression
    }
  }
  if (base) apply(base)
  if (override) apply(override)
  const any =
    out.hasVoice ||
    out.hasVolume ||
    out.hasPan ||
    out.hasReverb ||
    out.hasChorus ||
    out.hasExpression
  return any ? out : null
}

export type ResolvedVoiceLabel = {
  name: string
  category?: string | null
  subCategory?: string | null
}

/** Name · Category[/Sub] from keyboard_voices (no MSB/LSB/PC in the UI). */
export function formatVoiceNameAndCategory(
  name: string,
  category?: string | null,
  subCategory?: string | null,
): string {
  const trimmed = name.trim() || "Voice"
  const catParts = [category?.trim(), subCategory?.trim()].filter(Boolean)
  return catParts.length ? `${trimmed} · ${catParts.join(" / ")}` : trimmed
}

export function voiceLookupKey(
  msb: number,
  lsb: number,
  programYamaha: number,
): string {
  return `${msb}:${lsb}:${programYamaha}`
}

/** Display values for a mixer row (working override → template → defaults). */
export function displayMixerForLane(
  working: StyleMakerPartMixerSettings | undefined,
  original: StyleMakerPartMixerSettings | undefined,
  resolved?: {
    working?: ResolvedVoiceLabel | null
    original?: ResolvedVoiceLabel | null
  },
): {
  volume: number
  pan: number
  reverb: number
  chorus: number
  voiceLabel: string
} {
  const volume =
    working?.hasVolume
      ? working.volume
      : original?.hasVolume
        ? original.volume
        : original
          ? 100
          : 100
  const pan =
    working?.hasPan ? working.pan : original?.hasPan ? original.pan : original ? 64 : 64
  const reverb =
    working?.hasReverb
      ? working.reverb
      : original?.hasReverb
        ? original.reverb
        : 0
  const chorus =
    working?.hasChorus
      ? working.chorus
      : original?.hasChorus
        ? original.chorus
        : 0

  let voiceLabel = "Voice: current keyboard voice"
  if (working?.hasVoice) {
    const name =
      resolved?.working?.name ||
      working.voiceName ||
      "Voice"
    voiceLabel = formatVoiceNameAndCategory(
      name,
      resolved?.working?.category,
      resolved?.working?.subCategory,
    )
  } else if (original?.hasVoice) {
    const name =
      resolved?.original?.name ||
      (original.voiceName && original.voiceName !== "Original voice"
        ? original.voiceName
        : "Original voice")
    voiceLabel = `Original: ${formatVoiceNameAndCategory(
      name,
      resolved?.original?.category,
      resolved?.original?.subCategory,
    )}`
  } else if (original) {
    voiceLabel = "Original: no voice event for this part"
  }

  return { volume, pan, reverb, chorus, voiceLabel }
}

export function laneRowTitle(lane: StyleMakerLane): string {
  return `${displayName(lane)}  ch ${styleChannel(lane)}`
}

/**
 * StyleTemplateService::sectionPartSnapshots — read bank/PC + mixer CCs from the
 * donor MIDI around the section marker (through marker + 24 ticks).
 */
export function extractSectionPartSnapshots(
  style: ParsedYamahaStyle,
  section: StyleSectionRange,
): Partial<Record<StyleMakerLane, TemplatePartSnapshot>> {
  const marker =
    section.templateSection || yamahaTemplateSectionName(section.label)
  const sectionStart = Math.max(0, section.startTick)
  const setupReadEndTick = sectionStart + 24

  const channelState = new Map<number, StyleMakerPartMixerSettings>()

  for (const track of style.tracks) {
    for (const event of track.events) {
      if (event.tick > setupReadEndTick) continue
      const kind = event.status & 0xf0
      const ch = (event.status & 0x0f) + 1
      if (ch < 1 || ch > 16) continue

      let state = channelState.get(ch)
      if (!state) {
        state = defaultPartMixerSettings()
        channelState.set(ch, state)
      }

      if (kind === 0xb0 && event.data.length >= 2) {
        const cc = event.data[0]
        const value = event.data[1]
        if (cc === 0) state.voiceMSB = value
        else if (cc === 32) state.voiceLSB = value
        else if (cc === 7) {
          state.volume = value
          state.hasVolume = true
        } else if (cc === 10) {
          state.pan = value
          state.hasPan = true
        } else if (cc === 11) {
          state.expression = value
          state.hasExpression = true
        } else if (cc === 91) {
          state.reverb = value
          state.hasReverb = true
        } else if (cc === 93) {
          state.chorus = value
          state.hasChorus = true
        }
      } else if (kind === 0xc0 && event.data.length >= 1) {
        state.voiceProgram = (event.data[0] & 0x7f) + 1
        state.hasVoice = true
        if (!state.voiceName) state.voiceName = "Original voice"
      }
    }
  }

  const out: Partial<Record<StyleMakerLane, TemplatePartSnapshot>> = {}
  for (const lane of ALL_STYLE_MAKER_LANES) {
    const channels = sourceChannelsForSectionLane(
      style.yamahaTail,
      marker,
      lane,
    )
    if (!channels.length) continue
    const snapshot: TemplatePartSnapshot = {
      lane,
      sourceChannels: channels,
      mixer: defaultPartMixerSettings(),
      hasCasmPart: true,
    }
    for (const ch of channels) {
      const state = channelState.get(ch)
      if (state) {
        snapshot.mixer = { ...state }
        break
      }
    }
    out[lane] = snapshot
  }
  return out
}

export function clonePartMixerMap(map: PartMixerMap): PartMixerMap {
  const out: PartMixerMap = {}
  for (const lane of ALL_STYLE_MAKER_LANES) {
    const s = map[lane]
    if (s) out[lane] = { ...s }
  }
  return out
}

/** Desktop AuditionTab::ensureWorkingMixer */
export function ensureWorkingMixer(
  working: Record<string, PartMixerMap>,
  saved: Record<string, PartMixerMap>,
  sectionName: string,
): Record<string, PartMixerMap> {
  if (!sectionName || working[sectionName]) return working
  return {
    ...working,
    [sectionName]: clonePartMixerMap(saved[sectionName] || {}),
  }
}

export function upsertWorkingLane(
  map: PartMixerMap,
  lane: StyleMakerLane,
  patch: Partial<StyleMakerPartMixerSettings>,
): PartMixerMap {
  const current = map[lane] || defaultPartMixerSettings()
  return {
    ...map,
    [lane]: { ...current, ...patch },
  }
}

/**
 * Desktop AuditionTab::writeVoiceToAllSections — writes one lane voice into
 * every section's working mixer and marks each section dirty. Export reads
 * these via StyleSectionRecipe::partMixer → appendPartMixerSetup.
 */
export function writeVoiceToAllSections(
  working: Record<string, PartMixerMap>,
  saved: Record<string, PartMixerMap>,
  sectionNames: string[],
  lane: StyleMakerLane,
  voice: {
    msb: number
    lsb: number
    programYamaha: number
    name: string
  },
): { working: Record<string, PartMixerMap>; dirtySectionNames: string[] } {
  let next = working
  const dirtySectionNames: string[] = []
  const patch: Partial<StyleMakerPartMixerSettings> = {
    hasVoice: true,
    voiceMSB: voice.msb,
    voiceLSB: voice.lsb,
    voiceProgram: voice.programYamaha,
    voiceName: voice.name,
  }
  for (const sectionName of sectionNames) {
    if (!sectionName) continue
    next = ensureWorkingMixer(next, saved, sectionName)
    next = {
      ...next,
      [sectionName]: upsertWorkingLane(next[sectionName] || {}, lane, patch),
    }
    dirtySectionNames.push(sectionName)
  }
  return { working: next, dirtySectionNames }
}

/**
 * Desktop AuditionTab::copyCurrentSectionVoicesToAllSections — one-shot copy
 * of voices already set on the current section to the same lanes in every
 * section (including current). Returns how many source lanes had a voice.
 */
export function copyCurrentSectionVoicesToAllSections(
  working: Record<string, PartMixerMap>,
  saved: Record<string, PartMixerMap>,
  sectionNames: string[],
  currentSectionName: string,
): {
  working: Record<string, PartMixerMap>
  dirtySectionNames: string[]
  copiedVoiceCount: number
} {
  if (!currentSectionName) {
    return { working, dirtySectionNames: [], copiedVoiceCount: 0 }
  }
  let next = ensureWorkingMixer(working, saved, currentSectionName)
  const currentVoices = clonePartMixerMap(next[currentSectionName] || {})
  const dirty = new Set<string>()
  let copiedVoiceCount = 0

  for (const lane of ALL_STYLE_MAKER_LANES) {
    const settings = currentVoices[lane]
    if (!settings?.hasVoice) continue
    copiedVoiceCount += 1
    const result = writeVoiceToAllSections(next, saved, sectionNames, lane, {
      msb: settings.voiceMSB,
      lsb: settings.voiceLSB,
      programYamaha: settings.voiceProgram,
      name: settings.voiceName,
    })
    next = result.working
    for (const name of result.dirtySectionNames) dirty.add(name)
  }

  return {
    working: next,
    dirtySectionNames: [...dirty],
    copiedVoiceCount,
  }
}

/**
 * Desktop AuditionTab::saveCurrentSectionMix — commit working mixer into the
 * saved StyleSectionRecipe::partMixer for this section and clear dirty.
 */
export function saveCurrentSectionMix(
  working: Record<string, PartMixerMap>,
  saved: Record<string, PartMixerMap>,
  sectionName: string,
): {
  working: Record<string, PartMixerMap>
  saved: Record<string, PartMixerMap>
  mixer: PartMixerMap
} | null {
  if (!sectionName) return null
  const nextWorking = ensureWorkingMixer(working, saved, sectionName)
  const mixer = clonePartMixerMap(nextWorking[sectionName] || {})
  return {
    working: nextWorking,
    saved: {
      ...saved,
      [sectionName]: mixer,
    },
    mixer,
  }
}

/**
 * Desktop AuditionTab section-box onChange: ensure working mixer for the
 * selected section, then the UI refreshRows path reads working + template.
 */
export function selectSectionMixer(
  working: Record<string, PartMixerMap>,
  saved: Record<string, PartMixerMap>,
  sectionName: string,
): { working: Record<string, PartMixerMap>; mixer: PartMixerMap } {
  const nextWorking = ensureWorkingMixer(working, saved, sectionName)
  return {
    working: nextWorking,
    mixer: nextWorking[sectionName] || {},
  }
}
