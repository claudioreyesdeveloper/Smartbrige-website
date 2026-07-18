import { JamError } from "@/lib/jam/domain/errors"
import {
  MAX_OPAQUE_ID_LENGTH,
  MAX_PROJECT_ID_LENGTH,
} from "@/lib/jam/domain/limits"
import { isSupportedKeyboardModel } from "@/lib/jam/domain/models"
import {
  MAX_RENDERED_SMF_BYTES,
  MAX_RHYTHM_CANDIDATES,
  MAX_RHYTHM_FACETS,
  MAX_RHYTHM_FEELS,
  MAX_RHYTHM_FILL_SLOTS,
  MAX_RHYTHM_FILLS,
  MAX_RHYTHM_RENDER_PARTS,
} from "@/lib/rhythm/domain/limits"
import type {
  RhythmApplyRequest,
  RhythmAuditionRequest,
  RhythmCandidate,
  RhythmFillCandidate,
  RhythmFillsRequest,
  RhythmFillsResponse,
  RhythmFilters,
  RhythmOptionsRequest,
  RhythmOptionsResponse,
  RhythmRenderOptions,
  RhythmRenderRequest,
  RhythmRenderResponse,
  RhythmRenderResult,
  RhythmQueryRequest,
  RhythmQueryResponse,
  YamahaPlaybackDescriptor,
} from "@/lib/rhythm/domain/types"

const OPAQUE_ID = /^[A-Za-z0-9._:-]+$/
const STANDARD_BASE64 =
  /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/

function fail(message: string): never {
  throw new JamError("validation", message)
}

function object(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    fail(`${path} must be an object`)
  }
  return value as Record<string, unknown>
}

function exact(value: Record<string, unknown>, keys: readonly string[], path: string): void {
  for (const key of Object.keys(value)) {
    if (!keys.includes(key)) fail(`Unknown field: ${path}.${key}`)
  }
}

function text(value: unknown, path: string, max: number, pattern?: RegExp): string {
  if (typeof value !== "string" || value.length < 1 || value.length > max) {
    fail(`${path} is invalid`)
  }
  if (pattern && !pattern.test(value)) fail(`${path} has invalid format`)
  return value
}

function opaque(value: unknown, path: string, max = MAX_OPAQUE_ID_LENGTH): string {
  return text(value, path, max, OPAQUE_ID)
}

function integer(value: unknown, path: string, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    fail(`${path} is out of range`)
  }
  return value
}

function choice<T extends string>(
  value: unknown,
  path: string,
  values: readonly T[],
): T {
  if (typeof value !== "string" || !(values as readonly string[]).includes(value)) {
    fail(`${path} is invalid`)
  }
  return value as T
}

function iso(value: unknown, path: string): string {
  const parsed = text(value, path, 64)
  if (Number.isNaN(Date.parse(parsed))) fail(`${path} must be an ISO datetime`)
  return parsed
}

function parseContextFields(raw: Record<string, unknown>) {
  return {
    projectId: opaque(raw.projectId, "projectId", MAX_PROJECT_ID_LENGTH),
    sectionId: opaque(raw.sectionId, "sectionId", 64),
    contextRevision: opaque(raw.contextRevision, "contextRevision"),
  }
}

function parseFilters(value: unknown): RhythmFilters {
  const raw = object(value, "filters")
  exact(raw, ["genre", "sectionType", "feel"], "filters")
  const filters: RhythmFilters = {}
  if (raw.genre !== undefined) filters.genre = text(raw.genre, "filters.genre", 128)
  if (raw.sectionType !== undefined) {
    filters.sectionType = text(raw.sectionType, "filters.sectionType", 128)
  }
  if (raw.feel !== undefined) {
    filters.feel = choice(raw.feel, "filters.feel", ["straight", "swing"] as const)
  }
  return filters
}

