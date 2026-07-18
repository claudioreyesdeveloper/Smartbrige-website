import { JamError } from "@/lib/jam/domain/errors"
import {
  MAX_BYTES_FIELD_CHARS,
  MAX_CHORD_SYMBOL_LENGTH,
  MAX_CHORDS_PER_SECTION,
  MAX_DISPATCH_EVENT_BYTES,
  MAX_DISPATCH_EVENTS_FULL_SONG,
  MAX_DISPATCH_EVENTS_PER_SECTION,
  MAX_OPAQUE_ID_LENGTH,
  MAX_PROJECT_ID_LENGTH,
  MAX_REHARMONIZE_CANDIDATES,
  MAX_SECTION_ID_LENGTH,
  MAX_SECTION_NAME_LENGTH,
  MAX_SECTIONS,
  MAX_TOTAL_CHORDS,
} from "@/lib/jam/domain/limits"
import { isSupportedKeyboardModel } from "@/lib/jam/domain/models"
import type {
  DispatchEvent,
  DisplayChord,
  DisplayTimeline,
  JamPrepareEngineRequest,
  JamPrepareRequest,
  JamPrepareResponse,
  JamReharmonizeEngineRequest,
  JamReharmonizeRequest,
  JamReharmonizeResponse,
  MidiTarget,
  Song,
  SongSection,
  TimeSignature,
} from "@/lib/jam/domain/types"

const OPAQUE_ID = /^[A-Za-z0-9._:-]+$/
const STANDARD_BASE64_PATTERN =
  /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/
const MIDI_TARGETS: readonly MidiTarget[] = ["port1", "port2", "both"]
const DENOMINATORS = new Set([1, 2, 4, 8, 16])

function fail(message: string): never {
  throw new JamError("validation", message)
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function assertExactKeys(obj: Record<string, unknown>, allowed: readonly string[], path: string): void {
  for (const key of Object.keys(obj)) {
    if (!allowed.includes(key)) {
      fail(`Unknown field: ${path}.${key}`)
    }
  }
}

function assertString(
  value: unknown,
  path: string,
  options: { min?: number; max: number; pattern?: RegExp },
): string {
  if (typeof value !== "string") fail(`${path} must be a string`)
  if (value.length < (options.min ?? 1)) fail(`${path} is required`)
  if (value.length > options.max) fail(`${path} exceeds max length`)
  if (options.pattern && !options.pattern.test(value)) fail(`${path} has invalid format`)
  return value
}

function assertInt(
  value: unknown,
  path: string,
  options: { min: number; max: number },
): number {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    fail(`${path} must be an integer`)
  }
  if (value < options.min || value > options.max) {
    fail(`${path} out of range`)
  }
  return value
}

function assertNumber(
  value: unknown,
  path: string,
  options: { minInclusive?: number; minExclusive?: number; max: number },
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    fail(`${path} must be a finite number`)
  }
  if (
    value < (options.minInclusive ?? Number.NEGATIVE_INFINITY) ||
    value <= (options.minExclusive ?? Number.NEGATIVE_INFINITY) ||
    value > options.max
  ) {
    fail(`${path} out of range`)
  }
  return value
}

function parseOpaqueId(value: unknown, path: string): string {
  return assertString(value, path, {
    max: MAX_OPAQUE_ID_LENGTH,
    pattern: OPAQUE_ID,
  })
}

function parseSectionId(value: unknown, path: string): string {
  return assertString(value, path, {
    max: MAX_SECTION_ID_LENGTH,
    pattern: OPAQUE_ID,
  })
}

function parseDisplayChord(value: unknown, path: string, strict = true): DisplayChord {
  if (!isPlainObject(value)) fail(`${path} must be an object`)
  if (strict) assertExactKeys(value, ["symbol", "startBar", "durationBars"], path)
  return {
    symbol: assertString(value.symbol, `${path}.symbol`, { max: MAX_CHORD_SYMBOL_LENGTH }),
    startBar: assertNumber(value.startBar, `${path}.startBar`, {
      minInclusive: 0,
      max: 10_000,
    }),
    durationBars: assertNumber(value.durationBars, `${path}.durationBars`, {
      minExclusive: 0,
      max: 256,
    }),
  }
}

