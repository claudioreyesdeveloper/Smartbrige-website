/**
 * Desktop BassDrumLibraryPanel constants + helpers for Style Maker web.
 * Sources: BassDrumLibraryPanel.cpp populate* / sectionTypeIdToString /
 * guitarTimeFeelFactorFromId / bassBpmMatchesTempoBand /
 * LibraryPhraseService::lookupDrumKitForCategory channel overrides.
 */

import {
  applyBassVelocityDeltas,
  BASS_REFERENCE_PROFILE_INDEX,
  findBassProfileIndexByBank,
  findBassProfileIndexByName,
  remapBassVelocityForTarget,
} from "@/lib/style-maker/bass-velocity-remap"
import {
  DRUM_SECTION_OPTIONS,
  sectionLooksLikeDrumFill,
} from "@/lib/style-maker/drum-section-types"

export {
  DRUM_SECTION_OPTIONS,
  findBassProfileIndexByBank,
  findBassProfileIndexByName,
}

export const BASS_SECTION_OPTIONS: { id: string; label: string }[] = [
  { id: "", label: "All Types" },
  { id: "intro", label: "Intro" },
  { id: "verse", label: "Verse" },
  { id: "pre_chorus", label: "Pre-Chorus" },
  { id: "chorus", label: "Chorus" },
  { id: "bridge", label: "Bridge" },
  { id: "fill", label: "Fills" },
  { id: "ending", label: "Ending" },
  { id: "outro", label: "Outro" },
  { id: "main", label: "Basslines" },
]

export type FeelModeFilter = "" | "straight" | "swing"

export const FEEL_MODE_OPTIONS: { id: FeelModeFilter; label: string }[] = [
  { id: "", label: "All Feels" },
  { id: "straight", label: "Straight" },
  { id: "swing", label: "Swing" },
]

/** Desktop tempo band combo ids 1–4 */
export type TempoBandId = 1 | 2 | 3 | 4

export const TEMPO_BAND_OPTIONS: { id: TempoBandId; label: string }[] = [
  { id: 1, label: "Any BPM" },
  { id: 2, label: "Slow (<90)" },
  { id: 3, label: "Medium (90-130)" },
  { id: 4, label: "Fast (>130)" },
]

/** Half / Normal / Double — desktop guitarTimeFeelFactorFromId */
export type TimeFeelId = 1 | 2 | 3

export const TIME_FEEL_OPTIONS: { id: TimeFeelId; label: string; factor: number }[] =
  [
    { id: 1, label: "Half Time", factor: 2 },
    { id: 2, label: "Normal", factor: 1 },
    { id: 3, label: "Double Time", factor: 0.5 },
  ]

export const VELOCITY_DELTA_OPTIONS = [-20, -15, -10, -5, 0, 5, 10, 15, 20] as const

export const DRUM_AUTO_CHANNEL = 0 // sentinel — UI “Auto”
export const DRUM_AUTO_FALLBACK_CHANNEL = 10

export type DrumMappingMode = "ambient" | "gm"

/**
 * LibraryPhraseService::shouldUseRawDrumNotesForCategory — these packs keep
 * authored notes; Ambient hat remap is forced off.
 */
export function shouldUseRawDrumNotesForCategory(
  categoryName: string | null | undefined,
): boolean {
  const cat = (categoryName || "").trim().toLowerCase().replace(/ /g, "_")
  return cat === "action_drums" || cat === "cinematic_percussion"
}

/** DatabaseManager::isGenosFamilyActive — model_key starts with "genos". */
export function isGenosFamilyProfileId(
  profileId: string | null | undefined,
): boolean {
  return (profileId || "").toLowerCase().startsWith("genos")
}

/**
 * Effective map after Genos gate + raw-note categories
 * (BassDrumLibraryPanel::buildContext + buildDrumSectionSequence).
 */
export function resolveDrumMappingMode(
  uiMode: DrumMappingMode,
  categoryName: string | null | undefined,
  isGenosFamily: boolean,
): DrumMappingMode {
  if (shouldUseRawDrumNotesForCategory(categoryName)) return "gm"
  if (!isGenosFamily) return "gm"
  return uiMode === "ambient" ? "ambient" : "gm"
}

