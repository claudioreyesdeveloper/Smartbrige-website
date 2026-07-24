/**
 * Lane replacement for Style Maker product.
 *
 * Matches desktop StyleMakerEngine::renderProjectToMidi:
 * - Assignments are applied per section (each section has its own tick range)
 * - Donor performance on CASM source channels is stripped in that range
 * - Replacement notes are written onto those same source channels
 * - Pattern (Main/Fill) CASM Ctabs generated when destinations are missing
 */

import {
  notesToEvents,
  serializeTrack,
  type MidiEvent,
  type MidiNote,
  type ParsedYamahaStyle,
  type StyleSectionRange,
} from "@/lib/demo/style-midi"
import {
  sectionIsIntroOrEnding,
  storedChannel,
  StyleMakerGuitarCasmMode,
  StyleMakerLane,
  type ProductLane,
  styleMakerLaneForProduct,
} from "./lanes"
import { applyPatternSectionCasmForAssignedLanes } from "./native-export"
import {
  partMixerHasAny,
  partMixerSetupEvents,
  type PartMixerMap,
} from "./part-mixer"
import { sectionTargetTicks } from "./section-bars"
import {
  majorSourceChannelsForLane,
  minorSourceChannelsForLane,
  replacementSourceChannelsForLane,
} from "./template"

const readU32 = (data: Uint8Array, offset: number) =>
  data[offset] * 0x1000000 +
  (data[offset + 1] << 16) +
  (data[offset + 2] << 8) +
  data[offset + 3]

const writeU32 = (value: number) => [
  (value >>> 24) & 0xff,
  (value >>> 16) & 0xff,
  (value >>> 8) & 0xff,
  value & 0xff,
]

export type LaneReplacement = {
  notes: MidiNote[]
  cycleTicks: number
  sourceKind: string
  guitarCasmMode?: StyleMakerGuitarCasmMode
  /** Frozen / imported Yamaha Guitar-source take — required for Yamaha source CASM modes. */
  frozen?: boolean
}

export type StyleSectionLaneReplacements = {
  range: StyleSectionRange
  sectionLabel: string
  /**
   * StyleSectionRecipe::bars — when set, the donor marker span is resized and
   * takes are looped/truncated to this length (desktop appendClipSmfLoopedAsBeats).
   */
  bars?: number
  lanes?: Partial<Record<StyleMakerLane, LaneReplacement>>
  minorLanes?: Partial<Record<StyleMakerLane, LaneReplacement>>
  partMixer?: PartMixerMap
  /** Legacy product shorthand — mapped to Rhythm1 / Bass / Chord1. */
  drums?: LaneReplacement
  bass?: LaneReplacement
  guitar?: LaneReplacement
}

/**
 * Grow or shrink a section's MIDI window by shifting later events (markers +
 * notes) so Style Maker Bars can diverge from the donor marker length.
 */
export function resizeSectionSpan(
  tracks: { endTick: number; events: MidiEvent[] }[],
  rangeStart: number,
  oldRangeEnd: number,
  newRangeEnd: number,
): void {
  const delta = newRangeEnd - oldRangeEnd
  if (delta === 0) return

  if (delta < 0) {
    // Truncate: drop events that lived in the removed tail of this section.
    for (const track of tracks) {
      track.events = track.events.filter(
        (event) => event.tick < newRangeEnd || event.tick >= oldRangeEnd,
      )
    }
  }

  for (const track of tracks) {
    for (const event of track.events) {
      if (event.tick >= oldRangeEnd) event.tick += delta
    }
    track.endTick = Math.max(0, track.endTick + delta)
  }
}

/** @deprecated Use StyleSectionLaneReplacements[] via replaceStyleProjectProduct. */
export type StyleLaneReplacements = {
  lanes?: Partial<Record<StyleMakerLane, LaneReplacement>>
  minorLanes?: Partial<Record<StyleMakerLane, LaneReplacement>>
  partMixer?: PartMixerMap
  drums?: LaneReplacement
  bass?: LaneReplacement
  guitar?: LaneReplacement
  sectionLabel?: string
  range?: StyleSectionRange
}

