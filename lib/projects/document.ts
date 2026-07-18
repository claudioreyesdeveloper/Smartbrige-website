import {
  PROJECT_BLOBS_MAX,
  PROJECT_CHORDS_PER_SECTION_MAX,
  PROJECT_DOCUMENT_MAX_BYTES,
  PROJECT_LYRICS_TEXT_MAX,
  PROJECT_MIXER_CHANNELS_MAX,
  PROJECT_SECTIONS_MAX,
  PROJECT_SOLOS_MAX,
  PROJECT_TITLE_MAX_LENGTH,
} from "@/lib/projects/limits"
import { ProjectError } from "@/lib/projects/errors"

export const PROJECT_DOCUMENT_SCHEMA_VERSION = 1 as const

export type ProjectStylePart =
  | "intro"
  | "mainA"
  | "mainB"
  | "mainC"
  | "mainD"
  | "fill"
  | "break"
  | "ending"

export type ProjectChord = {
  symbol: string
  startBeat: number
  durationBeats?: number
}

export type ProjectSection = {
  id: string
  name: string
  stylePart?: ProjectStylePart
  chords: ProjectChord[]
  bars?: number
}

export type ProjectStyleRef = {
  id?: string
  name?: string
  path?: string
}

export type ProjectSong = {
  title: string
  tempo: number
  key: string
  style?: ProjectStyleRef
  sections: ProjectSection[]
}

export type ProjectJamState = {
  factorySongStableId: string
  styleStableId: string
  model: "genos" | "genos2" | "tyros4" | "tyros5"
  loop: boolean
  generationId?: string
  candidateId?: string
  selectedChordsBySection?: Record<string, ProjectChord[]>
}

/** Reproducible generation recipe; engines are not implemented here. */
export type ProjectRecipe = {
  sourceId: string
  engineVersion: string
  settings?: Record<string, unknown>
  chords?: ProjectChord[]
  tempo?: number
  seed?: number
  renderBlobId?: string
}

export type ProjectSoloTake = {
  id: string
  instrument?: string
  style?: string
  recipe: ProjectRecipe
  selected?: boolean
}

export type ProjectLyricSyllable = {
  text: string
  noteIndex?: number
  tick?: number
}

export type ProjectLyrics = {
  text?: string
  syllables?: ProjectLyricSyllable[]
  recipeReferenceId?: string
  renderReferenceId?: string
}

export type ProjectMixerChannel = {
  part: number
  volume?: number
  pan?: number
  reverb?: number
  chorus?: number
  mute?: boolean
  voiceId?: string
}

export type ProjectMixerState = {
  channels: ProjectMixerChannel[]
}

export type ProjectBlobPurpose = "render" | "upload" | "factory"

export type ProjectBlobRef = {
  blobReferenceId: string
  purpose: ProjectBlobPurpose
  label?: string
}

export type ProjectDocumentV1 = {
  schemaVersion: typeof PROJECT_DOCUMENT_SCHEMA_VERSION
  song: ProjectSong
  bass?: ProjectRecipe
  drums?: ProjectRecipe
  solos?: ProjectSoloTake[]
  lyrics?: ProjectLyrics
  mixer?: ProjectMixerState
  blobs?: ProjectBlobRef[]
  jam?: ProjectJamState
}

export type ProjectDocument = ProjectDocumentV1

const STYLE_PARTS = new Set<ProjectStylePart>([
  "intro",
  "mainA",
  "mainB",
  "mainC",
  "mainD",
  "fill",
  "break",
  "ending",
])

const BLOB_PURPOSES = new Set<ProjectBlobPurpose>(["render", "upload", "factory"])
const YAMAHA_MODELS = new Set<ProjectJamState["model"]>([
  "genos",
  "genos2",
  "tyros4",
  "tyros5",
])

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function assertString(value: unknown, label: string, maxLength?: number): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ProjectError("validation", `${label} must be a non-empty string.`)
  }
  const trimmed = value.trim()
  if (maxLength !== undefined && trimmed.length > maxLength) {
    throw new ProjectError("validation", `${label} exceeds maximum length ${maxLength}.`)
  }
  return trimmed
}

function assertOptionalString(value: unknown, label: string, maxLength = 500): string | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value !== "string") {
    throw new ProjectError("validation", `${label} must be a string.`)
  }
  if (value.length > maxLength) {
    throw new ProjectError("validation", `${label} exceeds maximum length ${maxLength}.`)
  }
  return value
}

function assertFiniteNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new ProjectError("validation", `${label} must be a finite number.`)
  }
  return value
}