function parseTimeSignature(value: unknown, path: string, strict = true): TimeSignature {
  if (!isPlainObject(value)) fail(`${path} must be an object`)
  if (strict) assertExactKeys(value, ["numerator", "denominator"], path)
  const numerator = assertInt(value.numerator, `${path}.numerator`, { min: 1, max: 32 })
  const denominator = assertInt(value.denominator, `${path}.denominator`, { min: 1, max: 16 })
  if (!DENOMINATORS.has(denominator)) fail(`${path}.denominator is invalid`)
  return {
    numerator,
    denominator: denominator as TimeSignature["denominator"],
  }
}

function parseSongSection(value: unknown, path: string): SongSection {
  if (!isPlainObject(value)) fail(`${path} must be an object`)
  assertExactKeys(value, ["id", "name", "barCount", "chords", "styleNumber"], path)
  const chordsRaw = value.chords
  if (!Array.isArray(chordsRaw)) fail(`${path}.chords must be an array`)
  if (chordsRaw.length < 1 || chordsRaw.length > MAX_CHORDS_PER_SECTION) {
    fail(`${path}.chords length out of range`)
  }
  const section: SongSection = {
    id: parseSectionId(value.id, `${path}.id`),
    name: assertString(value.name, `${path}.name`, { max: MAX_SECTION_NAME_LENGTH }),
    barCount: assertInt(value.barCount, `${path}.barCount`, { min: 1, max: 256 }),
    chords: chordsRaw.map((chord, index) => parseDisplayChord(chord, `${path}.chords[${index}]`)),
  }
  if (value.styleNumber !== undefined) {
    section.styleNumber = assertInt(value.styleNumber, `${path}.styleNumber`, {
      min: 1,
      max: 10_000,
    })
  }
  return section
}

function parseSong(value: unknown, path: string): Song {
  if (!isPlainObject(value)) fail(`${path} must be an object`)
  assertExactKeys(value, ["tempoBpm", "key", "timeSignature", "sections"], path)
  const sectionsRaw = value.sections
  if (!Array.isArray(sectionsRaw)) fail(`${path}.sections must be an array`)
  if (sectionsRaw.length < 1 || sectionsRaw.length > MAX_SECTIONS) {
    fail(`${path}.sections length out of range`)
  }
  const sections = sectionsRaw.map((section, index) =>
    parseSongSection(section, `${path}.sections[${index}]`),
  )
  const ids = new Set<string>()
  let totalChords = 0
  for (const section of sections) {
    if (ids.has(section.id)) fail(`duplicate section id: ${section.id}`)
    ids.add(section.id)
    totalChords += section.chords.length
  }
  if (totalChords > MAX_TOTAL_CHORDS) {
    fail(`total chords exceed limit ${MAX_TOTAL_CHORDS}`)
  }
  return {
    tempoBpm: assertInt(value.tempoBpm, `${path}.tempoBpm`, { min: 20, max: 400 }),
    key: assertString(value.key, `${path}.key`, { max: 16 }),
    timeSignature: parseTimeSignature(value.timeSignature, `${path}.timeSignature`),
    sections,
  }
}

function parseModel(value: unknown, path: string) {
  if (typeof value !== "string" || !isSupportedKeyboardModel(value)) {
    fail(`${path} must be a supported keyboard model`)
  }
  return value
}

function parseProjectId(value: unknown): string {
  return assertString(value, "projectId", {
    max: MAX_PROJECT_ID_LENGTH,
    pattern: OPAQUE_ID,
  })
}

export function parseJamPrepareRequest(value: unknown): JamPrepareRequest {
  if (!isPlainObject(value)) fail("Request body must be a JSON object.")
  assertExactKeys(value, ["projectId", "model", "song"], "body")
  return {
    projectId: parseProjectId(value.projectId),
    model: parseModel(value.model, "model"),
    song: parseSong(value.song, "song"),
  }
}

export function toEnginePrepareRequest(request: JamPrepareRequest): JamPrepareEngineRequest {
  return { model: request.model, song: request.song }
}