function collectLanes(
  replacements: StyleSectionLaneReplacements | StyleLaneReplacements,
): Partial<Record<StyleMakerLane, LaneReplacement>> {
  const out: Partial<Record<StyleMakerLane, LaneReplacement>> = {
    ...(replacements.lanes || {}),
  }
  const legacy: [ProductLane, LaneReplacement | undefined][] = [
    ["drums", replacements.drums],
    ["bass", replacements.bass],
    ["guitar", replacements.guitar],
  ]
  for (const [product, rep] of legacy) {
    if (!rep) continue
    const lane = styleMakerLaneForProduct(product)
    if (!out[lane]) out[lane] = rep
  }
  return out
}

/**
 * StyleMakerEngine.cpp isTemplatePerformanceMessageForReplacement —
 * strip notes / pitch / aftertouch / pressure and most CCs; keep bank/volume/pan/
 * expression/reverb/chorus so mixer setup can still apply.
 */
export function isTemplatePerformanceMessageForReplacement(
  event: MidiEvent,
): boolean {
  const kind = event.status & 0xf0
  if (
    kind === 0x80 ||
    kind === 0x90 ||
    kind === 0xa0 ||
    kind === 0xd0 ||
    kind === 0xe0
  ) {
    return true
  }
  if (kind !== 0xb0) return false
  const cc = event.data[0] ?? -1
  return (
    cc !== 0 &&
    cc !== 32 &&
    cc !== 7 &&
    cc !== 10 &&
    cc !== 11 &&
    cc !== 91 &&
    cc !== 93
  )
}

function sectionHasWork(section: StyleSectionLaneReplacements): boolean {
  const lanes = collectLanes(section)
  const minors = section.minorLanes || {}
  return (
    Object.keys(lanes).length > 0 ||
    Object.keys(minors).length > 0 ||
    partMixerHasAny(section.partMixer)
  )
}

/**
 * Desktop renderProjectToMidi — apply every section that has takes/mixer onto
 * the donor MIDI prefix, then patch pattern CASM for assigned Main/Fill lanes.
 */