function assertOptionalFiniteNumber(value: unknown, label: string): number | undefined {
  if (value === undefined || value === null) return undefined
  return assertFiniteNumber(value, label)
}

function assertBoolean(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") {
    throw new ProjectError("validation", `${label} must be a boolean.`)
  }
  return value
}

function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength
}

export function measureDocumentBytes(document: unknown): number {
  return utf8ByteLength(JSON.stringify(document))
}

export function assertDocumentWithinSizeLimit(document: unknown): void {
  const bytes = measureDocumentBytes(document)
  if (bytes > PROJECT_DOCUMENT_MAX_BYTES) {
    throw new ProjectError(
      "payload_too_large",
      `Project document exceeds ${PROJECT_DOCUMENT_MAX_BYTES} bytes.`,
    )
  }
}

function parseChord(raw: unknown, label: string): ProjectChord {
  if (!isPlainObject(raw)) {
    throw new ProjectError("validation", `${label} must be an object.`)
  }
  const chord: ProjectChord = {
    symbol: assertString(raw.symbol, `${label}.symbol`, 64),
    startBeat: assertFiniteNumber(raw.startBeat, `${label}.startBeat`),
  }
  const durationBeats = assertOptionalFiniteNumber(raw.durationBeats, `${label}.durationBeats`)
  if (durationBeats !== undefined) chord.durationBeats = durationBeats
  return chord
}

function parseChords(raw: unknown, label: string): ProjectChord[] {
  if (!Array.isArray(raw)) {
    throw new ProjectError("validation", `${label} must be an array.`)
  }
  if (raw.length > PROJECT_CHORDS_PER_SECTION_MAX) {
    throw new ProjectError(
      "validation",
      `${label} exceeds maximum of ${PROJECT_CHORDS_PER_SECTION_MAX} chords.`,
    )
  }
  return raw.map((item, index) => parseChord(item, `${label}[${index}]`))
}

function parseStylePart(raw: unknown, label: string): ProjectStylePart | undefined {
  if (raw === undefined || raw === null) return undefined
  if (typeof raw !== "string" || !STYLE_PARTS.has(raw as ProjectStylePart)) {
    throw new ProjectError("validation", `${label} is not a valid style part.`)
  }
  return raw as ProjectStylePart
}

function parseSection(raw: unknown, label: string): ProjectSection {
  if (!isPlainObject(raw)) {
    throw new ProjectError("validation", `${label} must be an object.`)
  }
  const section: ProjectSection = {
    id: assertString(raw.id, `${label}.id`, 128),
    name: assertString(raw.name, `${label}.name`, 200),
    chords: parseChords(raw.chords ?? [], `${label}.chords`),
  }
  const stylePart = parseStylePart(raw.stylePart, `${label}.stylePart`)
  if (stylePart !== undefined) section.stylePart = stylePart
  const bars = assertOptionalFiniteNumber(raw.bars, `${label}.bars`)
  if (bars !== undefined) section.bars = bars
  return section
}

function parseStyleRef(raw: unknown, label: string): ProjectStyleRef | undefined {
  if (raw === undefined || raw === null) return undefined
  if (!isPlainObject(raw)) {
    throw new ProjectError("validation", `${label} must be an object.`)
  }
  const style: ProjectStyleRef = {}
  const id = assertOptionalString(raw.id, `${label}.id`, 200)
  const name = assertOptionalString(raw.name, `${label}.name`, 200)
  const path = assertOptionalString(raw.path, `${label}.path`, 500)
  if (id !== undefined) style.id = id
  if (name !== undefined) style.name = name
  if (path !== undefined) style.path = path
  return style
}

function parseRecipe(raw: unknown, label: string): ProjectRecipe {
  if (!isPlainObject(raw)) {
    throw new ProjectError("validation", `${label} must be an object.`)
  }
  const recipe: ProjectRecipe = {
    sourceId: assertString(raw.sourceId, `${label}.sourceId`, 256),
    engineVersion: assertString(raw.engineVersion, `${label}.engineVersion`, 64),
  }
  if (raw.settings !== undefined) {
    if (!isPlainObject(raw.settings)) {
      throw new ProjectError("validation", `${label}.settings must be an object.`)
    }
    recipe.settings = raw.settings
  }
  if (raw.chords !== undefined) {
    recipe.chords = parseChords(raw.chords, `${label}.chords`)
  }
  const tempo = assertOptionalFiniteNumber(raw.tempo, `${label}.tempo`)
  if (tempo !== undefined) recipe.tempo = tempo
  const seed = assertOptionalFiniteNumber(raw.seed, `${label}.seed`)
  if (seed !== undefined) recipe.seed = seed
  const renderBlobId = assertOptionalString(raw.renderBlobId, `${label}.renderBlobId`, 128)
  if (renderBlobId !== undefined) recipe.renderBlobId = renderBlobId
  return recipe
}