function parseOptions(value: unknown): RhythmRenderOptions | undefined {
  if (value === undefined) return undefined
  const raw = object(value, "options")
  exact(raw, ["timeFeel", "bassVelocity", "drumMapping", "forceFillEveryFourBars"], "options")
  const options: RhythmRenderOptions = {}
  if (raw.timeFeel !== undefined) {
    options.timeFeel = choice(raw.timeFeel, "options.timeFeel", ["half", "normal", "double"] as const)
  }
  if (raw.bassVelocity !== undefined) {
    options.bassVelocity = choice(
      raw.bassVelocity,
      "options.bassVelocity",
      ["soft", "balanced", "strong"] as const,
    )
  }
  if (raw.drumMapping !== undefined) {
    options.drumMapping = choice(raw.drumMapping, "options.drumMapping", ["gm", "ambient"] as const)
  }
  if (raw.forceFillEveryFourBars !== undefined) {
    if (typeof raw.forceFillEveryFourBars !== "boolean") {
      fail("options.forceFillEveryFourBars must be boolean")
    }
    options.forceFillEveryFourBars = raw.forceFillEveryFourBars
  }
  return options
}

export function parseRhythmOptionsRequest(value: unknown): RhythmOptionsRequest {
  const raw = object(value, "body")
  exact(raw, ["projectId", "kind"], "body")
  return {
    projectId: opaque(raw.projectId, "projectId", MAX_PROJECT_ID_LENGTH),
    kind: choice(raw.kind, "kind", ["bass", "drums"] as const),
  }
}

export function parseRhythmQueryRequest(value: unknown): RhythmQueryRequest {
  const raw = object(value, "body")
  exact(
    raw,
    [
      "projectId", "sectionId", "contextRevision", "kind", "mode",
      "filters", "bassCandidateId", "limit",
    ],
    "body",
  )
  const mode = choice(raw.mode, "mode", ["browse", "suggested"] as const)
  const kind = choice(raw.kind, "kind", ["bass", "drums"] as const)
  const bassCandidateId =
    raw.bassCandidateId === undefined ? undefined : opaque(raw.bassCandidateId, "bassCandidateId")
  if (mode === "suggested" && (kind !== "drums" || !bassCandidateId)) {
    fail("suggested mode requires drums and bassCandidateId")
  }
  if (mode === "browse" && bassCandidateId) {
    fail("bassCandidateId is only valid in suggested mode")
  }
  return {
    ...parseContextFields(raw),
    kind,
    mode,
    filters: parseFilters(raw.filters),
    ...(bassCandidateId ? { bassCandidateId } : {}),
    limit:
      raw.limit === undefined
        ? MAX_RHYTHM_CANDIDATES
        : integer(raw.limit, "limit", 1, MAX_RHYTHM_CANDIDATES),
  }
}

export function parseRhythmFillsRequest(value: unknown): RhythmFillsRequest {
  const raw = object(value, "body")
  exact(
    raw,
    ["projectId", "sectionId", "contextRevision", "drumCandidateId", "limit"],
    "body",
  )
  return {
    ...parseContextFields(raw),
    drumCandidateId: opaque(raw.drumCandidateId, "drumCandidateId"),
    limit:
      raw.limit === undefined
        ? MAX_RHYTHM_FILLS
        : integer(raw.limit, "limit", 1, MAX_RHYTHM_FILLS),
  }
}

