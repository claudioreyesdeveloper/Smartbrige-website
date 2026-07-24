/**
 * StyleNativeExporter Main/Fill CASM write path — port of
 * SmartBridge/Source/StyleMaker/StyleNativeExporter.cpp
 *
 * For pattern sections (Main / Fill):
 * 1) Yamaha Guitar-source modes → patch NTR=Guitar + NTT for the lane's source channels
 * 2) Missing destination Ctab for an assigned lane → appendDuplicateRecord with
 *    patchForGeneratedWrittenLane (Bass / Chord / Pad / Phrase rules)
 *
 * Intro/Ending verbatim CASM and guitar high-zone patching are deferred.
 */

import { parseCasm } from "./casm/parser"
import { Ntr, Ntt, type StyleCasmModel } from "./casm/model"
import { appendDuplicateRecord, patchCtab } from "./casm/writer"
import {
  laneForCasmPart,
  styleChannel,
  StyleMakerGuitarCasmMode,
  StyleMakerLane,
  isYamahaGuitarSourceMode,
} from "./lanes"
import {
  patchForGeneratedWrittenLane,
  sourceChannelsForSectionLane,
} from "./template"

export type StyleMakerCasmRecordLite = {
  lane: StyleMakerLane
  sourceChannel: number
  destinationChannel: number
  sourceChordIsMinor: boolean
}

/** StyleTemplateService.cpp normaliseSectionMarker — case-sensitive, no rename. */
function normaliseSectionMarker(marker: string): string {
  let s = marker.trim()
  if (/^fn:/i.test(s)) s = s.slice(3).trim()
  return s
}

function isRhythmLane(lane: StyleMakerLane): boolean {
  return lane === StyleMakerLane.Rhythm1 || lane === StyleMakerLane.Rhythm2
}

/**
 * GuitarPatternClassifier::nttForGuitarBehavior — Strum→Stroke, Arpeggio→Arpeggio,
 * Mixed→AllPurpose.
 */
export function nttForGuitarBehavior(
  behavior: "strum" | "arpeggio" | "mixed",
): Ntt {
  switch (behavior) {
    case "strum":
      return Ntt.GuitarStroke
    case "arpeggio":
      return Ntt.GuitarArpeggio
    case "mixed":
      return Ntt.GuitarAllPurpose
  }
}

/** StyleNativeExporter.cpp nttForMode */
export function nttForGuitarCasmMode(mode: StyleMakerGuitarCasmMode): Ntt {
  switch (mode) {
    case StyleMakerGuitarCasmMode.YamahaSourceStrum:
      return nttForGuitarBehavior("strum")
    case StyleMakerGuitarCasmMode.YamahaSourceArpeggio:
      return nttForGuitarBehavior("arpeggio")
    case StyleMakerGuitarCasmMode.YamahaSourceMixed:
      return nttForGuitarBehavior("mixed")
    case StyleMakerGuitarCasmMode.PreserveDonor:
    case StyleMakerGuitarCasmMode.RenderedMegaVoice:
      break
  }
  return Ntt.GuitarAllPurpose
}

/** StyleTemplateService::casmRecordsForSection — lightweight records for export helpers. */
export function casmRecordsForSection(
  yamahaTail: Uint8Array,
  sectionMarker: string,
): StyleMakerCasmRecordLite[] {
  const wanted = normaliseSectionMarker(sectionMarker)
  if (!yamahaTail.length || !wanted) return []

  const model: StyleCasmModel = parseCasm(yamahaTail)
  const records: StyleMakerCasmRecordLite[] = []

  for (const group of model.csegGroups) {
    const names = group.sdec.partNames.map((n) => normaliseSectionMarker(n))
    if (!names.includes(wanted)) continue
    // Desktop StyleTemplateService::casmRecordsForSection returns on first CSEG.
    for (const entry of group.ctabEntries) {
      const lane = laneForCasmPart(entry.destinationPart)
      if (lane == null) continue
      records.push({
        lane,
        sourceChannel: entry.sourceChannel,
        destinationChannel: entry.destinationChannel,
        sourceChordIsMinor: entry.sourceChordIsMinor,
      })
    }
    return records
  }
  return records
}

/**
 * StyleNativeExporter.cpp templateSourceForGeneratedRecord — pick a donor Ctab
 * source channel to duplicate when generating a missing destination.
 */
