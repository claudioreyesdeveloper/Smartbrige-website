/**
 * Style Maker lanes — port of StyleMakerTypes.h StyleMakerLane helpers.
 * Channels, CASM destination parts, accepts(), and guitar CASM modes match
 * desktop verbatim. Do not invent alternate rules.
 */

export enum StyleMakerLane {
  Rhythm1 = 0,
  Rhythm2 = 1,
  Bass = 2,
  Chord1 = 3,
  Chord2 = 4,
  Pad = 5,
  Phrase1 = 6,
  Phrase2 = 7,
}

/** StyleMakerTypes.h StyleMakerGuitarCasmMode — numeric ids match ComboBox item ids. */
export enum StyleMakerGuitarCasmMode {
  PreserveDonor = 1,
  RenderedMegaVoice = 2,
  YamahaSourceStrum = 3,
  YamahaSourceArpeggio = 4,
  YamahaSourceMixed = 5,
}

export type SourceKind =
  | "bass"
  | "drums"
  | "guitar"
  | "brass"
  | "solo"
  | "pad"

export const ALL_STYLE_MAKER_LANES: StyleMakerLane[] = [
  StyleMakerLane.Rhythm1,
  StyleMakerLane.Rhythm2,
  StyleMakerLane.Bass,
  StyleMakerLane.Chord1,
  StyleMakerLane.Chord2,
  StyleMakerLane.Pad,
  StyleMakerLane.Phrase1,
  StyleMakerLane.Phrase2,
]

/** Intro / Ending (outro) sections — StyleMakerEngine::usesWrittenSectionCasmPatch. */
export function sectionIsIntroOrEnding(label: string): boolean {
  return /^(intro|ending)\b/i.test(label.trim())
}

export function styleChannel(lane: StyleMakerLane): number {
  // Yamaha style-part MIDI channel (9-16) — StyleMakerLanes::styleChannel
  return lane + 9
}

export function storedChannel(lane: StyleMakerLane): number {
  // Internal stored channel (1-8) — StyleMakerLanes::storedChannel
  return lane + 1
}

/** CASM destination part code 0x08..0x0F — StyleTemplateService::casmPartCodeForLane */
export function casmPartCodeForLane(lane: StyleMakerLane): number {
  switch (lane) {
    case StyleMakerLane.Rhythm1:
      return 0x08
    case StyleMakerLane.Rhythm2:
      return 0x09
    case StyleMakerLane.Bass:
      return 0x0a
    case StyleMakerLane.Chord1:
      return 0x0b
    case StyleMakerLane.Chord2:
      return 0x0c
    case StyleMakerLane.Pad:
      return 0x0d
    case StyleMakerLane.Phrase1:
      return 0x0e
    case StyleMakerLane.Phrase2:
      return 0x0f
  }
}

export function laneForCasmPart(part: number): StyleMakerLane | null {
  switch (part) {
    case 0x08:
      return StyleMakerLane.Rhythm1
    case 0x09:
      return StyleMakerLane.Rhythm2
    case 0x0a:
      return StyleMakerLane.Bass
    case 0x0b:
      return StyleMakerLane.Chord1
    case 0x0c:
      return StyleMakerLane.Chord2
    case 0x0d:
      return StyleMakerLane.Pad
    case 0x0e:
      return StyleMakerLane.Phrase1
    case 0x0f:
      return StyleMakerLane.Phrase2
    default:
      return null
  }
}

export function displayName(lane: StyleMakerLane): string {
  switch (lane) {
    case StyleMakerLane.Rhythm1:
      return "Rhythm 1"
    case StyleMakerLane.Rhythm2:
      return "Rhythm 2"
    case StyleMakerLane.Bass:
      return "Bass"
    case StyleMakerLane.Chord1:
      return "Chord 1"
    case StyleMakerLane.Chord2:
      return "Chord 2"
    case StyleMakerLane.Pad:
      return "Pad"
    case StyleMakerLane.Phrase1:
      return "Phrase 1"
    case StyleMakerLane.Phrase2:
      return "Phrase 2"
  }
}

