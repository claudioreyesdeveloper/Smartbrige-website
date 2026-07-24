/**
 * Template CASM helpers — port of StyleTemplateService source-channel lookup
 * and StyleNativeExporter Main/Fill Ctab generation for assigned lanes.
 *
 * Section matching follows desktop StyleTemplateService exactly:
 * trim + optional fn: strip, case-sensitive, first matching CSEG only.
 * Callers must pass the Yamaha marker (e.g. "Main A", "Intro A"), not a
 * display label — use yamahaTemplateSectionName / range.templateSection.
 */

import { findTag, readU32be, splitSdecNames } from "./casm/parser"
import {
  Ntr,
  Ntt,
  RetriggerRule,
} from "./casm/model"
import {
  appendDuplicateRecord,
  type CtabFieldPatch,
} from "./casm/writer"
import {
  casmPartCodeForLane,
  laneForCasmPart,
  storedChannel,
  styleChannel,
  StyleMakerLane,
} from "./lanes"

/** StyleTemplateService.cpp normaliseSectionMarker — no display↔Yamaha rename. */
export function normaliseSectionMarker(marker: string): string {
  let s = marker.trim()
  if (/^fn:/i.test(s)) s = s.slice(3).trim()
  return s
}

/**
 * StyleTemplateService.cpp isMinorSourceChordType —
 * sourceChordType in [0x08, 0x10] (m … mM7(9)). Not name-based.
 */
export function isMinorSourceChordType(sourceChordType: number): boolean {
  return sourceChordType >= 0x08 && sourceChordType <= 0x10
}

export type SourceChordFilter = "any" | "major" | "minor"

export type StyleMakerCasmRecord = {
  lane: StyleMakerLane
  sourceChannel: number
  sourceChordIsMinor: boolean
  sourceChordType: number
}

/**
 * StyleTemplateService::sourceChannelsForSectionLane
 * Returns 1-based MIDI source channels whose Ctab destination part matches the lane
 * inside the first CSEG whose Sdec lists the section marker.
 */
export function sourceChannelsForSectionLane(
  yamahaTail: Uint8Array,
  sectionMarker: string,
  lane: StyleMakerLane,
  chordFilter: SourceChordFilter = "any",
): number[] {
  const channels = new Set<number>()
  if (!yamahaTail.length || !sectionMarker.trim()) return []

  const wantedSection = normaliseSectionMarker(sectionMarker)
  if (!wantedSection) return []
  const wantedPart = casmPartCodeForLane(lane)
  let csegPos = 0

  while (csegPos + 8 <= yamahaTail.length) {
    let found = false
    for (; csegPos + 8 <= yamahaTail.length; csegPos += 1) {
      if (
        yamahaTail[csegPos] === 0x43 &&
        yamahaTail[csegPos + 1] === 0x53 &&
        yamahaTail[csegPos + 2] === 0x45 &&
        yamahaTail[csegPos + 3] === 0x47
      ) {
        found = true
        break
      }
    }
    if (!found) break

    const csegLen = readU32be(yamahaTail, csegPos + 4)
    const csegEnd = csegPos + 8 + csegLen
    if (csegEnd > yamahaTail.length) break

    let sectionMatches = false
    for (let p = csegPos + 8; p + 8 <= csegEnd; p += 1) {
      if (
        yamahaTail[p] !== 0x53 ||
        yamahaTail[p + 1] !== 0x64 ||
        yamahaTail[p + 2] !== 0x65 ||
        yamahaTail[p + 3] !== 0x63
      ) {
        continue
      }
      const sdecLen = readU32be(yamahaTail, p + 4)
      if (p + 8 + sdecLen > csegEnd) break
      const names = splitSdecNames(
        yamahaTail.subarray(p + 8, p + 8 + sdecLen),
      ).map((n) => normaliseSectionMarker(n))
      sectionMatches = names.includes(wantedSection)
      break
    }

    if (sectionMatches) {
      // Desktop returns after the first matching CSEG.
      let p = csegPos + 8
      while (p + 18 <= csegEnd) {
        const isCtab =
          yamahaTail[p] === 0x43 &&
          yamahaTail[p + 1] === 0x74 &&
          yamahaTail[p + 2] === 0x61 &&
          yamahaTail[p + 3] === 0x62
        const isCtb2 =
          yamahaTail[p] === 0x43 &&
          yamahaTail[p + 1] === 0x74 &&
          yamahaTail[p + 2] === 0x62 &&
          yamahaTail[p + 3] === 0x32
        if (!isCtab && !isCtb2) {
          p += 1
          continue
        }
        const ctbLen = readU32be(yamahaTail, p + 4)
        if (ctbLen < 10 || p + 8 + ctbLen > csegEnd) {
          p += 4
          continue
        }
        const body = yamahaTail.subarray(p + 8, p + 8 + ctbLen)
        if (body[9] === wantedPart) {
          const isMinor =
            body.length > 19 && isMinorSourceChordType(body[19])
          if (
            chordFilter === "any" ||
            (chordFilter === "minor" && isMinor) ||
            (chordFilter === "major" && !isMinor)
          ) {
            channels.add(body[0] + 1)
          }
        }
        p += 8 + ctbLen
      }
      return [...channels].sort((a, b) => a - b)
    }

    csegPos = csegEnd
  }

  return [...channels].sort((a, b) => a - b)
}

