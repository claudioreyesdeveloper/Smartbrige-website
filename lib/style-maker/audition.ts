/**
 * Style Maker audition helpers — clip preview on live Tyros channels and
 * section Preview Major/Minor (C / Am), matching desktop BassDrumLibraryPanel
 * + StyleMakerAudition defaults without hardcoding channel choice in the UI.
 */

import {
  extractStyleSectionPreviewEvents,
  parseYamahaStyle,
  type MidiNote,
  type MidiPreviewEvent,
  type ParsedYamahaStyle,
  type StyleSectionRange,
} from "@/lib/demo/style-midi"
import { yamahaTemplateSectionName } from "@/lib/style-maker/section-names"
import {
  applyBassVelocityDeltas,
  BASS_REFERENCE_PROFILE_INDEX,
  remapBassVelocityForTarget,
} from "@/lib/style-maker/bass-velocity-remap"
import {
  remapDrumNoteForMode,
  remapDrumVelocityForMode,
  type DrumMappingMode,
} from "@/lib/style-maker/library-panel"
import {
  sectionIsIntroOrEnding,
  StyleMakerLane,
  styleChannel,
} from "@/lib/style-maker/lanes"
import {
  donorMinorSourceChannelsForLane,
  minorSourceChannelsForLane,
  replacementSourceChannelsForLane,
} from "@/lib/style-maker/template"

/** LibraryPhraseService live Tyros audition defaults (1-based). */
export const DEFAULT_AUDITION_CHANNELS = {
  drums: 10,
  bass: 11,
  guitar: 12,
  brass: 13,
} as const

export type AuditionInstrument = keyof typeof DEFAULT_AUDITION_CHANNELS

export type AuditionChannelMap = Record<AuditionInstrument, number>

export function defaultAuditionChannels(): AuditionChannelMap {
  return { ...DEFAULT_AUDITION_CHANNELS }
}

export function clampMidiChannel(channel: number): number {
  return Math.max(1, Math.min(16, Math.round(channel) || 1))
}

export function sectionSupportsMinorPreview(label: string): boolean {
  return sectionIsIntroOrEnding(label)
}

/**
 * StyleMakerEngine::laneSupportsMinorTake — Intro/Ending pitched lanes get a
 * MIN box; Rhythm1/2 only when the donor has a minor CASM source group.
 */
export function laneSupportsMinorTake(
  sectionLabel: string,
  lane: StyleMakerLane,
  yamahaTail: Uint8Array | null | undefined,
): boolean {
  if (!sectionIsIntroOrEnding(sectionLabel)) return false
  if (yamahaTail && yamahaTail.length > 0) {
    const casmName = yamahaTemplateSectionName(sectionLabel)
    // Desktop laneSupportsMinorTake uses minorSourceChannelsForLane (with
    // storedChannel fallback) — non-empty for pitched lanes whenever CASM loads.
    if (minorSourceChannelsForLane(yamahaTail, casmName, lane).length > 0) {
      return true
    }
  }
  return lane !== StyleMakerLane.Rhythm1 && lane !== StyleMakerLane.Rhythm2
}

/** Donor has a minor CASM source group for this lane (MIN “Original (template)”). */
export function laneHasTemplateMinorSource(
  sectionLabel: string,
  lane: StyleMakerLane,
  yamahaTail: Uint8Array | null | undefined,
): boolean {
  if (!yamahaTail?.length) return false
  const casmName = yamahaTemplateSectionName(sectionLabel)
  return donorMinorSourceChannelsForLane(yamahaTail, casmName, lane).length > 0
}

/** Desktop Style Maker Preview Major uses C; Preview Minor uses Am. */
export function auditionChordForPreview(minor: boolean): string {
  return minor ? "Am" : "C"
}

const ALL_LANES: StyleMakerLane[] = [
  StyleMakerLane.Rhythm1,
  StyleMakerLane.Rhythm2,
  StyleMakerLane.Bass,
  StyleMakerLane.Chord1,
  StyleMakerLane.Chord2,
  StyleMakerLane.Pad,
  StyleMakerLane.Phrase1,
  StyleMakerLane.Phrase2,
]

const eventPriority = (event: MidiPreviewEvent) => {
  const kind = event.status & 0xf0
  if (kind === 0xb0 && (event.data[0] === 0 || event.data[0] === 32)) return 0
  if (kind === 0xc0) return 1
  if (kind === 0x80 || (kind === 0x90 && (event.data[1] || 0) === 0)) return 2
  if (kind === 0x90) return 4
  return 3
}

const PRESERVE_CHANNELS = { bumpChannelsBelow9: false } as const

/**
 * Section marker for CASM lookup — prefer the raw Yamaha marker from the style
 * file (range.templateSection). Desktop matches Sdec names case-sensitively
 * after fn: strip only (no display-name rewrite inside the CASM scanner).
 */