export function parseJamReharmonizeRequest(value: unknown): JamReharmonizeRequest {
  if (!isPlainObject(value)) fail("Request body must be a JSON object.")
  assertExactKeys(
    value,
    [
      "projectId",
      "model",
      "scope",
      "sectionId",
      "key",
      "chords",
      "candidateCount",
      "category",
    ],
    "body",
  )
  if (value.scope !== "section" && value.scope !== "song") {
    fail("scope must be section or song")
  }
  const chordsRaw = value.chords
  if (!Array.isArray(chordsRaw)) fail("chords must be an array")
  if (chordsRaw.length < 1 || chordsRaw.length > MAX_TOTAL_CHORDS) {
    fail("chords length out of range")
  }
  const request: JamReharmonizeRequest = {
    projectId: parseProjectId(value.projectId),
    model: parseModel(value.model, "model"),
    scope: value.scope,
    key: assertString(value.key, "key", { max: 16 }),
    chords: chordsRaw.map((chord, index) => parseDisplayChord(chord, `chords[${index}]`)),
  }
  if (value.sectionId !== undefined) {
    request.sectionId = parseSectionId(value.sectionId, "sectionId")
  }
  if (value.candidateCount !== undefined) {
    request.candidateCount = assertInt(value.candidateCount, "candidateCount", {
      min: 1,
      max: MAX_REHARMONIZE_CANDIDATES,
    })
  }
  if (value.category !== undefined) {
    request.category = assertString(value.category, "category", { max: 64 })
  }
  if (request.scope === "section" && !request.sectionId) {
    fail("sectionId is required when scope is section")
  }
  return request
}

export function toEngineReharmonizeRequest(
  request: JamReharmonizeRequest,
  subjectId: string,
  ownedProjectId: string,
): JamReharmonizeEngineRequest {
  const engine: JamReharmonizeEngineRequest = {
    model: request.model,
    scope: request.scope,
    key: request.key,
    chords: request.chords,
    subjectId: parseOpaqueId(subjectId, "subjectId"),
    projectId: parseProjectId(ownedProjectId),
  }
  if (request.sectionId !== undefined) engine.sectionId = request.sectionId
  if (request.candidateCount !== undefined) engine.candidateCount = request.candidateCount
  if (request.category !== undefined) engine.category = request.category
  return engine
}

function parseMidiTarget(value: unknown, path: string): MidiTarget {
  if (typeof value !== "string" || !(MIDI_TARGETS as readonly string[]).includes(value)) {
    fail(`${path} must be port1, port2, or both`)
  }
  return value as MidiTarget
}

function parseDispatchEvent(value: unknown, path: string): DispatchEvent {
  if (!isPlainObject(value)) fail(`${path} must be an object`)
  const bytes = assertString(value.bytes, `${path}.bytes`, {
    min: 4,
    max: MAX_BYTES_FIELD_CHARS,
    pattern: STANDARD_BASE64_PATTERN,
  })
  let decoded: string
  try {
    decoded = atob(bytes)
  } catch {
    fail(`${path}.bytes must be canonical standard base64`)
  }
  const canonical = btoa(decoded)
  if (
    decoded.length < 1 ||
    decoded.length > MAX_DISPATCH_EVENT_BYTES ||
    canonical !== bytes
  ) {
    fail(`${path}.bytes must be canonical standard base64 with 1-${MAX_DISPATCH_EVENT_BYTES} decoded bytes`)
  }
  return {
    atMs: assertInt(value.atMs, `${path}.atMs`, { min: 0, max: 86_400_000 }),
    target: parseMidiTarget(value.target, `${path}.target`),
    bytes,
  }
}

function parseDisplayTimeline(value: unknown, path: string): DisplayTimeline {
  if (!isPlainObject(value)) fail(`${path} must be an object`)
  const sectionsRaw = value.sections
  if (!Array.isArray(sectionsRaw)) fail(`${path}.sections must be an array`)
  if (sectionsRaw.length < 1 || sectionsRaw.length > MAX_SECTIONS) {
    fail(`${path}.sections length out of range`)
  }
  const chordsRaw = value.chords
  if (!Array.isArray(chordsRaw)) fail(`${path}.chords must be an array`)
  if (chordsRaw.length < 1 || chordsRaw.length > MAX_TOTAL_CHORDS) {
    fail(`${path}.chords length out of range`)
  }
  return {
    tempoBpm: assertInt(value.tempoBpm, `${path}.tempoBpm`, { min: 20, max: 400 }),
    key: assertString(value.key, `${path}.key`, { max: 16 }),
    timeSignature: parseTimeSignature(value.timeSignature, `${path}.timeSignature`, false),
    durationMs: assertInt(value.durationMs, `${path}.durationMs`, { min: 0, max: 86_400_000 }),
    sections: sectionsRaw.map((section, index) => {
      if (!isPlainObject(section)) fail(`${path}.sections[${index}] must be an object`)
      return {
        id: parseSectionId(section.id, `${path}.sections[${index}].id`),
        name: assertString(section.name, `${path}.sections[${index}].name`, {
          max: MAX_SECTION_NAME_LENGTH,
        }),
        startBar: assertInt(section.startBar, `${path}.sections[${index}].startBar`, {
          min: 0,
          max: 10_000,
        }),
        barCount: assertInt(section.barCount, `${path}.sections[${index}].barCount`, {
          min: 1,
          max: 256,
        }),
      }
    }),
    chords: chordsRaw.map((chord, index) =>
      parseDisplayChord(chord, `${path}.chords[${index}]`, false),
    ),
  }
}