function parseSoloTake(raw: unknown, label: string): ProjectSoloTake {
  if (!isPlainObject(raw)) {
    throw new ProjectError("validation", `${label} must be an object.`)
  }
  const take: ProjectSoloTake = {
    id: assertString(raw.id, `${label}.id`, 128),
    recipe: parseRecipe(raw.recipe, `${label}.recipe`),
  }
  const instrument = assertOptionalString(raw.instrument, `${label}.instrument`, 128)
  const style = assertOptionalString(raw.style, `${label}.style`, 128)
  if (instrument !== undefined) take.instrument = instrument
  if (style !== undefined) take.style = style
  if (raw.selected !== undefined) take.selected = assertBoolean(raw.selected, `${label}.selected`)
  return take
}

function parseLyrics(raw: unknown, label: string): ProjectLyrics | undefined {
  if (raw === undefined || raw === null) return undefined
  if (!isPlainObject(raw)) {
    throw new ProjectError("validation", `${label} must be an object.`)
  }
  const lyrics: ProjectLyrics = {}
  if (raw.text !== undefined) {
    if (typeof raw.text !== "string") {
      throw new ProjectError("validation", `${label}.text must be a string.`)
    }
    if (raw.text.length > PROJECT_LYRICS_TEXT_MAX) {
      throw new ProjectError("validation", `${label}.text exceeds maximum length.`)
    }
    lyrics.text = raw.text
  }
  if (raw.syllables !== undefined) {
    if (!Array.isArray(raw.syllables)) {
      throw new ProjectError("validation", `${label}.syllables must be an array.`)
    }
    lyrics.syllables = raw.syllables.map((item, index) => {
      if (!isPlainObject(item)) {
        throw new ProjectError("validation", `${label}.syllables[${index}] must be an object.`)
      }
      const syllable: ProjectLyricSyllable = {
        text: assertString(item.text, `${label}.syllables[${index}].text`, 64),
      }
      const noteIndex = assertOptionalFiniteNumber(
        item.noteIndex,
        `${label}.syllables[${index}].noteIndex`,
      )
      const tick = assertOptionalFiniteNumber(item.tick, `${label}.syllables[${index}].tick`)
      if (noteIndex !== undefined) syllable.noteIndex = noteIndex
      if (tick !== undefined) syllable.tick = tick
      return syllable
    })
  }
  const recipeReferenceId = assertOptionalString(
    raw.recipeReferenceId,
    `${label}.recipeReferenceId`,
    128,
  )
  const renderReferenceId = assertOptionalString(
    raw.renderReferenceId,
    `${label}.renderReferenceId`,
    128,
  )
  if (recipeReferenceId !== undefined) lyrics.recipeReferenceId = recipeReferenceId
  if (renderReferenceId !== undefined) lyrics.renderReferenceId = renderReferenceId
  return lyrics
}

function parseMixer(raw: unknown, label: string): ProjectMixerState | undefined {
  if (raw === undefined || raw === null) return undefined
  if (!isPlainObject(raw)) {
    throw new ProjectError("validation", `${label} must be an object.`)
  }
  if (!Array.isArray(raw.channels)) {
    throw new ProjectError("validation", `${label}.channels must be an array.`)
  }
  if (raw.channels.length > PROJECT_MIXER_CHANNELS_MAX) {
    throw new ProjectError(
      "validation",
      `${label}.channels exceeds maximum of ${PROJECT_MIXER_CHANNELS_MAX}.`,
    )
  }
  return {
    channels: raw.channels.map((item, index) => {
      if (!isPlainObject(item)) {
        throw new ProjectError("validation", `${label}.channels[${index}] must be an object.`)
      }
      const channel: ProjectMixerChannel = {
        part: assertFiniteNumber(item.part, `${label}.channels[${index}].part`),
      }
      if (channel.part < 1 || channel.part > 32 || !Number.isInteger(channel.part)) {
        throw new ProjectError("validation", `${label}.channels[${index}].part must be 1–32.`)
      }
      const volume = assertOptionalFiniteNumber(item.volume, `${label}.channels[${index}].volume`)
      const pan = assertOptionalFiniteNumber(item.pan, `${label}.channels[${index}].pan`)
      const reverb = assertOptionalFiniteNumber(item.reverb, `${label}.channels[${index}].reverb`)
      const chorus = assertOptionalFiniteNumber(item.chorus, `${label}.channels[${index}].chorus`)
      if (volume !== undefined) channel.volume = volume
      if (pan !== undefined) channel.pan = pan
      if (reverb !== undefined) channel.reverb = reverb
      if (chorus !== undefined) channel.chorus = chorus
      if (item.mute !== undefined) {
        channel.mute = assertBoolean(item.mute, `${label}.channels[${index}].mute`)
      }
      const voiceId = assertOptionalString(item.voiceId, `${label}.channels[${index}].voiceId`, 128)
      if (voiceId !== undefined) channel.voiceId = voiceId
      return channel
    }),
  }
}

