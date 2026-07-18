import {
  JAM_ARRANGER_MAINS,
  JAM_CATALOG_EXPORT_VERSION,
  JAM_CATALOG_MAX_CHORDS_PER_SECTION,
  JAM_CATALOG_MAX_ENTRIES,
  JAM_CATALOG_MAX_SECTIONS_PER_SONG,
  JAM_CATALOG_MAX_SONGS,
  JAM_CATALOG_MAX_STYLES_PER_MODEL,
  JAM_CATALOG_SCHEMA_VERSION,
  JAM_CATALOG_SERVICE_KEY,
  JAM_SUPPORTED_MODELS,
} from "@/lib/jam/catalog/constants"
import { JamCatalogError } from "@/lib/jam/catalog/errors"
import type {
  JamArrangerMain,
  JamCatalogSnapshot,
  JamChordSummary,
  JamSectionSummary,
  JamSongSummary,
  JamStyleSummary,
  YamahaModelId,
} from "@/lib/jam/catalog/types"

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value)
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new JamCatalogError("malformed", `${label} must be a non-empty string.`)
  }
  return value
}

function optionalString(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value !== "string") {
    throw new JamCatalogError("malformed", "Expected a string field.")
  }
  return value.length > 0 ? value : undefined
}

function looksLikeFilesystemLeak(value: string): boolean {
  return (
    value.startsWith("/") ||
    value.includes("..") ||
    /^[A-Za-z]:[\\/]/.test(value) ||
    value.includes("\\")
  )
}

function assertNoFilesystemLeak(value: unknown, label: string): void {
  if (typeof value === "string" && looksLikeFilesystemLeak(value)) {
    throw new JamCatalogError(
      "malformed",
      `${label} exposes importer filesystem data.`,
    )
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoFilesystemLeak(item, `${label}[${index}]`))
    return
  }
  if (!isPlainObject(value)) return
  for (const [key, child] of Object.entries(value)) {
    if (
      key === "path" ||
      key === "source_file" ||
      key === "midi_path" ||
      key === "source_path" ||
      key === "manifest_path"
    ) {
      if (typeof child === "string" && looksLikeFilesystemLeak(child)) {
        throw new JamCatalogError(
          "malformed",
          `${label}.${key} exposes importer filesystem data.`,
        )
      }
      continue
    }
    assertNoFilesystemLeak(child, `${label}.${key}`)
  }
}

function parseArrangerMain(value: unknown, label: string): JamArrangerMain {
  const raw = requireString(value, label)
  if (!(JAM_ARRANGER_MAINS as readonly string[]).includes(raw)) {
    throw new JamCatalogError(
      "malformed",
      `${label} must be one of Main A–D (got ${raw}).`,
    )
  }
  return raw as JamArrangerMain
}

function parseTimeSignature(song: Record<string, unknown>, label: string): [number, number] {
  if (isFiniteNumber(song.ts_num) && isFiniteNumber(song.ts_den)) {
    const num = Math.trunc(song.ts_num)
    const den = Math.trunc(song.ts_den)
    if (num < 1 || den < 1) {
      throw new JamCatalogError("malformed", `${label} time signature is invalid.`)
    }
    return [num, den]
  }
  const raw = song.time_signature
  if (typeof raw === "string") {
    const match = /^(\d+)\s*\/\s*(\d+)$/.exec(raw.trim())
    if (!match) {
      throw new JamCatalogError("malformed", `${label} time_signature is invalid.`)
    }
    return [Number(match[1]), Number(match[2])]
  }
  // Known schema v1 may omit ts; default to 4/4 when absent.
  return [4, 4]
}