export function parseRhythmRenderRequest(value: unknown): RhythmRenderRequest {
  const raw = object(value, "body")
  const operation = choice(raw.operation, "operation", ["audition", "apply"] as const)
  const common = {
    ...parseContextFields(raw),
    model: choice(raw.model, "model", ["genos", "genos2", "tyros4", "tyros5"] as const),
    options: parseOptions(raw.options),
  }
  if (!isSupportedKeyboardModel(common.model)) fail("model is invalid")
  if (common.options?.drumMapping === "ambient" && !["genos", "genos2"].includes(common.model)) {
    fail("ambient drum mapping requires a Genos-family model")
  }
  if (operation === "audition") {
    exact(
      raw,
      [
        "projectId", "sectionId", "contextRevision", "model", "operation",
        "part", "candidateId", "options",
      ],
      "body",
    )
    const request: RhythmAuditionRequest = {
      ...common,
      operation,
      part: choice(raw.part, "part", ["bass", "drums", "fill"] as const),
      candidateId: opaque(raw.candidateId, "candidateId"),
    }
    if (!request.options) delete request.options
    return request
  }

  exact(
    raw,
    [
      "projectId", "sectionId", "contextRevision", "model", "operation",
      "bassCandidateId", "drumCandidateId", "fillSlots", "options",
    ],
    "body",
  )
  const bassCandidateId =
    raw.bassCandidateId === undefined ? undefined : opaque(raw.bassCandidateId, "bassCandidateId")
  const drumCandidateId =
    raw.drumCandidateId === undefined ? undefined : opaque(raw.drumCandidateId, "drumCandidateId")
  if (!bassCandidateId && !drumCandidateId) {
    fail("apply requires a bassCandidateId or drumCandidateId")
  }
  let fillSlots: RhythmApplyRequest["fillSlots"]
  if (raw.fillSlots !== undefined) {
    if (!Array.isArray(raw.fillSlots) || raw.fillSlots.length > MAX_RHYTHM_FILL_SLOTS) {
      fail("fillSlots exceeds limit")
    }
    fillSlots = raw.fillSlots.map((value, index) => {
      const slot = object(value, `fillSlots[${index}]`)
      exact(slot, ["slotBar", "candidateId"], `fillSlots[${index}]`)
      return {
        slotBar: integer(slot.slotBar, `fillSlots[${index}].slotBar`, 4, 256),
        candidateId: opaque(slot.candidateId, `fillSlots[${index}].candidateId`),
      }
    })
    if (!drumCandidateId && fillSlots.length) fail("fillSlots require drumCandidateId")
  }
  const request: RhythmApplyRequest = {
    ...common,
    operation,
    ...(bassCandidateId ? { bassCandidateId } : {}),
    ...(drumCandidateId ? { drumCandidateId } : {}),
    ...(fillSlots ? { fillSlots } : {}),
  }
  if (!request.options) delete request.options
  return request
}

function parseStringArray(value: unknown, path: string, max: number): string[] {
  if (!Array.isArray(value) || value.length > max) fail(`${path} exceeds limit`)
  return value.map((item, index) => text(item, `${path}[${index}]`, 128))
}

export function parseRhythmOptionsResponse(value: unknown): RhythmOptionsResponse {
  const raw = object(value, "response")
  exact(raw, ["genres", "sectionTypes", "feels"], "response")
  return {
    genres: parseStringArray(raw.genres, "response.genres", MAX_RHYTHM_FACETS),
    sectionTypes: parseStringArray(raw.sectionTypes, "response.sectionTypes", MAX_RHYTHM_FACETS),
    feels: parseStringArray(raw.feels, "response.feels", MAX_RHYTHM_FEELS),
  }
}

function parseCandidate(value: unknown, path: string): RhythmCandidate {
  const raw = object(value, path)
  exact(
    raw,
    [
      "candidateId", "label", "category", "feel", "sectionType",
      "bpm", "bars", "matchBand", "qualityBand",
    ],
    path,
  )
  return {
    candidateId: opaque(raw.candidateId, `${path}.candidateId`),
    label: text(raw.label, `${path}.label`, 128),
    category: text(raw.category, `${path}.category`, 128),
    feel: typeof raw.feel === "string" && raw.feel.length <= 128 ? raw.feel : fail(`${path}.feel is invalid`),
    sectionType:
      typeof raw.sectionType === "string" && raw.sectionType.length <= 128
        ? raw.sectionType
        : fail(`${path}.sectionType is invalid`),
    bpm: integer(raw.bpm, `${path}.bpm`, 0, 1000),
    bars: integer(raw.bars, `${path}.bars`, 0, 256),
    matchBand: choice(raw.matchBand, `${path}.matchBand`, ["strong", "close", "broad"] as const),
    qualityBand: choice(
      raw.qualityBand,
      `${path}.qualityBand`,
      ["high", "standard", "limited"] as const,
    ),
  }
}

export function parseRhythmQueryResponse(value: unknown): RhythmQueryResponse {
  const raw = object(value, "response")
  exact(raw, ["queryId", "expiresAt", "candidates"], "response")
  if (!Array.isArray(raw.candidates) || raw.candidates.length > MAX_RHYTHM_CANDIDATES) {
    fail("response.candidates exceeds limit")
  }
  return {
    queryId: opaque(raw.queryId, "response.queryId"),
    expiresAt: iso(raw.expiresAt, "response.expiresAt"),
    candidates: raw.candidates.map((item, index) =>
      parseCandidate(item, `response.candidates[${index}]`),
    ),
  }
}