function parseBlobRef(raw: unknown, label: string): ProjectBlobRef {
  if (!isPlainObject(raw)) {
    throw new ProjectError("validation", `${label} must be an object.`)
  }
  if (typeof raw.purpose !== "string" || !BLOB_PURPOSES.has(raw.purpose as ProjectBlobPurpose)) {
    throw new ProjectError("validation", `${label}.purpose is invalid.`)
  }
  const ref: ProjectBlobRef = {
    blobReferenceId: assertString(raw.blobReferenceId, `${label}.blobReferenceId`, 128),
    purpose: raw.purpose as ProjectBlobPurpose,
  }
  const labelValue = assertOptionalString(raw.label, `${label}.label`, 200)
  if (labelValue !== undefined) ref.label = labelValue
  return ref
}

function parseJamState(raw: unknown): ProjectJamState | undefined {
  if (raw === undefined || raw === null) return undefined
  if (!isPlainObject(raw)) {
    throw new ProjectError("validation", "jam must be an object.")
  }
  if (typeof raw.model !== "string" || !YAMAHA_MODELS.has(raw.model as ProjectJamState["model"])) {
    throw new ProjectError("validation", "jam.model is not a supported Yamaha model.")
  }
  const jam: ProjectJamState = {
    factorySongStableId: assertString(raw.factorySongStableId, "jam.factorySongStableId", 128),
    styleStableId: assertString(raw.styleStableId, "jam.styleStableId", 128),
    model: raw.model as ProjectJamState["model"],
    loop: assertBoolean(raw.loop, "jam.loop"),
  }
  const generationId = assertOptionalString(raw.generationId, "jam.generationId", 128)
  const candidateId = assertOptionalString(raw.candidateId, "jam.candidateId", 128)
  if (generationId) jam.generationId = generationId
  if (candidateId) jam.candidateId = candidateId
  if (raw.selectedChordsBySection !== undefined) {
    if (!isPlainObject(raw.selectedChordsBySection)) {
      throw new ProjectError("validation", "jam.selectedChordsBySection must be an object.")
    }
    const entries = Object.entries(raw.selectedChordsBySection)
    if (entries.length > PROJECT_SECTIONS_MAX) {
      throw new ProjectError(
        "validation",
        `jam.selectedChordsBySection exceeds maximum of ${PROJECT_SECTIONS_MAX} sections.`,
      )
    }
    jam.selectedChordsBySection = Object.fromEntries(
      entries.map(([sectionId, chords]) => [
        assertString(sectionId, "jam.selectedChordsBySection key", 128),
        parseChords(chords, `jam.selectedChordsBySection.${sectionId}`),
      ]),
    )
  }
  return jam
}

function parseSong(raw: unknown, label: string): ProjectSong {
  if (!isPlainObject(raw)) {
    throw new ProjectError("validation", `${label} must be an object.`)
  }
  if (!Array.isArray(raw.sections)) {
    throw new ProjectError("validation", `${label}.sections must be an array.`)
  }
  if (raw.sections.length > PROJECT_SECTIONS_MAX) {
    throw new ProjectError(
      "validation",
      `${label}.sections exceeds maximum of ${PROJECT_SECTIONS_MAX}.`,
    )
  }
  const song: ProjectSong = {
    title: assertString(raw.title, `${label}.title`, PROJECT_TITLE_MAX_LENGTH),
    tempo: assertFiniteNumber(raw.tempo, `${label}.tempo`),
    key: assertString(raw.key, `${label}.key`, 32),
    sections: raw.sections.map((item, index) => parseSection(item, `${label}.sections[${index}]`)),
  }
  if (song.tempo <= 0 || song.tempo > 400) {
    throw new ProjectError("validation", `${label}.tempo must be between 1 and 400.`)
  }
  const style = parseStyleRef(raw.style, `${label}.style`)
  if (style !== undefined) song.style = style
  return song
}