function parseChordBlock(
  entry: Record<string, unknown>,
  songStableId: string,
): JamChordSummary {
  const metadata = entry.metadata
  if (!isPlainObject(metadata)) {
    throw new JamCatalogError("malformed", `Chord ${entry.stableId} metadata is invalid.`)
  }
  assertNoFilesystemLeak(metadata, `chord ${String(entry.stableId)}`)
  if (metadata.song_stable_id !== songStableId) {
    throw new JamCatalogError(
      "malformed",
      `Chord ${String(entry.stableId)} song linkage is invalid.`,
    )
  }
  const block = metadata.block
  if (!isPlainObject(block)) {
    throw new JamCatalogError("malformed", `Chord ${entry.stableId} block is missing.`)
  }
  const symbol = requireString(block.chord_name, `chord ${entry.stableId}.chord_name`)
  const sectionLabel = requireString(
    block.section_label,
    `chord ${entry.stableId}.section_label`,
  )
  if (!isFiniteNumber(block.start_bar) || !isFiniteNumber(block.start_beat)) {
    throw new JamCatalogError(
      "malformed",
      `Chord ${entry.stableId} timing fields are invalid.`,
    )
  }
  if (!isFiniteNumber(block.length_beats) || block.length_beats <= 0) {
    throw new JamCatalogError(
      "malformed",
      `Chord ${entry.stableId} length_beats is invalid.`,
    )
  }
  return {
    symbol,
    sectionLabel,
    startBar: Math.trunc(block.start_bar),
    startBeat: block.start_beat,
    lengthBeats: block.length_beats,
  }
}

function parseSection(
  entry: Record<string, unknown>,
  songStableId: string,
  chords: JamChordSummary[],
): JamSectionSummary {
  const stableId = requireString(entry.stableId, "factory_clip.stableId")
  const metadata = entry.metadata
  if (!isPlainObject(metadata)) {
    throw new JamCatalogError("malformed", `Clip ${stableId} metadata is invalid.`)
  }
  assertNoFilesystemLeak(metadata, `clip ${stableId}`)
  if (metadata.song_stable_id !== songStableId) {
    throw new JamCatalogError("malformed", `Clip ${stableId} song linkage is invalid.`)
  }
  const clip = metadata.clip
  if (!isPlainObject(clip)) {
    throw new JamCatalogError("malformed", `Clip ${stableId} clip object is missing.`)
  }
  const name = requireString(clip.name, `clip ${stableId}.name`)
  if (!isFiniteNumber(clip.bars) || clip.bars < 0) {
    throw new JamCatalogError("malformed", `Clip ${stableId}.bars is invalid.`)
  }
  if (!isFiniteNumber(clip.clip_order)) {
    throw new JamCatalogError("malformed", `Clip ${stableId}.clip_order is invalid.`)
  }
  const main = parseArrangerMain(clip.style_variation, `clip ${stableId}.style_variation`)
  const sectionChords = chords.filter(
    (chord) => chord.sectionLabel === name || chord.sectionLabel === main,
  )
  if (sectionChords.length > JAM_CATALOG_MAX_CHORDS_PER_SECTION) {
    throw new JamCatalogError(
      "limit_exceeded",
      `Clip ${stableId} exceeds chord limit ${JAM_CATALOG_MAX_CHORDS_PER_SECTION}.`,
    )
  }
  return {
    stableId,
    name,
    bars: Math.trunc(clip.bars),
    order: Math.trunc(clip.clip_order),
    main,
    hasAsset: entry.hasAsset === true,
    chords: sectionChords,
  }
}

function parseSong(
  songEntry: Record<string, unknown>,
  clipEntries: Record<string, unknown>[],
  chordEntries: Record<string, unknown>[],
): JamSongSummary {
  const stableId = requireString(songEntry.stableId, "factory_song.stableId")
  const metadata = songEntry.metadata
  if (!isPlainObject(metadata)) {
    throw new JamCatalogError("malformed", `Song ${stableId} metadata is invalid.`)
  }
  assertNoFilesystemLeak(metadata, `song ${stableId}`)
  const song = metadata.song
  if (!isPlainObject(song)) {
    throw new JamCatalogError("malformed", `Song ${stableId} song object is missing.`)
  }
  const title = requireString(song.name, `song ${stableId}.name`)
  const category = requireString(song.category, `song ${stableId}.category`)
  if (!isFiniteNumber(song.bpm) || song.bpm <= 0) {
    throw new JamCatalogError("malformed", `Song ${stableId}.bpm is invalid.`)
  }
  const key = requireString(song.key, `song ${stableId}.key`)
  const timeSignature = parseTimeSignature(song, `song ${stableId}`)
  const description = optionalString(song.description)

  const chords = chordEntries.map((entry) => parseChordBlock(entry, stableId))
  if (clipEntries.length > JAM_CATALOG_MAX_SECTIONS_PER_SONG) {
    throw new JamCatalogError(
      "limit_exceeded",
      `Song ${stableId} exceeds section limit ${JAM_CATALOG_MAX_SECTIONS_PER_SONG}.`,
    )
  }
  const sections = clipEntries
    .map((entry) => parseSection(entry, stableId, chords))
    .sort((a, b) => a.order - b.order || a.stableId.localeCompare(b.stableId))

  return {
    stableId,
    title,
    category,
    tempo: song.bpm,
    key,
    timeSignature,
    ...(description ? { description } : {}),
    sections,
  }
}