/** StyleMakerLanes::acceptedHint */
export function acceptedHint(lane: StyleMakerLane): string {
  switch (lane) {
    case StyleMakerLane.Rhythm1:
      return "drums"
    case StyleMakerLane.Rhythm2:
      return "drums / percussion"
    case StyleMakerLane.Bass:
      return "bass clips"
    case StyleMakerLane.Chord1:
      return "guitar / keys / comp"
    case StyleMakerLane.Chord2:
      return "guitar / keys / horn comp"
    case StyleMakerLane.Pad:
      return "pad / sustained"
    case StyleMakerLane.Phrase1:
      return "solo / guitar / horn phrases"
    case StyleMakerLane.Phrase2:
      return "solo / guitar / horn phrases"
  }
}

/**
 * StyleMakerLanes::accepts — sourceKind: bass|drums|guitar|brass|solo|pad
 */
export function laneAccepts(
  lane: StyleMakerLane,
  sourceKind: string,
): { ok: boolean; warning?: string } {
  const k = sourceKind.trim().toLowerCase()
  switch (lane) {
    case StyleMakerLane.Rhythm1:
    case StyleMakerLane.Rhythm2:
      if (k === "drums") return { ok: true }
      return {
        ok: false,
        warning: "Rhythm lanes accept drum / percussion clips only.",
      }
    case StyleMakerLane.Bass:
      if (k === "bass") return { ok: true }
      return { ok: false, warning: "Bass lane accepts bass clips only." }
    case StyleMakerLane.Chord1:
    case StyleMakerLane.Chord2:
      if (k === "guitar" || k === "brass") return { ok: true }
      return {
        ok: false,
        warning: "Chord lanes accept guitar / keys / horn comp clips.",
      }
    case StyleMakerLane.Pad:
      if (k === "brass" || k === "pad" || k === "guitar") return { ok: true }
      return { ok: false, warning: "Pad lane accepts pad / sustained clips." }
    case StyleMakerLane.Phrase1:
    case StyleMakerLane.Phrase2:
      if (k === "solo" || k === "guitar" || k === "brass") return { ok: true }
      return {
        ok: false,
        warning: "Phrase lanes accept solo, guitar or horn phrases.",
      }
  }
}

export function isYamahaGuitarSourceMode(mode: StyleMakerGuitarCasmMode): boolean {
  return (
    mode === StyleMakerGuitarCasmMode.YamahaSourceStrum ||
    mode === StyleMakerGuitarCasmMode.YamahaSourceArpeggio ||
    mode === StyleMakerGuitarCasmMode.YamahaSourceMixed
  )
}

/** StyleMakerTypes.h guitarCasmModeName */
export function guitarCasmModeName(mode: StyleMakerGuitarCasmMode): string {
  switch (mode) {
    case StyleMakerGuitarCasmMode.PreserveDonor:
      return "Preserve donor CASM"
    case StyleMakerGuitarCasmMode.RenderedMegaVoice:
      return "Rendered MegaVoice performance"
    case StyleMakerGuitarCasmMode.YamahaSourceStrum:
      return "Yamaha Guitar source - Strum"
    case StyleMakerGuitarCasmMode.YamahaSourceArpeggio:
      return "Yamaha Guitar source - Arpeggio"
    case StyleMakerGuitarCasmMode.YamahaSourceMixed:
      return "Yamaha Guitar source - Mixed"
  }
}

/**
 * StyleMakerScreen.cpp sourceKindForLane — default kind before Part Type prompt.
 */
export function sourceKindForLane(lane: StyleMakerLane): string {
  switch (lane) {
    case StyleMakerLane.Rhythm1:
    case StyleMakerLane.Rhythm2:
      return "drums"
    case StyleMakerLane.Bass:
      return "bass"
    case StyleMakerLane.Chord1:
    case StyleMakerLane.Chord2:
      return "guitar"
    case StyleMakerLane.Pad:
      return "brass"
    case StyleMakerLane.Phrase1:
    case StyleMakerLane.Phrase2:
      return "guitar"
  }
}

export function laneCanUseGuitar(lane: StyleMakerLane): boolean {
  return laneAccepts(lane, "guitar").ok
}