/**
 * Whitelist-parse prepare responses so unknown/internal backend fields are dropped
 * before anything is returned to the browser.
 */
export function parseJamPrepareResponse(value: unknown): JamPrepareResponse {
  if (!isPlainObject(value)) fail("Engine prepare response must be an object")
  if (!isPlainObject(value.dispatch)) fail("response.dispatch must be an object")
  const fullSongRaw = value.dispatch.fullSong
  if (!Array.isArray(fullSongRaw)) fail("response.dispatch.fullSong must be an array")
  if (fullSongRaw.length > MAX_DISPATCH_EVENTS_FULL_SONG) {
    fail("response.dispatch.fullSong exceeds event limit")
  }
  if (!isPlainObject(value.dispatch.sections)) {
    fail("response.dispatch.sections must be an object")
  }
  const sectionKeys = Object.keys(value.dispatch.sections)
  if (sectionKeys.length > MAX_SECTIONS) {
    fail("response.dispatch.sections exceeds section limit")
  }
  const sections: Record<string, DispatchEvent[]> = {}
  for (const key of sectionKeys) {
    parseSectionId(key, `response.dispatch.sections key`)
    const events = value.dispatch.sections[key]
    if (!Array.isArray(events)) fail(`response.dispatch.sections.${key} must be an array`)
    if (events.length > MAX_DISPATCH_EVENTS_PER_SECTION) {
      fail(`response.dispatch.sections.${key} exceeds event limit`)
    }
    sections[key] = events.map((event, index) =>
      parseDispatchEvent(event, `response.dispatch.sections.${key}[${index}]`),
    )
  }
  const expiresAt = assertString(value.expiresAt, "response.expiresAt", { max: 64 })
  if (Number.isNaN(Date.parse(expiresAt))) fail("response.expiresAt must be an ISO datetime")
  return {
    planId: parseOpaqueId(value.planId, "response.planId"),
    expiresAt,
    display: parseDisplayTimeline(value.display, "response.display"),
    dispatch: {
      fullSong: fullSongRaw.map((event, index) =>
        parseDispatchEvent(event, `response.dispatch.fullSong[${index}]`),
      ),
      sections,
    },
  }
}

export function parseJamReharmonizeResponse(value: unknown): JamReharmonizeResponse {
  if (!isPlainObject(value)) fail("Engine reharmonize response must be an object")
  const candidatesRaw = value.candidates
  if (!Array.isArray(candidatesRaw)) fail("response.candidates must be an array")
  if (candidatesRaw.length < 1 || candidatesRaw.length > MAX_REHARMONIZE_CANDIDATES) {
    fail("response.candidates length out of range")
  }
  return {
    generationId: parseOpaqueId(value.generationId, "response.generationId"),
    candidates: candidatesRaw.map((candidate, index) => {
      if (!isPlainObject(candidate)) fail(`response.candidates[${index}] must be an object`)
      const chordsRaw = candidate.chords
      if (!Array.isArray(chordsRaw)) fail(`response.candidates[${index}].chords must be an array`)
      if (chordsRaw.length < 1 || chordsRaw.length > MAX_TOTAL_CHORDS) {
        fail(`response.candidates[${index}].chords length out of range`)
      }
      const parsed: JamReharmonizeResponse["candidates"][number] = {
        id: parseOpaqueId(candidate.id, `response.candidates[${index}].id`),
        chords: chordsRaw.map((chord, chordIndex) =>
          parseDisplayChord(
            chord,
            `response.candidates[${index}].chords[${chordIndex}]`,
            false,
          ),
        ),
      }
      if (candidate.label !== undefined) {
        parsed.label = assertString(candidate.label, `response.candidates[${index}].label`, {
          max: 128,
        })
      }
      return parsed
    }),
  }
}