function parseDocumentV1(raw: Record<string, unknown>): ProjectDocumentV1 {
  const document: ProjectDocumentV1 = {
    schemaVersion: PROJECT_DOCUMENT_SCHEMA_VERSION,
    song: parseSong(raw.song, "song"),
  }

  if (raw.bass !== undefined) document.bass = parseRecipe(raw.bass, "bass")
  if (raw.drums !== undefined) document.drums = parseRecipe(raw.drums, "drums")

  if (raw.solos !== undefined) {
    if (!Array.isArray(raw.solos)) {
      throw new ProjectError("validation", "solos must be an array.")
    }
    if (raw.solos.length > PROJECT_SOLOS_MAX) {
      throw new ProjectError("validation", `solos exceeds maximum of ${PROJECT_SOLOS_MAX}.`)
    }
    document.solos = raw.solos.map((item, index) => parseSoloTake(item, `solos[${index}]`))
  }

  const lyrics = parseLyrics(raw.lyrics, "lyrics")
  if (lyrics !== undefined) document.lyrics = lyrics

  const mixer = parseMixer(raw.mixer, "mixer")
  if (mixer !== undefined) document.mixer = mixer

  if (raw.blobs !== undefined) {
    if (!Array.isArray(raw.blobs)) {
      throw new ProjectError("validation", "blobs must be an array.")
    }
    if (raw.blobs.length > PROJECT_BLOBS_MAX) {
      throw new ProjectError("validation", `blobs exceeds maximum of ${PROJECT_BLOBS_MAX}.`)
    }
    document.blobs = raw.blobs.map((item, index) => parseBlobRef(item, `blobs[${index}]`))
  }

  const jam = parseJamState(raw.jam)
  if (jam !== undefined) document.jam = jam

  return document
}

/**
 * Migrates older / unversioned project JSON into schema version 1.
 * Accepts legacy shapes that used `version` instead of `schemaVersion`,
 * or flat song fields without a nested `song` object.
 */
export function migrateProjectDocument(raw: unknown): ProjectDocument {
  if (!isPlainObject(raw)) {
    throw new ProjectError("validation", "Project document must be an object.")
  }

  const schemaVersion =
    typeof raw.schemaVersion === "number"
      ? raw.schemaVersion
      : typeof raw.version === "number"
        ? raw.version
        : 0

  if (schemaVersion > PROJECT_DOCUMENT_SCHEMA_VERSION) {
    throw new ProjectError(
      "validation",
      `Unsupported project document schema version ${schemaVersion}.`,
    )
  }

  if (schemaVersion === PROJECT_DOCUMENT_SCHEMA_VERSION) {
    if (!isPlainObject(raw.song)) {
      throw new ProjectError("validation", "song is required for schema version 1.")
    }
    return parseDocumentV1(raw)
  }

  // Legacy / version 0: either nested song or flat fields.
  const songSource = isPlainObject(raw.song)
    ? raw.song
    : {
        title: raw.title ?? "Untitled",
        tempo: raw.tempo ?? 120,
        key: raw.key ?? "C",
        style: raw.style,
        sections: Array.isArray(raw.sections) ? raw.sections : [],
      }

  const migrated: Record<string, unknown> = {
    schemaVersion: PROJECT_DOCUMENT_SCHEMA_VERSION,
    song: songSource,
  }
  if (raw.bass !== undefined) migrated.bass = raw.bass
  if (raw.drums !== undefined) migrated.drums = raw.drums
  if (raw.solos !== undefined) migrated.solos = raw.solos
  if (raw.lyrics !== undefined) migrated.lyrics = raw.lyrics
  if (raw.mixer !== undefined) migrated.mixer = raw.mixer
  if (raw.blobs !== undefined) migrated.blobs = raw.blobs
  if (raw.jam !== undefined) migrated.jam = raw.jam

  return parseDocumentV1(migrated)
}

export function parseAndValidateProjectDocument(raw: unknown): ProjectDocument {
  assertDocumentWithinSizeLimit(raw)
  const document = migrateProjectDocument(raw)
  assertDocumentWithinSizeLimit(document)
  return document
}

export function createEmptyProjectDocument(title = "Untitled"): ProjectDocument {
  return {
    schemaVersion: PROJECT_DOCUMENT_SCHEMA_VERSION,
    song: {
      title: title.trim() || "Untitled",
      tempo: 120,
      key: "C",
      sections: [],
    },
  }
}

export function cloneProjectDocument(document: ProjectDocument): ProjectDocument {
  return structuredClone(document)
}