function casmSectionName(rangeOrLabel: StyleSectionRange | string): string {
  if (typeof rangeOrLabel === "string") {
    return yamahaTemplateSectionName(rangeOrLabel)
  }
  return (
    rangeOrLabel.templateSection ||
    yamahaTemplateSectionName(rangeOrLabel.label)
  )
}

/** Desktop playLaneVariant channel set (major vs minor original). */
function sourceChannelsForLanePlay(
  yamahaTail: Uint8Array,
  templateSection: string,
  lane: StyleMakerLane,
  minor: boolean,
): number[] {
  if (minor) {
    return donorMinorSourceChannelsForLane(yamahaTail, templateSection, lane)
  }
  return replacementSourceChannelsForLane(yamahaTail, templateSection, lane)
}

/**
 * Desktop renderSectionPreviewToMidi donor fallback channels:
 * minor → minorSourceChannelsForLane (storedChannel fallback), then replacement.
 */
function sourceChannelsForSectionPreview(
  yamahaTail: Uint8Array,
  templateSection: string,
  lane: StyleMakerLane,
  minor: boolean,
): number[] {
  if (minor) {
    const minorChannels = minorSourceChannelsForLane(
      yamahaTail,
      templateSection,
      lane,
    )
    if (minorChannels.length > 0) return minorChannels
  }
  return replacementSourceChannelsForLane(yamahaTail, templateSection, lane)
}

/** Remap MidiNote list onto a live audition channel (1-based). */
export function notesToAuditionEvents(
  notes: MidiNote[],
  outputChannel1Based: number,
): MidiPreviewEvent[] {
  const ch = clampMidiChannel(outputChannel1Based) - 1
  const events: MidiPreviewEvent[] = []
  for (const note of notes) {
    events.push({
      tick: note.tick,
      status: 0x90 | ch,
      data: [note.note & 0x7f, note.velocity & 0x7f],
    })
    events.push({
      tick: note.tick + Math.max(1, note.duration),
      status: 0x80 | ch,
      data: [note.note & 0x7f, 0],
    })
  }
  return events.sort((a, b) => a.tick - b.tick || eventPriority(a) - eventPriority(b))
}

/**
 * Library clip audition: remap channel voice messages onto the chosen live
 * channel (SoloMidiPlayer setOutputChannel). Skip Bank/PC — Style Maker uses
 * suppressAuditionVoiceSetup and keeps the part voice already on the keyboard.
 */
export function extractClipAuditionEvents(
  bytes: Uint8Array,
  outputChannel1Based: number,
): { events: MidiPreviewEvent[]; ticksPerQuarter: number; barCount: number } {
  const parsed = parseYamahaStyle(bytes)
  const ch = clampMidiChannel(outputChannel1Based) - 1
  const events: MidiPreviewEvent[] = []

  parsed.tracks.forEach((track) => {
    track.events.forEach((event) => {
      const kind = event.status & 0xf0
      if (kind < 0x80 || kind > 0xe0) return
      // Match desktop stripVoiceSelectionMessages for Style Maker previews.
      if (kind === 0xc0) return
      if (kind === 0xb0 && (event.data[0] === 0 || event.data[0] === 32)) return
      events.push({
        tick: event.tick,
        status: kind | ch,
        data: [...event.data],
      })
    })
  })

  if (!events.length) {
    throw new Error("This clip contains no playable MIDI to audition.")
  }

  const firstTick = Math.min(...events.map((event) => event.tick))
  events.forEach((event) => {
    event.tick -= firstTick
  })
  events.sort((a, b) => a.tick - b.tick || eventPriority(a) - eventPriority(b))

  const lastTick = Math.max(...events.map((event) => event.tick))
  const barTicks = parsed.ticksPerQuarter * 4
  const barCount = Math.max(1, Math.ceil((lastTick + 1) / barTicks))

  return {
    events,
    ticksPerQuarter: parsed.ticksPerQuarter,
    barCount,
  }
}

/**
 * LibraryPhraseService::extractAndRemapDrumNotesOnly note/velocity remap
 * on preview events (note on and note off).
 */
export function applyDrumMappingToEvents(
  events: MidiPreviewEvent[],
  mode: DrumMappingMode,
): MidiPreviewEvent[] {
  if (mode === "gm") return events
  return events.map((event) => {
    const kind = event.status & 0xf0
    if (kind !== 0x90 && kind !== 0x80) return event
    const data = [...event.data]
    const mappedNote = remapDrumNoteForMode(data[0] || 0, mode)
    data[0] = mappedNote
    if (kind === 0x90 && (data[1] || 0) > 0) {
      data[1] = remapDrumVelocityForMode(mappedNote, data[1], mode)
    }
    return { ...event, data }
  })
}