/** Map catalog model_key values onto supported YamahaModelId values. */
export function resolveYamahaModel(modelKey: unknown): YamahaModelId | null {
  if (typeof modelKey !== "string" || !modelKey) return null
  const normalized = modelKey.toLowerCase().replace(/[^a-z0-9]/g, "")
  if (normalized === "genos2") return "genos2"
  if (normalized === "genos" || normalized === "genos1") return "genos"
  if (normalized === "tyros5") return "tyros5"
  if (normalized === "tyros4") return "tyros4"
  return null
}

export function isSupportedYamahaModel(value: string): value is YamahaModelId {
  return (JAM_SUPPORTED_MODELS as readonly string[]).includes(value)
}

export function styleStableId(model: YamahaModelId, styleNumber: number): string {
  return `keyboard_style:${model}:${styleNumber}`
}

function parseStylesFromKeyboardEntry(entry: Record<string, unknown>): {
  model: YamahaModelId
  styles: JamStyleSummary[]
} | null {
  const metadata = entry.metadata
  if (!isPlainObject(metadata)) {
    throw new JamCatalogError(
      "malformed",
      `Keyboard entry ${String(entry.stableId)} metadata is invalid.`,
    )
  }
  assertNoFilesystemLeak(metadata, `keyboard ${String(entry.stableId)}`)
  const modelObj = metadata.model
  if (!isPlainObject(modelObj)) {
    throw new JamCatalogError(
      "malformed",
      `Keyboard entry ${String(entry.stableId)} model is missing.`,
    )
  }
  const model = resolveYamahaModel(modelObj.model_key)
  if (!model) {
    // Desktop exports include PSR and other models Jam does not support yet.
    return null
  }
  const stylesRaw = metadata.styles
  if (!Array.isArray(stylesRaw)) {
    throw new JamCatalogError(
      "malformed",
      `Keyboard entry ${String(entry.stableId)} styles must be an array.`,
    )
  }
  if (stylesRaw.length > JAM_CATALOG_MAX_STYLES_PER_MODEL) {
    throw new JamCatalogError(
      "limit_exceeded",
      `Keyboard model ${model} exceeds style limit ${JAM_CATALOG_MAX_STYLES_PER_MODEL}.`,
    )
  }

  const styles: JamStyleSummary[] = []
  const seenNumbers = new Set<number>()
  for (const styleValue of stylesRaw) {
    if (!isPlainObject(styleValue)) {
      throw new JamCatalogError("malformed", `Style row under ${model} is not an object.`)
    }
    const name = requireString(styleValue.name, `style.name (${model})`)
    // Desktop rows can carry style_number 0 / null placeholders — skip them.
    if (!isFiniteNumber(styleValue.style_number) || styleValue.style_number < 1) {
      continue
    }
    const styleNumber = Math.trunc(styleValue.style_number)
    if (seenNumbers.has(styleNumber)) {
      throw new JamCatalogError(
        "malformed",
        `Duplicate style_number ${styleNumber} for ${model}.`,
      )
    }
    seenNumbers.add(styleNumber)
    const category = optionalString(styleValue.category)
    const bpm =
      isFiniteNumber(styleValue.bpm) && styleValue.bpm > 0 ? styleValue.bpm : undefined
    const timeSignature = optionalString(styleValue.time_signature)
    styles.push({
      stableId: styleStableId(model, styleNumber),
      model,
      name,
      styleNumber,
      ...(category ? { category } : {}),
      ...(bpm !== undefined ? { bpm } : {}),
      ...(timeSignature ? { timeSignature } : {}),
    })
  }
  styles.sort(
    (a, b) => a.styleNumber - b.styleNumber || a.name.localeCompare(b.name),
  )
  return { model, styles }
}