/** LibraryPhraseService::remapDrumNoteForMode */
export function remapDrumNoteForMode(
  note: number,
  mode: DrumMappingMode,
): number {
  if (mode !== "ambient") return note
  switch (note) {
    case 42:
      return 15
    case 44:
      return 18
    case 46:
      return 17
    default:
      return note
  }
}

/** LibraryPhraseService::remapDrumVelocityForMode (after note remap). */
export function remapDrumVelocityForMode(
  note: number,
  velocity: number,
  mode: DrumMappingMode,
): number {
  if (mode !== "ambient") return velocity
  if (note >= 13 && note <= 22) {
    return Math.max(1, Math.min(127, velocity + 20))
  }
  return velocity
}

/** extractAndRemapDrumNotesOnly note+velocity remap for MidiNote arrays. */
export function applyDrumMappingToNotes<T extends { note: number; velocity: number }>(
  notes: T[],
  mode: DrumMappingMode,
): T[] {
  if (mode === "gm") return notes
  return notes.map((n) => {
    const note = remapDrumNoteForMode(n.note, mode)
    const velocity = remapDrumVelocityForMode(note, n.velocity, mode)
    return { ...n, note, velocity }
  })
}

export function bassBpmMatchesTempoBand(
  bpm: number | null | undefined,
  tempoBandId: TempoBandId,
): boolean {
  if (tempoBandId === 1) return true
  if (bpm == null || !Number.isFinite(bpm)) return true
  switch (tempoBandId) {
    case 2:
      return bpm < 90
    case 3:
      return bpm >= 90 && bpm <= 130
    case 4:
      return bpm > 130
  }
}

export function timeFeelFactor(id: TimeFeelId): number {
  if (id === 1) return 2
  if (id === 3) return 0.5
  return 1
}

/**
 * LibraryPhraseService::lookupDrumKitForCategory channel overrides (Genos).
 * Only applied when drum channel is Auto.
 */
export function drumKitChannelOverrideForCategory(
  categoryName: string | null | undefined,
): number | null {
  const cat = (categoryName || "").trim().toLowerCase().replace(/ /g, "_")
  if (cat === "funk_percussion") return 9
  if (cat === "action_drums" || cat === "cinematic_percussion") return 9
  if (cat === "latin_percussion" || cat.startsWith("latin_")) return 9
  return null
}

export function resolveDrumAuditionChannel(
  channelSelection: number,
  categoryName: string | null | undefined,
): number {
  if (channelSelection !== DRUM_AUTO_CHANNEL) {
    return Math.max(1, Math.min(16, channelSelection))
  }
  return (
    drumKitChannelOverrideForCategory(categoryName) ||
    DRUM_AUTO_FALLBACK_CHANNEL
  )
}

export function sectionLooksLikeFill(sectionType: string | null | undefined): boolean {
  return sectionLooksLikeDrumFill(sectionType)
}

export type NoteLike = {
  tick: number
  duration: number
  note: number
  velocity: number
}

/**
 * Apply desktop previewCandidate / apply-to-lane bass path:
 * timeFeelFactor → Vel/Dead band deltas → MegaVoice velocity remap.
 */
export function applyBassAuditionTransforms(
  notes: NoteLike[],
  options: {
    timeFeelFactor: number
    sustainVelocityDelta: number
    deadVelocityDelta: number
    /** BassMegaVoiceMaps profile index (ElectricBass = 1). */
    targetProfileIndex?: number
  },
): NoteLike[] {
  const factor = options.timeFeelFactor > 0 ? options.timeFeelFactor : 1
  const profileIndex = options.targetProfileIndex ?? BASS_REFERENCE_PROFILE_INDEX
  return notes.map((n) => {
    const afterDelta = applyBassVelocityDeltas(
      n.velocity,
      options.sustainVelocityDelta,
      options.deadVelocityDelta,
    )
    const velocity = remapBassVelocityForTarget(
      n.note,
      afterDelta,
      profileIndex,
    )
    return {
      ...n,
      tick: Math.round(n.tick * factor),
      duration: Math.max(1, Math.round(n.duration * factor)),
      velocity,
    }
  })
}