export function templateSourceForGeneratedRecord(
  records: StyleMakerCasmRecordLite[],
  lane: StyleMakerLane,
  minor: boolean,
): number {
  const sourceFor = (wanted: StyleMakerLane): number => {
    for (const r of records) {
      if (
        r.lane === wanted &&
        r.sourceChordIsMinor === minor &&
        r.sourceChannel >= 1 &&
        r.sourceChannel <= 16
      ) {
        return r.sourceChannel
      }
    }
    return -1
  }

  const same = sourceFor(lane)
  if (same > 0) return same

  switch (lane) {
    case StyleMakerLane.Pad: {
      const ch1 = sourceFor(StyleMakerLane.Chord1)
      if (ch1 > 0) return ch1
      const ch2 = sourceFor(StyleMakerLane.Chord2)
      if (ch2 > 0) return ch2
      break
    }
    case StyleMakerLane.Phrase1:
    case StyleMakerLane.Phrase2: {
      const p1 = sourceFor(StyleMakerLane.Phrase1)
      if (p1 > 0) return p1
      const p2 = sourceFor(StyleMakerLane.Phrase2)
      if (p2 > 0) return p2
      const ch2 = sourceFor(StyleMakerLane.Chord2)
      if (ch2 > 0) return ch2
      const ch1 = sourceFor(StyleMakerLane.Chord1)
      if (ch1 > 0) return ch1
      break
    }
    default:
      break
  }

  for (const r of records) {
    if (
      r.sourceChordIsMinor === minor &&
      !isRhythmLane(r.lane) &&
      r.sourceChannel >= 1 &&
      r.sourceChannel <= 16
    ) {
      return r.sourceChannel
    }
  }
  for (const r of records) {
    if (r.sourceChannel >= 1 && r.sourceChannel <= 16) return r.sourceChannel
  }
  return -1
}

function tailHasDestinationInSection(
  model: StyleCasmModel,
  sectionName: string,
  destinationChannel: number,
): boolean {
  const wanted = normaliseSectionMarker(sectionName)
  for (const g of model.csegGroups) {
    const inSection = g.sdec.partNames.some(
      (n) => normaliseSectionMarker(n) === wanted,
    )
    if (!inSection) continue
    // First matching CSEG only (same as StyleTemplateService).
    for (const c of g.ctabEntries) {
      if (c.destinationChannel === destinationChannel) return true
    }
    return false
  }
  return false
}

export type AssignedLaneForExport = {
  lane: StyleMakerLane
  sourceKind: string
  guitarCasmMode: StyleMakerGuitarCasmMode
}

/**
 * StyleNativeExporter Main/Fill CASM steps for assigned lanes:
 * - Yamaha Guitar-source NTR/NTT patch when mode is Strum/Arpeggio/Mixed
 * - Generate missing destination Ctab via appendDuplicateRecord
 */
export function applyPatternSectionCasmForAssignedLanes(
  yamahaTail: Uint8Array,
  templateSection: string,
  assigned: AssignedLaneForExport[],
): Uint8Array {
  if (!yamahaTail.length || !assigned.length) return yamahaTail

  let tail = yamahaTail.slice()

  // 1) Yamaha Guitar-source modes (desktop StyleNativeExporter.cpp ~247–285)
  for (const a of assigned) {
    if (!isYamahaGuitarSourceMode(a.guitarCasmMode)) continue
    if (a.sourceKind.toLowerCase() !== "guitar") continue

    let channels = sourceChannelsForSectionLane(tail, templateSection, a.lane)
    if (channels.length === 0) channels = [styleChannel(a.lane)]

    const patch = {
      ntr: Ntr.Guitar,
      ntt: nttForGuitarCasmMode(a.guitarCasmMode),
    }
    for (const ch of channels) {
      const result = patchCtab(tail, ch, patch, templateSection)
      if (result.ok && result.recordsPatched > 0) {
        tail = new Uint8Array(result.data)
      }
    }
  }

  // 2) Generate missing destination Ctabs (desktop ~395–434)
  for (const a of assigned) {
    const destCh = styleChannel(a.lane)
    const model = parseCasm(tail)
    if (tailHasDestinationInSection(model, templateSection, destCh)) continue

    const records = casmRecordsForSection(tail, templateSection)
    const templateSource = templateSourceForGeneratedRecord(records, a.lane, false)
    if (templateSource < 1) continue

    const patch = patchForGeneratedWrittenLane(a.lane, destCh, false)
    const result = appendDuplicateRecord(tail, templateSource, patch, templateSection)
    if (result.ok && result.recordsAdded > 0) {
      tail = new Uint8Array(result.data)
    }
  }

  return tail
}
