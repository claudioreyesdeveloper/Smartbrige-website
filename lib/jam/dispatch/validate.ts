import {
  PLAN_LIMITS,
  type DispatchTarget,
  type DisplayChord,
  type DisplayTimeline,
  type DisplayTimelineSection,
  type PreparedPerformancePlan,
  type TimeSignature,
  type ValidatedDispatchEvent,
  type ValidatedPerformancePlan,
  type ValidatedPlanSlice,
} from "./types"

export class PlanValidationError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = "PlanValidationError"
    this.code = code
  }
}

const TARGETS = new Set<DispatchTarget>(["port1", "port2", "both"])
const ID_PATTERN = /^[A-Za-z0-9._:-]+$/
const STANDARD_BASE64 =
  /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/
const REALTIME_STATUSES = new Set([0xf8, 0xfa, 0xfc])
const DENOMINATORS = new Set([1, 2, 4, 8, 16])

function fail(code: string, message: string): never {
  throw new PlanValidationError(code, message)
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function exactKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  path: string,
): void {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) fail("malformed_plan", `Unknown field: ${path}.${key}`)
  }
}

function integer(
  value: unknown,
  path: string,
  min: number,
  max: number,
): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    fail("malformed_plan", `${path} must be an integer from ${min} to ${max}.`)
  }
  return value
}

function positiveNumber(value: unknown, path: string, max: number): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value <= 0 ||
    value > max
  ) {
    fail("malformed_display", `${path} must be a positive number up to ${max}.`)
  }
  return value
}

function text(value: unknown, path: string, max: number, pattern?: RegExp): string {
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    value.length > max ||
    (pattern && !pattern.test(value))
  ) {
    fail("malformed_plan", `${path} is invalid.`)
  }
  return value
}

function encodeBase64(bytes: Uint8Array): string {
  let binary = ""
  const chunkSize = 0x8000
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize))
  }
  return btoa(binary)
}

/** Decode strict canonical standard-base64 without accepting URL-safe or loose padding. */
export function decodeCanonicalBase64(value: unknown, path: string): Uint8Array {
  if (typeof value !== "string" || value.length < 4 || !STANDARD_BASE64.test(value)) {
    fail("malformed_base64", `${path} must be canonical standard base64.`)
  }
  if (value.length > PLAN_LIMITS.maxBytesFieldChars) {
    fail(
      "oversized_event",
      `${path} must decode to 1-${PLAN_LIMITS.maxDecodedBytes} bytes.`,
    )
  }

  let decoded: string
  try {
    decoded = atob(value)
  } catch {
    fail("malformed_base64", `${path} must be canonical standard base64.`)
  }
  if (decoded.length < 1 || decoded.length > PLAN_LIMITS.maxDecodedBytes) {
    fail(
      "oversized_event",
      `${path} must decode to 1-${PLAN_LIMITS.maxDecodedBytes} bytes.`,
    )
  }
  const bytes = Uint8Array.from(decoded, (character) => character.charCodeAt(0))
  if (encodeBase64(bytes) !== value) {
    fail("malformed_base64", `${path} must use canonical standard-base64 padding.`)
  }
  return bytes
}

function expectedChannelLength(status: number): number | null {
  const type = status & 0xf0
  if (type === 0xc0 || type === 0xd0) return 2
  if ([0x80, 0x90, 0xa0, 0xb0, 0xe0].includes(type)) return 3
  return null
}

function validateMidi(bytes: Uint8Array, path: string): void {
  const status = bytes[0]
  if (status < 0x80) fail("forbidden_midi", `${path} lacks a MIDI status byte.`)

  if (status === 0xf0) {
    if (bytes.length > PLAN_LIMITS.maxSysExBytes) {
      fail("unbounded_sysex", `${path} SysEx exceeds the bounded maximum.`)
    }
    if (bytes.length < 2 || bytes.at(-1) !== 0xf7) {
      fail("unbounded_sysex", `${path} SysEx must terminate with 0xF7.`)
    }
    for (let index = 1; index < bytes.length - 1; index += 1) {
      if (bytes[index] > 0x7f) fail("malformed_midi", `${path} has invalid SysEx data.`)
    }
    return
  }

  if (REALTIME_STATUSES.has(status)) {
    if (bytes.length !== 1) {
      fail("forbidden_midi", `${path} realtime status must be exactly one byte.`)
    }
    return
  }

  if (status >= 0xf0) {
    fail("forbidden_midi", `${path} contains an unsupported system status.`)
  }
  const expected = expectedChannelLength(status)
  if (expected === null || bytes.length !== expected) {
    fail("forbidden_midi", `${path} has an invalid MIDI status length.`)
  }
  for (let index = 1; index < bytes.length; index += 1) {
    if (bytes[index] > 0x7f) fail("malformed_midi", `${path} has an invalid data byte.`)
  }
}