/**
 * StyleTemplateService::casmRecordsForSection — first matching CSEG only.
 */
export function casmRecordsForSection(
  yamahaTail: Uint8Array,
  sectionMarker: string,
): StyleMakerCasmRecord[] {
  const records: StyleMakerCasmRecord[] = []
  if (!yamahaTail.length || !sectionMarker.trim()) return records

  const wantedSection = normaliseSectionMarker(sectionMarker)
  if (!wantedSection) return records
  let csegPos = 0

  while (csegPos + 8 <= yamahaTail.length) {
    let found = false
    for (; csegPos + 8 <= yamahaTail.length; csegPos += 1) {
      if (
        yamahaTail[csegPos] === 0x43 &&
        yamahaTail[csegPos + 1] === 0x53 &&
        yamahaTail[csegPos + 2] === 0x45 &&
        yamahaTail[csegPos + 3] === 0x47
      ) {
        found = true
        break
      }
    }
    if (!found) break

    const csegLen = readU32be(yamahaTail, csegPos + 4)
    const csegEnd = csegPos + 8 + csegLen
    if (csegEnd > yamahaTail.length) break

    let sectionNames: string[] = []
    for (let p = csegPos + 8; p + 8 <= csegEnd; p += 1) {
      if (
        yamahaTail[p] !== 0x53 ||
        yamahaTail[p + 1] !== 0x64 ||
        yamahaTail[p + 2] !== 0x65 ||
        yamahaTail[p + 3] !== 0x63
      ) {
        continue
      }
      const sdecLen = readU32be(yamahaTail, p + 4)
      if (p + 8 + sdecLen > csegEnd) break
      sectionNames = splitSdecNames(
        yamahaTail.subarray(p + 8, p + 8 + sdecLen),
      ).map((n) => normaliseSectionMarker(n))
      break
    }

    if (sectionNames.includes(wantedSection)) {
      let p = csegPos + 8
      while (p + 20 <= csegEnd) {
        const isCtab =
          yamahaTail[p] === 0x43 &&
          yamahaTail[p + 1] === 0x74 &&
          yamahaTail[p + 2] === 0x61 &&
          yamahaTail[p + 3] === 0x62
        const isCtb2 =
          yamahaTail[p] === 0x43 &&
          yamahaTail[p + 1] === 0x74 &&
          yamahaTail[p + 2] === 0x62 &&
          yamahaTail[p + 3] === 0x32
        if (!isCtab && !isCtb2) {
          p += 1
          continue
        }
        const ctbLen = readU32be(yamahaTail, p + 4)
        if (ctbLen < 20 || p + 8 + ctbLen > csegEnd) {
          p += 4
          continue
        }
        const body = yamahaTail.subarray(p + 8, p + 8 + ctbLen)
        const lane = laneForCasmPart(body[9])
        if (lane != null) {
          const sourceChordType = body[19]
          records.push({
            lane,
            sourceChannel: body[0] + 1,
            sourceChordType,
            sourceChordIsMinor: isMinorSourceChordType(sourceChordType),
          })
        }
        p += 8 + ctbLen
      }
      return records
    }

    csegPos = csegEnd
  }

  return records
}

/**
 * StyleMakerEngine::replacementSourceChannelsForLane
 * Falls back to styleChannel(lane) when CASM has no source channels for the lane.
 */
export function replacementSourceChannelsForLane(
  yamahaTail: Uint8Array,
  templateSection: string,
  lane: StyleMakerLane,
): number[] {
  const channels = sourceChannelsForSectionLane(yamahaTail, templateSection, lane)
  if (channels.length === 0) return [styleChannel(lane)]
  return channels
}