/**
 * Bass previewCandidate: Time → Vel/Dead band deltas → MegaVoice remap.
 * Order matches LibraryPhraseService (deltas then remapBassVelocitiesForTarget).
 */
export function applyBassAuditionEventTransforms(
  events: MidiPreviewEvent[],
  options: {
    timeFeelFactor: number
    sustainVelocityDelta: number
    deadVelocityDelta: number
    targetProfileIndex?: number
  },
): MidiPreviewEvent[] {
  const factor = options.timeFeelFactor > 0 ? options.timeFeelFactor : 1
  const profileIndex = options.targetProfileIndex ?? BASS_REFERENCE_PROFILE_INDEX
  const mapped = events.map((event) => {
    const kind = event.status & 0xf0
    const data = [...event.data]
    if (kind === 0x90 && (data[1] || 0) > 0) {
      const note = data[0] || 0
      const afterDelta = applyBassVelocityDeltas(
        data[1],
        options.sustainVelocityDelta,
        options.deadVelocityDelta,
      )
      data[1] = remapBassVelocityForTarget(note, afterDelta, profileIndex)
    }
    return {
      ...event,
      tick: Math.round(event.tick * factor),
      data,
    }
  })
  return mapped.sort(
    (a, b) => a.tick - b.tick || eventPriority(a) - eventPriority(b),
  )
}

function isVoiceSetupEvent(event: MidiPreviewEvent): boolean {
  const kind = event.status & 0xf0
  return (
    kind === 0xc0 ||
    (kind === 0xb0 && (event.data[0] === 0 || event.data[0] === 32))
  )
}

/**
 * Pull section-slice events on the given 1-based source channels.
 * When remapToStylePart is true (section preview / minor lane), force output
 * onto styleChannel(lane) — desktop appendTemplateLanePreviewAsBeats.
 * When false (major lane original), keep source channels and drop ch outside
 * 9–16 — desktop renderTemplateLaneToMidi + stripVoiceSelection.
 */
function previewEventsForSources(
  style: ParsedYamahaStyle,
  range: StyleSectionRange,
  lane: StyleMakerLane,
  sources1: number[],
  remapToStylePart: boolean,
): MidiPreviewEvent[] {
  if (!sources1.length) return []

  let channelFilter = sources1.map((channel) => channel - 1)
  if (!remapToStylePart) {
    // appendTemplateSmfLoopedAsBeats(stripVoiceSelection): skip ch < 9 or > 16.
    channelFilter = channelFilter.filter((ch0) => ch0 >= 8 && ch0 <= 15)
    if (!channelFilter.length) return []
  }

  const dest0 = styleChannel(lane) - 1
  return extractStyleSectionPreviewEvents(
    style,
    range,
    channelFilter,
    PRESERVE_CHANNELS,
  )
    .filter((event) => !isVoiceSetupEvent(event))
    .map((event) => ({
      ...event,
      status: remapToStylePart
        ? (event.status & 0xf0) | dest0
        : event.status,
      data: [...event.data],
      tick: Math.max(0, event.tick - range.startTick),
    }))
}

/**
 * Single lane template audition — desktop playLaneVariant with no assignment.
 * Major keeps donor source channels; minor remaps onto style part 9–16.
 */
export function extractLaneAuditionEvents(
  style: ParsedYamahaStyle,
  range: StyleSectionRange,
  lane: StyleMakerLane,
  minor = false,
): MidiPreviewEvent[] {
  const templateSection = casmSectionName(range)
  const sources1 = sourceChannelsForLanePlay(
    style.yamahaTail,
    templateSection,
    lane,
    minor,
  )
  return previewEventsForSources(
    style,
    range,
    lane,
    sources1,
    /* remapToStylePart */ minor,
  )
}

/**
 * Donor lane material for section Preview Major/Minor — always remaps onto the
 * style part channel (desktop renderSectionPreviewToMidi).
 */
function extractSectionDonorLaneEvents(
  style: ParsedYamahaStyle,
  range: StyleSectionRange,
  lane: StyleMakerLane,
  minor: boolean,
): MidiPreviewEvent[] {
  const templateSection = casmSectionName(range)
  const sources1 = sourceChannelsForSectionPreview(
    style.yamahaTail,
    templateSection,
    lane,
    minor,
  )
  return previewEventsForSources(
    style,
    range,
    lane,
    sources1,
    /* remapToStylePart */ true,
  )
}

/**
 * Donor major/minor take as MidiNotes — StyleMakerEngine template lane preview
 * material for Intro/Ending MAJ/MIN boxes.
 * Minor returns [] when the donor has no minor CASM source group (no maj fallback).
 */