export function laneNeedsPartTypePrompt(lane: StyleMakerLane): boolean {
  return (
    lane === StyleMakerLane.Chord1 ||
    lane === StyleMakerLane.Chord2 ||
    lane === StyleMakerLane.Pad ||
    lane === StyleMakerLane.Phrase1 ||
    lane === StyleMakerLane.Phrase2
  )
}

/**
 * StyleMakerScreen BuildTab::applyPartTypeChoice — selectedId is 1-based combo index.
 */
export function applyPartTypeChoice(
  lane: StyleMakerLane,
  selectedId: number,
  sourceKindIn: string,
): { sourceKind: string; guitarMode: StyleMakerGuitarCasmMode } {
  let sourceKind = sourceKindIn
  let guitarMode = StyleMakerGuitarCasmMode.RenderedMegaVoice

  if (lane === StyleMakerLane.Pad) {
    if (selectedId === 1) sourceKind = "pad"
    else if (selectedId === 2) sourceKind = "brass"
    else sourceKind = "guitar"
    return { sourceKind, guitarMode }
  }

  if (lane === StyleMakerLane.Chord1 || lane === StyleMakerLane.Chord2) {
    sourceKind = selectedId === 1 ? "brass" : "guitar"
    if (selectedId === 3) guitarMode = StyleMakerGuitarCasmMode.YamahaSourceStrum
    else if (selectedId === 4)
      guitarMode = StyleMakerGuitarCasmMode.YamahaSourceArpeggio
    else if (selectedId === 5) guitarMode = StyleMakerGuitarCasmMode.YamahaSourceMixed
    return { sourceKind, guitarMode }
  }

  // Phrase1 / Phrase2
  if (selectedId === 1) sourceKind = "solo"
  else if (selectedId === 2) sourceKind = "brass"
  else {
    sourceKind = "guitar"
    if (selectedId === 4) guitarMode = StyleMakerGuitarCasmMode.YamahaSourceStrum
    else if (selectedId === 5)
      guitarMode = StyleMakerGuitarCasmMode.YamahaSourceArpeggio
    else if (selectedId === 6) guitarMode = StyleMakerGuitarCasmMode.YamahaSourceMixed
  }
  return { sourceKind, guitarMode }
}

/** StyleMakerScreen BuildTab part-type combo choices — verbatim labels. */
export function partTypeChoicesForLane(lane: StyleMakerLane): string[] {
  if (lane === StyleMakerLane.Pad) {
    return [
      "Pad / sustained",
      "Brass or strings phrase",
      "Rendered MegaVoice guitar performance",
    ]
  }
  if (lane === StyleMakerLane.Chord1 || lane === StyleMakerLane.Chord2) {
    return [
      "Chord comp / keys",
      "Rendered MegaVoice guitar performance",
      "Yamaha Guitar source - Strum",
      "Yamaha Guitar source - Arpeggio",
      "Yamaha Guitar source - Mixed",
    ]
  }
  // Phrase1 / Phrase2
  return [
    "Phrase / melody",
    "Brass / horn riff",
    "Rendered MegaVoice guitar performance",
    "Yamaha Guitar source - Strum",
    "Yamaha Guitar source - Arpeggio",
    "Yamaha Guitar source - Mixed",
  ]
}

/**
 * Default combo index for part-type dialog (0-based), matching desktop
 * BuildTab::choosePartTypeForLaneAsync defaultIndex logic.
 */
export function defaultPartTypeIndex(
  lane: StyleMakerLane,
  sourceKind: string,
): number {
  const k = sourceKind.toLowerCase()
  if (lane === StyleMakerLane.Pad) {
    if (k === "brass" || k === "solo") return 1
    if (k === "guitar") return 2
    return 0
  }
  if (k === "brass" || k === "solo") return 0
  if (k === "guitar") return 1
  return 0
}

/** @deprecated Use StyleMakerLane assignments directly. Kept for older call sites. */
export type ProductLane = "drums" | "bass" | "guitar"

export function styleMakerLaneForProduct(lane: ProductLane): StyleMakerLane {
  switch (lane) {
    case "drums":
      return StyleMakerLane.Rhythm1
    case "bass":
      return StyleMakerLane.Bass
    case "guitar":
      return StyleMakerLane.Chord1
  }
}