function parseEvent(
  value: unknown,
  path: string,
  displayDurationMs: number,
): ValidatedDispatchEvent {
  if (!isPlainObject(value)) fail("malformed_plan", `${path} must be an object.`)
  exactKeys(value, ["atMs", "target", "bytes"], path)
  const atMs = integer(value.atMs, `${path}.atMs`, 0, PLAN_LIMITS.maxDurationMs)
  if (atMs > displayDurationMs) {
    fail("event_beyond_duration", `${path}.atMs exceeds display.durationMs.`)
  }
  if (typeof value.target !== "string" || !TARGETS.has(value.target as DispatchTarget)) {
    fail("malformed_plan", `${path}.target must be port1, port2, or both.`)
  }
  const bytes = decodeCanonicalBase64(value.bytes, `${path}.bytes`)
  validateMidi(bytes, `${path}.bytes`)
  return { atMs, target: value.target as DispatchTarget, bytes }
}

function parseEvents(
  value: unknown,
  path: string,
  limit: number,
  displayDurationMs: number,
): ValidatedDispatchEvent[] {
  if (!Array.isArray(value)) fail("malformed_plan", `${path} must be an array.`)
  if (value.length > limit) fail("oversized_plan", `${path} exceeds its event limit.`)
  let priorAtMs = -1
  return value.map((event, index) => {
    const parsed = parseEvent(event, `${path}[${index}]`, displayDurationMs)
    if (parsed.atMs < priorAtMs) {
      fail("malformed_plan", `${path} must be ordered by nondecreasing atMs.`)
    }
    priorAtMs = parsed.atMs
    return parsed
  })
}

function parseTimeSignature(value: unknown): TimeSignature {
  if (!isPlainObject(value)) fail("malformed_display", "display.timeSignature is invalid.")
  exactKeys(value, ["numerator", "denominator"], "display.timeSignature")
  const numerator = integer(value.numerator, "display.timeSignature.numerator", 1, 32)
  const denominator = integer(value.denominator, "display.timeSignature.denominator", 1, 16)
  if (!DENOMINATORS.has(denominator)) {
    fail("malformed_display", "display.timeSignature.denominator is invalid.")
  }
  return { numerator, denominator: denominator as TimeSignature["denominator"] }
}

function parseSection(value: unknown, index: number): DisplayTimelineSection {
  const path = `display.sections[${index}]`
  if (!isPlainObject(value)) fail("malformed_display", `${path} must be an object.`)
  exactKeys(value, ["id", "name", "startBar", "barCount"], path)
  return {
    id: text(value.id, `${path}.id`, PLAN_LIMITS.maxSectionIdLength, ID_PATTERN),
    name: text(value.name, `${path}.name`, PLAN_LIMITS.maxSectionNameLength),
    startBar: integer(value.startBar, `${path}.startBar`, 0, 10_000),
    barCount: integer(value.barCount, `${path}.barCount`, 1, 256),
  }
}

function parseChord(value: unknown, index: number): DisplayChord {
  const path = `display.chords[${index}]`
  if (!isPlainObject(value)) fail("malformed_display", `${path} must be an object.`)
  exactKeys(value, ["symbol", "startBar", "durationBars"], path)
  return {
    symbol: text(value.symbol, `${path}.symbol`, PLAN_LIMITS.maxChordNameLength),
    startBar: integer(value.startBar, `${path}.startBar`, 0, 10_000),
    durationBars: positiveNumber(value.durationBars, `${path}.durationBars`, 256),
  }
}