type RawEntry = {
  stableId: string
  section: string
  kind: string
  metadata: Record<string, unknown>
  hasAsset: boolean
}

function parsePublicEntry(raw: unknown, index: number): RawEntry {
  if (!isPlainObject(raw)) {
    throw new JamCatalogError("malformed", `entries[${index}] must be an object.`)
  }
  const stableId = requireString(raw.stableId, `entries[${index}].stableId`)
  const section = requireString(raw.section, `entries[${index}].section`)
  const kind = requireString(raw.kind, `entries[${index}].kind`)
  if (!isPlainObject(raw.metadata)) {
    throw new JamCatalogError("malformed", `entries[${index}].metadata must be an object.`)
  }
  if (typeof raw.hasAsset !== "boolean") {
    throw new JamCatalogError("malformed", `entries[${index}].hasAsset must be a boolean.`)
  }
  // Fail closed: never accept leaked absolute paths in public metadata.
  assertNoFilesystemLeak(raw.metadata, `entries[${index}].metadata`)
  return {
    stableId,
    section,
    kind,
    metadata: raw.metadata,
    hasAsset: raw.hasAsset,
  }
}

/**
 * Parse an A11 GET /api/catalog/jam-player payload into safe Jam summaries.
 * Strips internal catalog version ids, blob reference ids, and nested importer noise.
 */