/** StyleMakerEngine::majorSourceChannelsForLane */
export function majorSourceChannelsForLane(
  yamahaTail: Uint8Array,
  templateSection: string,
  lane: StyleMakerLane,
): number[] {
  const channels = new Set<number>()
  for (const record of casmRecordsForSection(yamahaTail, templateSection)) {
    if (record.lane === lane && !record.sourceChordIsMinor) {
      channels.add(record.sourceChannel)
    }
  }
  if (channels.size === 0) {
    return replacementSourceChannelsForLane(yamahaTail, templateSection, lane)
  }
  return [...channels].sort((a, b) => a - b)
}

/**
 * StyleMakerEngine::minorSourceChannelsForLane — includes storedChannel fallback
 * for non-rhythm lanes when no minor CASM group exists.
 */
export function minorSourceChannelsForLane(
  yamahaTail: Uint8Array,
  templateSection: string,
  lane: StyleMakerLane,
): number[] {
  const channels = new Set<number>()
  for (const record of casmRecordsForSection(yamahaTail, templateSection)) {
    if (record.lane === lane && record.sourceChordIsMinor) {
      channels.add(record.sourceChannel)
    }
  }
  if (
    channels.size === 0 &&
    lane !== StyleMakerLane.Rhythm1 &&
    lane !== StyleMakerLane.Rhythm2
  ) {
    channels.add(storedChannel(lane))
  }
  return [...channels].sort((a, b) => a - b)
}

/**
 * StyleMakerEngine::donorMinorSourceChannelsForLane — empty when the donor has
 * no minor group (no storedChannel fallback).
 */
export function donorMinorSourceChannelsForLane(
  yamahaTail: Uint8Array,
  templateSection: string,
  lane: StyleMakerLane,
): number[] {
  const channels = new Set<number>()
  for (const record of casmRecordsForSection(yamahaTail, templateSection)) {
    if (record.lane === lane && record.sourceChordIsMinor) {
      channels.add(record.sourceChannel)
    }
  }
  return [...channels].sort((a, b) => a - b)
}

function voiceLabelForGeneratedLane(lane: StyleMakerLane): string {
  // StyleNativeExporter.cpp voiceLabelForGeneratedLane
  switch (lane) {
    case StyleMakerLane.Rhythm1:
      return "Rhythm1"
    case StyleMakerLane.Rhythm2:
      return "Rhythm2"
    case StyleMakerLane.Bass:
      return "Bass"
    case StyleMakerLane.Chord1:
      return "Chord1"
    case StyleMakerLane.Chord2:
      return "Chord2"
    case StyleMakerLane.Pad:
      return "Pad"
    case StyleMakerLane.Phrase1:
      return "Phrase1"
    case StyleMakerLane.Phrase2:
      return "Phrase2"
  }
}

/**
 * StyleNativeExporter::patchForGeneratedWrittenLane — used when generating a
 * missing Ctab for an assigned Main/Fill lane that has no destination in the donor CSEG.
 */
export function patchForGeneratedWrittenLane(
  lane: StyleMakerLane,
  sourceChannel: number,
  minor: boolean,
): CtabFieldPatch {
  const patch: CtabFieldPatch = {
    newSourceChannel: sourceChannel,
    newDestinationCh: styleChannel(lane),
    voiceName: voiceLabelForGeneratedLane(lane),
    openNoteMask: true,
    sourceRoot: minor ? 9 : 0,
    sourceChordType: minor ? 8 : 2,
    highKey: 127,
  }

  switch (lane) {
    case StyleMakerLane.Rhythm1:
    case StyleMakerLane.Rhythm2:
      patch.ntr = Ntr.RootFixed
      patch.ntt = Ntt.Bypass
      patch.noteLowLimit = 0
      patch.noteHighLimit = 127
      patch.retrigger = RetriggerRule.Stop
      break
    case StyleMakerLane.Bass:
      patch.ntr = Ntr.RootTrans
      patch.ntt = Ntt.Melody
      patch.bassOn = true
      patch.noteLowLimit = 28
      patch.noteHighLimit = 55
      patch.retrigger = RetriggerRule.PitchShiftToRoot
      break
    case StyleMakerLane.Chord1:
    case StyleMakerLane.Chord2:
      patch.ntr = Ntr.RootFixed
      patch.ntt = Ntt.Chord
      patch.noteLowLimit = 36
      patch.noteHighLimit = 96
      patch.retrigger = RetriggerRule.Stop
      break
    case StyleMakerLane.Pad:
      patch.ntr = Ntr.RootFixed
      patch.ntt = Ntt.Chord
      patch.noteLowLimit = 36
      patch.noteHighLimit = 96
      patch.retrigger = RetriggerRule.PitchShift
      break
    case StyleMakerLane.Phrase1:
    case StyleMakerLane.Phrase2:
      patch.ntr = Ntr.RootTrans
      patch.ntt = Ntt.Melody
      patch.noteLowLimit = 0
      patch.noteHighLimit = 127
      patch.retrigger = RetriggerRule.Stop
      break
  }

  return patch
}