function parseDisplay(value: unknown): DisplayTimeline {
  if (!isPlainObject(value)) fail("malformed_display", "display must be an object.")
  exactKeys(
    value,
    ["tempoBpm", "key", "timeSignature", "durationMs", "sections", "chords"],
    "display",
  )
  if (!Array.isArray(value.sections) || value.sections.length < 1 ||
      value.sections.length > PLAN_LIMITS.maxSections) {
    fail("malformed_display", "display.sections length is invalid.")
  }
  if (!Array.isArray(value.chords) || value.chords.length < 1 ||
      value.chords.length > PLAN_LIMITS.maxDisplayChords) {
    fail("malformed_display", "display.chords length is invalid.")
  }
  const sections = value.sections.map(parseSection)
  const ids = new Set<string>()
  for (const section of sections) {
    if (ids.has(section.id)) fail("malformed_display", `Duplicate section id: ${section.id}`)
    ids.add(section.id)
  }
  return {
    tempoBpm: integer(value.tempoBpm, "display.tempoBpm", 20, 400),
    key: text(value.key, "display.key", 16),
    timeSignature: parseTimeSignature(value.timeSignature),
    durationMs: integer(value.durationMs, "display.durationMs", 0, PLAN_LIMITS.maxDurationMs),
    sections,
    chords: value.chords.map(parseChord),
  }
}

function sectionDurationMs(display: DisplayTimeline, sectionId: string, events: ValidatedDispatchEvent[]): number {
  const section = display.sections.find((candidate) => candidate.id === sectionId)
  const lastEventMs = events.at(-1)?.atMs ?? 0
  if (!section) return lastEventMs
  const quarterNotesPerBar =
    display.timeSignature.numerator * (4 / display.timeSignature.denominator)
  const metadataDuration =
    section.barCount * quarterNotesPerBar * (60_000 / display.tempoBpm)
  return Math.min(display.durationMs, Math.max(lastEventMs, metadataDuration))
}

/** Validate the exact final prepare response and decode event bytes once at load. */
export function validatePreparedPlan(input: unknown): ValidatedPerformancePlan {
  if (!isPlainObject(input)) fail("malformed_plan", "Plan must be an object.")
  exactKeys(input, ["planId", "expiresAt", "display", "dispatch"], "plan")

  const planId = text(input.planId, "plan.planId", PLAN_LIMITS.maxPlanIdLength, ID_PATTERN)
  const expiresAt = text(input.expiresAt, "plan.expiresAt", 64)
  const expiresAtMs = Date.parse(expiresAt)
  if (!Number.isFinite(expiresAtMs)) {
    fail("malformed_plan", "plan.expiresAt must be an ISO datetime.")
  }
  const display = parseDisplay(input.display)

  if (!isPlainObject(input.dispatch)) fail("malformed_plan", "plan.dispatch must be an object.")
  exactKeys(input.dispatch, ["fullSong", "sections"], "plan.dispatch")
  if (!isPlainObject(input.dispatch.sections)) {
    fail("malformed_plan", "plan.dispatch.sections must be an object.")
  }
  const sectionKeys = Object.keys(input.dispatch.sections)
  if (sectionKeys.length > PLAN_LIMITS.maxSections) {
    fail("oversized_plan", "plan.dispatch.sections exceeds its section limit.")
  }

  const fullEvents = parseEvents(
    input.dispatch.fullSong,
    "plan.dispatch.fullSong",
    PLAN_LIMITS.maxFullSongEvents,
    display.durationMs,
  )
  const sections: Record<string, ValidatedPlanSlice> = {}
  for (const sectionId of sectionKeys) {
    text(sectionId, "plan.dispatch.sections key", PLAN_LIMITS.maxSectionIdLength, ID_PATTERN)
    const events = parseEvents(
      input.dispatch.sections[sectionId],
      `plan.dispatch.sections.${sectionId}`,
      PLAN_LIMITS.maxEventsPerSection,
      display.durationMs,
    )
    sections[sectionId] = {
      durationMs: sectionDurationMs(display, sectionId, events),
      events,
    }
  }

  return {
    planId,
    expiresAt,
    expiresAtMs,
    display,
    dispatch: {
      fullSong: { durationMs: display.durationMs, events: fullEvents },
      sections,
    },
  }
}

export function asPreparedPlan(input: PreparedPerformancePlan): ValidatedPerformancePlan {
  return validatePreparedPlan(input)
}