export function replaceStyleProjectProduct(
  style: ParsedYamahaStyle,
  sections: StyleSectionLaneReplacements[],
): Uint8Array {
  const work = sections.filter(sectionHasWork)
  if (!work.length) {
    throw new Error("No lane replacements or part mixer settings provided.")
  }

  const tracks = style.tracks.map((track) => ({
    endTick: track.endTick,
    events: track.events.map((event) => ({ ...event, data: [...event.data] })),
  }))
  const target = tracks[0]
  if (!target) throw new Error("Style has no MIDI tracks.")

  const endTick = Math.max(...tracks.map((track) => track.endTick))
  let order = Math.max(0, ...target.events.map((event) => event.order), 0) + 1

  const removePerformanceOnChannels = (
    midiChannels0Based: number[],
    rangeStart: number,
    rangeEnd: number,
  ) => {
    if (!midiChannels0Based.length) return
    tracks.forEach((track) => {
      track.events = track.events.filter((event) => {
        const channel = event.status & 0x0f
        if (!midiChannels0Based.includes(channel)) return true
        if (event.tick < rangeStart || event.tick >= rangeEnd) return true
        return !isTemplatePerformanceMessageForReplacement(event)
      })
    })
  }

  const writeLaneNotes = (
    rep: LaneReplacement,
    sourceChannels1Based: number[],
    rangeStart: number,
    rangeEnd: number,
  ) => {
    const midiChannels0Based = sourceChannels1Based.map((ch) => ch - 1)
    removePerformanceOnChannels(midiChannels0Based, rangeStart, rangeEnd)
    for (const ch1 of sourceChannels1Based) {
      const events = notesToEvents(
        rep.notes,
        ch1 - 1,
        rep.cycleTicks,
        rangeEnd,
        order,
        rangeStart,
      )
      order += events.length
      target.events.push(...events)
    }
  }

  let tail: Uint8Array = style.yamahaTail.slice()

  // Process later sections first so shifting ticks for an early expand does not
  // invalidate already-computed later ranges (desktop rebuilds sequentially).
  const ordered = [...work].sort(
    (a, b) => (b.range.startTick || 0) - (a.range.startTick || 0),
  )

  for (const section of ordered) {
    const rangeStart = Math.max(0, section.range.startTick || 0)
    let rangeEnd = Math.min(
      Math.max(...tracks.map((track) => track.endTick), endTick),
      section.range.endTick || endTick,
    )
    if (section.bars != null && section.bars > 0) {
      const targetEnd = rangeStart + sectionTargetTicks(section.bars, style.ticksPerQuarter)
      if (targetEnd !== rangeEnd) {
        resizeSectionSpan(tracks, rangeStart, rangeEnd, targetEnd)
        rangeEnd = targetEnd
      }
    }
    const sectionLabel =
      section.sectionLabel ||
      section.range.templateSection ||
      section.range.label ||
      "Main A"
    const writtenSection = sectionIsIntroOrEnding(sectionLabel)

    const assignedLanes = collectLanes(section)
    const assignedEntries = (
      Object.entries(assignedLanes) as [string, LaneReplacement][]
    ).map(([key, rep]) => ({
      lane: Number(key) as StyleMakerLane,
      rep,
    }))
    const minorEntries = (
      Object.entries(section.minorLanes || {}) as [string, LaneReplacement][]
    ).map(([key, rep]) => ({
      lane: Number(key) as StyleMakerLane,
      rep,
    }))

    if (partMixerHasAny(section.partMixer) && section.partMixer) {
      const mixerEvents = partMixerSetupEvents(
        section.partMixer,
        rangeStart,
        order,
      )
      order += mixerEvents.length
      target.events.push(...mixerEvents)
    }

    for (const { lane, rep } of assignedEntries) {
      const sourceChannels1Based = writtenSection
        ? majorSourceChannelsForLane(style.yamahaTail, sectionLabel, lane)
        : replacementSourceChannelsForLane(style.yamahaTail, sectionLabel, lane)
      writeLaneNotes(rep, sourceChannels1Based, rangeStart, rangeEnd)
    }

    if (writtenSection) {
      for (const { lane, rep } of minorEntries) {
        let sourceChannels1Based = minorSourceChannelsForLane(
          style.yamahaTail,
          sectionLabel,
          lane,
        )
        if (!sourceChannels1Based.length) {
          sourceChannels1Based = [storedChannel(lane)]
        }
        writeLaneNotes(rep, sourceChannels1Based, rangeStart, rangeEnd)
      }
    }

    if (!writtenSection && assignedEntries.length) {
      tail = applyPatternSectionCasmForAssignedLanes(
        tail,
        sectionLabel,
        assignedEntries.map(({ lane, rep }) => ({
          lane,
          sourceKind: rep.sourceKind || "guitar",
          guitarCasmMode:
            rep.guitarCasmMode ?? StyleMakerGuitarCasmMode.RenderedMegaVoice,
        })),
      )
    }
  }

  const output: number[] = [
    ...Array.from(
      style.originalBytes.slice(0, 8 + readU32(style.originalBytes, 4)),
    ),
  ]
  tracks.forEach((track) => {
    const data = serializeTrack(track)
    output.push(
      ...Array.from(new TextEncoder().encode("MTrk")),
      ...writeU32(data.length),
      ...data,
    )
  })
  output.push(...tail)
  return Uint8Array.from(output)
}

/**
 * Single-section convenience wrapper (tests / legacy call sites).
 */
export function replaceStyleLanesProduct(
  style: ParsedYamahaStyle,
  replacements: StyleLaneReplacements,
): Uint8Array {
  const range = replacements.range
  if (!range) {
    throw new Error("Section range is required for lane replacement.")
  }
  return replaceStyleProjectProduct(style, [
    {
      range,
      sectionLabel:
        replacements.sectionLabel ||
        range.templateSection ||
        range.label ||
        "Main A",
      lanes: replacements.lanes,
      minorLanes: replacements.minorLanes,
      partMixer: replacements.partMixer,
      drums: replacements.drums,
      bass: replacements.bass,
      guitar: replacements.guitar,
    },
  ])
}