function tailHasDestinationInSection(
  yamahaTail: Uint8Array,
  sectionName: string,
  destCh: number,
): boolean {
  const wantedPart = 0x08 + (destCh - 9)
  const wanted = normaliseSectionMarker(sectionName)
  let csegPos = 0
  while (csegPos + 8 <= yamahaTail.length) {
    const rel = findTag(yamahaTail, "CSEG", csegPos)
    if (rel < 0) break
    csegPos = rel
    const csegLen = readU32be(yamahaTail, csegPos + 4)
    const csegEnd = Math.min(yamahaTail.length, csegPos + 8 + csegLen)

    let sectionMatches = false
    const sdecRel = findTag(yamahaTail, "Sdec", csegPos + 8)
    if (sdecRel >= 0 && sdecRel < csegEnd) {
      const sdecLen = readU32be(yamahaTail, sdecRel + 4)
      if (sdecRel + 8 + sdecLen <= csegEnd) {
        const names = splitSdecNames(
          yamahaTail.subarray(sdecRel + 8, sdecRel + 8 + sdecLen),
        ).map((n) => normaliseSectionMarker(n))
        sectionMatches = names.includes(wanted)
      }
    }

    if (sectionMatches) {
      let p = csegPos + 8
      while (p + 8 <= csegEnd) {
        const isCtab =
          yamahaTail[p] === 0x43 &&
          yamahaTail[p + 1] === 0x74 &&
          yamahaTail[p + 2] === 0x61 &&
          yamahaTail[p + 3] === 0x62
        const isCtb2 =
          yamahaTail[p] === 0x43 &&
          yamahaTail[p + 1] === 0x74 &&
          yamahaTail[p + 2] === 0x62 &&
          yamahaTail[p + 3] === 0x32
        if (!isCtab && !isCtb2) {
          p += 1
          continue
        }
        const ctbLen = readU32be(yamahaTail, p + 4)
        if (ctbLen < 10 || p + 8 + ctbLen > csegEnd) {
          p += 4
          continue
        }
        if (yamahaTail[p + 8 + 9] === wantedPart) return true
        p += 8 + ctbLen
      }
      // Desktop sourceChannels returns on first match; destination probe matches that.
      return false
    }
    csegPos = csegEnd
  }
  return false
}

/**
 * StyleNativeExporter Main/Fill path: when an assigned lane has no destination
 * in the section CSEG, generate a Ctab via appendDuplicateRecord.
 * Existing donor CASM is left untouched when the destination already exists
 * (rendered MegaVoice / library clips keep donor NTR/NTT).
 */
export function ensurePatternSectionCtabForAssignedLane(
  yamahaTail: Uint8Array,
  templateSection: string,
  lane: StyleMakerLane,
): Uint8Array {
  const destCh = styleChannel(lane)
  if (tailHasDestinationInSection(yamahaTail, templateSection, destCh)) {
    return yamahaTail
  }

  const sources = sourceChannelsForSectionLane(yamahaTail, templateSection, lane)
  // templateSourceForGeneratedRecord fallback: use first available source in section,
  // else dest channel itself (desktop walks records; we use any Ctab in section as template).
  let templateSource = sources[0] || 0
  if (templateSource < 1) {
    // Find any Ctab source channel in this section to duplicate from.
    const any = sourceChannelsForSectionLane(yamahaTail, templateSection, StyleMakerLane.Bass)
      .concat(sourceChannelsForSectionLane(yamahaTail, templateSection, StyleMakerLane.Rhythm1))
      .concat(sourceChannelsForSectionLane(yamahaTail, templateSection, StyleMakerLane.Chord1))
    templateSource = any[0] || destCh
  }
  if (templateSource < 1) return yamahaTail

  const patch = patchForGeneratedWrittenLane(lane, destCh, false)
  const result = appendDuplicateRecord(
    yamahaTail,
    templateSource,
    patch,
    templateSection,
  )
  return result.ok && result.recordsAdded > 0 ? result.data : yamahaTail
}