export function parseJamCatalogResponse(raw: unknown): JamCatalogSnapshot {
  if (!isPlainObject(raw)) {
    throw new JamCatalogError("malformed", "Catalog response must be an object.")
  }
  if (raw.serviceKey !== JAM_CATALOG_SERVICE_KEY) {
    throw new JamCatalogError(
      "malformed",
      `Expected serviceKey ${JAM_CATALOG_SERVICE_KEY}.`,
    )
  }
  if (raw.catalogExportVersion !== JAM_CATALOG_EXPORT_VERSION) {
    throw new JamCatalogError(
      "unsupported_schema",
      `Unsupported catalogExportVersion: ${String(raw.catalogExportVersion)}.`,
    )
  }
  if (raw.schemaVersion !== JAM_CATALOG_SCHEMA_VERSION) {
    throw new JamCatalogError(
      "unsupported_schema",
      `Unsupported schemaVersion: ${String(raw.schemaVersion)}.`,
    )
  }
  const catalogRevision = requireString(raw.contentTreeSha256, "contentTreeSha256")
  if (!Array.isArray(raw.entries)) {
    throw new JamCatalogError("malformed", "Catalog response must include entries[].")
  }
  if (raw.entries.length > JAM_CATALOG_MAX_ENTRIES) {
    throw new JamCatalogError(
      "limit_exceeded",
      `Catalog entries exceed limit ${JAM_CATALOG_MAX_ENTRIES}.`,
    )
  }

  const entries = raw.entries.map(parsePublicEntry)
  const songsRaw: RawEntry[] = []
  const clipsBySong = new Map<string, RawEntry[]>()
  const chordsBySong = new Map<string, RawEntry[]>()
  const keyboardEntries: RawEntry[] = []

  for (const entry of entries) {
    if (entry.section === "factory_songs") {
      if (entry.kind === "factory_song") {
        songsRaw.push(entry)
        continue
      }
      if (entry.kind === "factory_clip") {
        const songId = entry.metadata.song_stable_id
        if (typeof songId !== "string" || !songId) {
          throw new JamCatalogError(
            "malformed",
            `factory_clip ${entry.stableId} missing song_stable_id.`,
          )
        }
        const list = clipsBySong.get(songId) ?? []
        list.push(entry)
        clipsBySong.set(songId, list)
        continue
      }
      if (entry.kind === "factory_chord_block") {
        const songId = entry.metadata.song_stable_id
        if (typeof songId !== "string" || !songId) {
          throw new JamCatalogError(
            "malformed",
            `factory_chord_block ${entry.stableId} missing song_stable_id.`,
          )
        }
        const list = chordsBySong.get(songId) ?? []
        list.push(entry)
        chordsBySong.set(songId, list)
        continue
      }
      // roman_progression_pattern and clip variations are ignored for Jam summaries.
      if (
        entry.kind === "roman_progression_pattern" ||
        entry.kind === "factory_clip_variation"
      ) {
        continue
      }
      throw new JamCatalogError(
        "malformed",
        `Unknown factory_songs kind: ${entry.kind}.`,
      )
    }
    if (entry.section === "keyboard_catalog") {
      if (entry.kind !== "keyboard_model") {
        throw new JamCatalogError(
          "malformed",
          `Unknown keyboard_catalog kind: ${entry.kind}.`,
        )
      }
      keyboardEntries.push(entry)
      continue
    }
    throw new JamCatalogError(
      "malformed",
      `Unexpected jam-player section: ${entry.section}.`,
    )
  }

  if (songsRaw.length > JAM_CATALOG_MAX_SONGS) {
    throw new JamCatalogError(
      "limit_exceeded",
      `Catalog songs exceed limit ${JAM_CATALOG_MAX_SONGS}.`,
    )
  }

  const songs = songsRaw
    .map((songEntry) =>
      parseSong(
        songEntry,
        clipsBySong.get(songEntry.stableId) ?? [],
        chordsBySong.get(songEntry.stableId) ?? [],
      ),
    )
    .sort((a, b) => a.title.localeCompare(b.title) || a.stableId.localeCompare(b.stableId))

  const stylesByModel: Record<YamahaModelId, JamStyleSummary[]> = {
    genos: [],
    genos2: [],
    tyros4: [],
    tyros5: [],
  }
  for (const keyboard of keyboardEntries) {
    const parsed = parseStylesFromKeyboardEntry(keyboard)
    if (!parsed) continue
    const { model, styles } = parsed
    if (stylesByModel[model].length > 0) {
      throw new JamCatalogError(
        "malformed",
        `Duplicate keyboard_catalog entry for model ${model}.`,
      )
    }
    stylesByModel[model] = styles
  }

  return {
    catalogRevision,
    catalogExportVersion: JAM_CATALOG_EXPORT_VERSION,
    schemaVersion: JAM_CATALOG_SCHEMA_VERSION,
    songs,
    stylesByModel,
  }
}

export function parseAuthorizedAssetResponse(raw: unknown): {
  contentType: string
  byteSize: number
  filename: string
  contentDisposition: string
  url: string
  expiresAt: string
} {
  if (!isPlainObject(raw)) {
    throw new JamCatalogError("malformed", "Asset response must be an object.")
  }
  const contentType = requireString(raw.contentType, "asset.contentType")
  if (!isFiniteNumber(raw.byteSize) || raw.byteSize < 0) {
    throw new JamCatalogError("malformed", "asset.byteSize is invalid.")
  }
  const filename = requireString(raw.filename, "asset.filename")
  if (looksLikeFilesystemLeak(filename)) {
    throw new JamCatalogError("malformed", "asset.filename exposes filesystem data.")
  }
  const contentDisposition = requireString(
    raw.contentDisposition,
    "asset.contentDisposition",
  )
  const url = requireString(raw.presignedUrl, "asset.presignedUrl")
  const expiresAt = requireString(raw.expiresAt, "asset.expiresAt")
  if (!Number.isFinite(Date.parse(expiresAt))) {
    throw new JamCatalogError("malformed", "asset.expiresAt is not a valid ISO timestamp.")
  }
  // Intentionally omit blobReferenceId — opaque clip stableId is enough.
  return {
    contentType,
    byteSize: Math.trunc(raw.byteSize),
    filename,
    contentDisposition,
    url,
    expiresAt,
  }
}