export function extractLaneTemplateNotes(
  style: ParsedYamahaStyle,
  range: StyleSectionRange,
  lane: StyleMakerLane,
  minor = false,
): MidiNote[] {
  if (minor) {
    const casmName = casmSectionName(range)
    if (
      donorMinorSourceChannelsForLane(style.yamahaTail, casmName, lane)
        .length === 0
    ) {
      return []
    }
  }
  // Piano-roll material should sit on the lane's style channel.
  const templateSection = casmSectionName(range)
  const sources1 = sourceChannelsForLanePlay(
    style.yamahaTail,
    templateSection,
    lane,
    minor,
  )
  const events = previewEventsForSources(
    style,
    range,
    lane,
    sources1,
    /* remapToStylePart */ true,
  )
  const open = new Map<number, { tick: number; velocity: number }>()
  const notes: MidiNote[] = []
  for (const event of events) {
    const kind = event.status & 0xf0
    const note = event.data[0] || 0
    const vel = event.data[1] || 0
    if (kind === 0x90 && vel > 0) {
      open.set(note, { tick: event.tick, velocity: vel })
    } else if (kind === 0x80 || (kind === 0x90 && vel === 0)) {
      const on = open.get(note)
      if (!on) continue
      open.delete(note)
      notes.push({
        tick: on.tick,
        duration: Math.max(1, event.tick - on.tick),
        note,
        velocity: on.velocity,
      })
    }
  }
  for (const [note, on] of open) {
    notes.push({
      tick: on.tick,
      duration: Math.max(1, style.ticksPerQuarter),
      note,
      velocity: on.velocity,
    })
  }
  return notes.sort((a, b) => a.tick - b.tick || a.note - b.note)
}

/**
 * Section audition: play each lane from major or minor CASM source channels,
 * remapped onto style parts 9–16 (desktop StyleMakerEngine preview path).
 */
export function extractSectionAuditionEvents(
  style: ParsedYamahaStyle,
  range: StyleSectionRange,
  minor: boolean,
): MidiPreviewEvent[] {
  const byDest = new Map<number, MidiPreviewEvent[]>()

  for (const lane of ALL_LANES) {
    const laneEvents = extractSectionDonorLaneEvents(style, range, lane, minor)
    if (!laneEvents.length) continue
    const dest0 = styleChannel(lane) - 1
    const bucket = byDest.get(dest0) || []
    bucket.push(...laneEvents)
    byDest.set(dest0, bucket)
  }

  const merged = [...byDest.values()].flat()
  if (merged.length > 0) {
    return merged.sort((a, b) => a.tick - b.tick || eventPriority(a) - eventPriority(b))
  }

  // No CASM mapping — play the raw section slice (legacy / incomplete donors).
  return extractStyleSectionPreviewEvents(
    style,
    range,
    undefined,
    PRESERVE_CHANNELS,
  ).map((event) => ({
    ...event,
    tick: Math.max(0, event.tick - range.startTick),
  }))
}

/**
 * Desktop StyleMakerEngine minor/major preview with user takes:
 * minor → minorLanes (drums fall back to major take); major → lanes;
 * empty take → donor CASM sources for that mode.
 */
export function extractSectionAuditionEventsWithTakes(
  style: ParsedYamahaStyle,
  range: StyleSectionRange,
  minor: boolean,
  majorTakes: Partial<Record<StyleMakerLane, MidiNote[]>>,
  minorTakes: Partial<Record<StyleMakerLane, MidiNote[]>>,
): MidiPreviewEvent[] {
  const byDest = new Map<number, MidiPreviewEvent[]>()

  for (const lane of ALL_LANES) {
    const supportsMinor = laneSupportsMinorTake(
      range.label,
      lane,
      style.yamahaTail,
    )
    let takeNotes: MidiNote[] | undefined
    if (minor) {
      takeNotes = minorTakes[lane]
      if (!takeNotes?.length && !supportsMinor) {
        takeNotes = majorTakes[lane]
      }
    } else {
      takeNotes = majorTakes[lane]
    }

    const laneEvents = takeNotes?.length
      ? notesToAuditionEvents(takeNotes, styleChannel(lane))
      : extractSectionDonorLaneEvents(style, range, lane, minor)
    if (!laneEvents.length) continue
    const dest0 = styleChannel(lane) - 1
    const bucket = byDest.get(dest0) || []
    bucket.push(...laneEvents)
    byDest.set(dest0, bucket)
  }

  const merged = [...byDest.values()].flat()
  if (merged.length > 0) {
    return merged.sort(
      (a, b) => a.tick - b.tick || eventPriority(a) - eventPriority(b),
    )
  }
  return extractStyleSectionPreviewEvents(
    style,
    range,
    undefined,
    PRESERVE_CHANNELS,
  ).map((event) => ({
    ...event,
    tick: Math.max(0, event.tick - range.startTick),
  }))
}