function parseFill(value: unknown, path: string): RhythmFillCandidate {
  const raw = object(value, path)
  exact(raw, ["candidateId", "label", "feel", "bars"], path)
  return {
    candidateId: opaque(raw.candidateId, `${path}.candidateId`),
    label: text(raw.label, `${path}.label`, 128),
    feel: typeof raw.feel === "string" && raw.feel.length <= 128 ? raw.feel : fail(`${path}.feel is invalid`),
    bars: integer(raw.bars, `${path}.bars`, 1, 256),
  }
}

export function parseRhythmFillsResponse(value: unknown): RhythmFillsResponse {
  const raw = object(value, "response")
  exact(raw, ["queryId", "expiresAt", "fills"], "response")
  if (!Array.isArray(raw.fills) || raw.fills.length > MAX_RHYTHM_FILLS) {
    fail("response.fills exceeds limit")
  }
  return {
    queryId: opaque(raw.queryId, "response.queryId"),
    expiresAt: iso(raw.expiresAt, "response.expiresAt"),
    fills: raw.fills.map((item, index) => parseFill(item, `response.fills[${index}]`)),
  }
}

function parsePlayback(value: unknown, path: string): YamahaPlaybackDescriptor {
  const raw = object(value, path)
  exact(raw, ["channel", "kind", "label", "bankMsb", "bankLsb", "programYamaha"], path)
  const nullableInt = (field: string, min: number, max: number): number | null => {
    const value = raw[field]
    return value === null ? null : integer(value, `${path}.${field}`, min, max)
  }
  return {
    channel: integer(raw.channel, `${path}.channel`, 1, 16),
    kind: choice(
      raw.kind,
      `${path}.kind`,
      ["mega-voice", "dx7-bass1", "channel-current", "drum-kit"] as const,
    ),
    label: text(raw.label, `${path}.label`, 64),
    bankMsb: nullableInt("bankMsb", 0, 127),
    bankLsb: nullableInt("bankLsb", 0, 127),
    programYamaha: nullableInt("programYamaha", 1, 128),
  }
}

function parseRender(value: unknown, path: string): RhythmRenderResult {
  const raw = object(value, path)
  exact(
    raw,
    [
      "renderReferenceId", "recipeReferenceId", "part", "durationMs",
      "renderedSmf", "playback",
    ],
    path,
  )
  const renderedSmf = text(
    raw.renderedSmf,
    `${path}.renderedSmf`,
    Math.ceil(MAX_RENDERED_SMF_BYTES / 3) * 4,
    STANDARD_BASE64,
  )
  let binary: string
  try {
    binary = atob(renderedSmf)
  } catch {
    fail(`${path}.renderedSmf is invalid`)
  }
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))
  if (
    bytes.length < 14 ||
    bytes.length > MAX_RENDERED_SMF_BYTES ||
    btoa(binary) !== renderedSmf ||
    String.fromCharCode(...bytes.slice(0, 4)) !== "MThd" ||
    new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(4) !== 6
  ) {
    fail(`${path}.renderedSmf is invalid or oversized`)
  }
  return {
    renderReferenceId: opaque(raw.renderReferenceId, `${path}.renderReferenceId`),
    recipeReferenceId: opaque(raw.recipeReferenceId, `${path}.recipeReferenceId`),
    part: choice(raw.part, `${path}.part`, ["bass", "drums", "fill"] as const),
    durationMs: integer(raw.durationMs, `${path}.durationMs`, 1, 86_400_000),
    renderedSmf,
    playback: parsePlayback(raw.playback, `${path}.playback`),
  }
}

export function parseRhythmRenderResponse(value: unknown): RhythmRenderResponse {
  const raw = object(value, "response")
  exact(raw, ["renders"], "response")
  if (
    !Array.isArray(raw.renders) ||
    raw.renders.length < 1 ||
    raw.renders.length > MAX_RHYTHM_RENDER_PARTS
  ) {
    fail("response.renders length out of range")
  }
  return {
    renders: raw.renders.map((item, index) => parseRender(item, `response.renders[${index}]`)),
  }
}
