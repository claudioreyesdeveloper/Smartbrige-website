import {
  PLAN_LIMITS,
  type DispatchTarget,
  type DisplayTimeline,
  type DisplayTimelineChord,
  type DisplayTimelineSection,
  type PreparedPerformancePlan,
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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function assertFiniteNumber(value: unknown, code: string, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new PlanValidationError(code, `${label} must be a finite number.`)
  }
  return value
}

function assertNonNegativeMs(value: unknown, code: string, label: string): number {
  const n = assertFiniteNumber(value, code, label)
  if (n < 0) {
    throw new PlanValidationError(code, `${label} must be >= 0.`)
  }
  return n
}

function expectedChannelByteLength(status: number): number | null {
  const type = status & 0xf0
  if (type === 0xc0 || type === 0xd0) return 2
  if (
    type === 0x80 ||
    type === 0x90 ||
    type === 0xa0 ||
    type === 0xb0 ||
    type === 0xe0
  ) {
    return 3
  }
  return null
}

function validateMidiBytes(bytes: unknown, index: number): Uint8Array {
  if (!Array.isArray(bytes) || bytes.length === 0) {
    throw new PlanValidationError(
      "malformed_bytes",
      `Event ${index}: bytes must be a non-empty number array.`,
    )
  }
  if (bytes.length > PLAN_LIMITS.maxBytesPerEvent) {
    throw new PlanValidationError(
      "oversized_event",
      `Event ${index}: exceeds max ${PLAN_LIMITS.maxBytesPerEvent} bytes.`,
    )
  }

  const out = new Uint8Array(bytes.length)
  for (let i = 0; i < bytes.length; i += 1) {
    const value = bytes[i]
    if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 255) {
      throw new PlanValidationError(
        "malformed_bytes",
        `Event ${index}: byte ${i} is not an integer 0–255.`,
      )
    }
    out[i] = value
  }

  const status = out[0]
  if (status < 0x80) {
    throw new PlanValidationError(
      "forbidden_midi",
      `Event ${index}: running status / missing status byte is forbidden.`,
    )
  }

  if (status === 0xf0) {
    if (out.length > PLAN_LIMITS.maxSysExBytes) {
      throw new PlanValidationError(
        "unbounded_sysex",
        `Event ${index}: SysEx exceeds max ${PLAN_LIMITS.maxSysExBytes} bytes.`,
      )
    }
    if (out[out.length - 1] !== 0xf7) {
      throw new PlanValidationError(
        "unbounded_sysex",
        `Event ${index}: SysEx must end with 0xF7.`,
      )
    }
    for (let i = 1; i < out.length - 1; i += 1) {
      if (out[i] > 0x7f) {
        throw new PlanValidationError(
          "malformed_bytes",
          `Event ${index}: SysEx data byte ${i} must be 0–127.`,
        )
      }
    }
    return out
  }

  if (status >= 0xf1) {
    throw new PlanValidationError(
      "forbidden_midi",
      `Event ${index}: system status 0x${status.toString(16)} is forbidden.`,
    )
  }

  const expected = expectedChannelByteLength(status)
  if (expected === null || out.length !== expected) {
    throw new PlanValidationError(
      "forbidden_midi",
      `Event ${index}: status 0x${status.toString(16)} has invalid length ${out.length}.`,
    )
  }
  for (let i = 1; i < out.length; i += 1) {
    if (out[i] > 0x7f) {
      throw new PlanValidationError(
        "malformed_bytes",
        `Event ${index}: data byte ${i} must be 0–127.`,
      )
    }
  }
  return out
}

function validateEvent(raw: unknown, index: number, durationMs: number): ValidatedDispatchEvent {
  if (!isPlainObject(raw)) {
    throw new PlanValidationError("malformed_event", `Event ${index} must be an object.`)
  }
  const atMs = assertNonNegativeMs(raw.atMs, "malformed_event", `Event ${index} atMs`)
  if (atMs > durationMs) {
    throw new PlanValidationError(
      "event_beyond_duration",
      `Event ${index}: atMs ${atMs} exceeds durationMs ${durationMs}.`,
    )
  }
  if (typeof raw.target !== "string" || !TARGETS.has(raw.target as DispatchTarget)) {
    throw new PlanValidationError(
      "malformed_event",
      `Event ${index}: target must be port1|port2|both.`,
    )
  }
  return {
    atMs,
    target: raw.target as DispatchTarget,
    bytes: validateMidiBytes(raw.bytes, index),
  }
}

function validateSlice(raw: unknown, label: string): ValidatedPlanSlice {
  if (!isPlainObject(raw)) {
    throw new PlanValidationError("malformed_plan", `${label} must be an object.`)
  }
  const durationMs = assertNonNegativeMs(raw.durationMs, "malformed_plan", `${label}.durationMs`)
  if (durationMs > PLAN_LIMITS.maxDurationMs) {
    throw new PlanValidationError(
      "oversized_plan",
      `${label}.durationMs exceeds max ${PLAN_LIMITS.maxDurationMs}.`,
    )
  }
  if (!Array.isArray(raw.events)) {
    throw new PlanValidationError("malformed_plan", `${label}.events must be an array.`)
  }
  if (raw.events.length > PLAN_LIMITS.maxEventsPerSlice) {
    throw new PlanValidationError(
      "oversized_plan",
      `${label} has too many events (max ${PLAN_LIMITS.maxEventsPerSlice}).`,
    )
  }
  if (raw.pauseSafe !== undefined && typeof raw.pauseSafe !== "boolean") {
    throw new PlanValidationError("malformed_plan", `${label}.pauseSafe must be a boolean.`)
  }

  // Preserve server order exactly; do not sort.
  const events = raw.events.map((event, index) => validateEvent(event, index, durationMs))
  return {
    durationMs,
    events,
    pauseSafe: raw.pauseSafe === true,
  }
}

function validateChord(raw: unknown, sectionId: string, index: number): DisplayTimelineChord {
  if (!isPlainObject(raw)) {
    throw new PlanValidationError(
      "malformed_display",
      `display.sections[${sectionId}].chords[${index}] must be an object.`,
    )
  }
  const atMs = assertNonNegativeMs(
    raw.atMs,
    "malformed_display",
    `display chord ${sectionId}[${index}].atMs`,
  )
  if (typeof raw.name !== "string" || raw.name.length === 0) {
    throw new PlanValidationError(
      "malformed_display",
      `display chord ${sectionId}[${index}].name must be a non-empty string.`,
    )
  }
  if (raw.name.length > PLAN_LIMITS.maxChordNameLength) {
    throw new PlanValidationError(
      "oversized_plan",
      `display chord name exceeds max ${PLAN_LIMITS.maxChordNameLength}.`,
    )
  }
  return { atMs, name: raw.name }
}

function validateDisplaySection(raw: unknown, index: number): DisplayTimelineSection {
  if (!isPlainObject(raw)) {
    throw new PlanValidationError(
      "malformed_display",
      `display.sections[${index}] must be an object.`,
    )
  }
  if (typeof raw.id !== "string" || raw.id.length === 0) {
    throw new PlanValidationError("malformed_display", `display.sections[${index}].id required.`)
  }
  const sectionId = raw.id
  if (sectionId.length > PLAN_LIMITS.maxSectionIdLength) {
    throw new PlanValidationError("oversized_plan", `display section id too long.`)
  }
  if (typeof raw.label !== "string" || raw.label.length === 0) {
    throw new PlanValidationError(
      "malformed_display",
      `display.sections[${index}].label required.`,
    )
  }
  const label = raw.label
  if (label.length > PLAN_LIMITS.maxSectionLabelLength) {
    throw new PlanValidationError("oversized_plan", `display section label too long.`)
  }
  const startMs = assertNonNegativeMs(
    raw.startMs,
    "malformed_display",
    `display.sections[${index}].startMs`,
  )
  const endMs = assertNonNegativeMs(
    raw.endMs,
    "malformed_display",
    `display.sections[${index}].endMs`,
  )
  if (endMs < startMs) {
    throw new PlanValidationError(
      "malformed_display",
      `display.sections[${index}]: endMs must be >= startMs.`,
    )
  }

  let chords: DisplayTimelineChord[] | undefined
  if (raw.chords !== undefined) {
    if (!Array.isArray(raw.chords)) {
      throw new PlanValidationError(
        "malformed_display",
        `display.sections[${index}].chords must be an array.`,
      )
    }
    if (raw.chords.length > PLAN_LIMITS.maxDisplayChordsPerSection) {
      throw new PlanValidationError(
        "oversized_plan",
        `display.sections[${index}] has too many chords.`,
      )
    }
    chords = raw.chords.map((chord, chordIndex) =>
      validateChord(chord, sectionId, chordIndex),
    )
  }

  return {
    id: sectionId,
    label,
    startMs,
    endMs,
    ...(chords ? { chords } : {}),
  }
}

function validateDisplay(raw: unknown): DisplayTimeline {
  if (!isPlainObject(raw)) {
    throw new PlanValidationError("malformed_display", "display must be an object.")
  }
  if (!Array.isArray(raw.sections)) {
    throw new PlanValidationError("malformed_display", "display.sections must be an array.")
  }
  if (raw.sections.length > PLAN_LIMITS.maxDisplaySections) {
    throw new PlanValidationError("oversized_plan", "display.sections exceeds limit.")
  }
  const sections = raw.sections.map((section, index) => validateDisplaySection(section, index))

  const display: DisplayTimeline = { sections }
  if (raw.tempoBpm !== undefined) {
    const tempo = assertFiniteNumber(raw.tempoBpm, "malformed_display", "display.tempoBpm")
    if (tempo <= 0 || tempo > 400) {
      throw new PlanValidationError("malformed_display", "display.tempoBpm out of range.")
    }
    display.tempoBpm = tempo
  }
  if (raw.key !== undefined) {
    if (typeof raw.key !== "string" || raw.key.length === 0 || raw.key.length > 16) {
      throw new PlanValidationError("malformed_display", "display.key is invalid.")
    }
    display.key = raw.key
  }
  if (raw.timeSignature !== undefined) {
    if (
      !Array.isArray(raw.timeSignature) ||
      raw.timeSignature.length !== 2 ||
      typeof raw.timeSignature[0] !== "number" ||
      typeof raw.timeSignature[1] !== "number"
    ) {
      throw new PlanValidationError(
        "malformed_display",
        "display.timeSignature must be [numerator, denominator].",
      )
    }
    display.timeSignature = [raw.timeSignature[0], raw.timeSignature[1]]
  }
  return display
}

/**
 * Validate and normalize an opaque prepared plan.
 * Rejects oversized/malformed plans, forbidden MIDI lengths, unbounded SysEx,
 * and events beyond duration. Preserves same-time event order.
 */
export function validatePreparedPlan(input: unknown): ValidatedPerformancePlan {
  if (!isPlainObject(input)) {
    throw new PlanValidationError("malformed_plan", "Plan must be an object.")
  }
  if (typeof input.planId !== "string" || input.planId.length === 0) {
    throw new PlanValidationError("malformed_plan", "planId is required.")
  }
  if (input.planId.length > PLAN_LIMITS.maxPlanIdLength) {
    throw new PlanValidationError("oversized_plan", "planId too long.")
  }
  if (typeof input.engineVersion !== "string" || input.engineVersion.length === 0) {
    throw new PlanValidationError("malformed_plan", "engineVersion is required.")
  }
  if (input.engineVersion.length > PLAN_LIMITS.maxEngineVersionLength) {
    throw new PlanValidationError("oversized_plan", "engineVersion too long.")
  }
  if (typeof input.expiresAt !== "string" || input.expiresAt.length === 0) {
    throw new PlanValidationError("malformed_plan", "expiresAt is required.")
  }
  const expiresAtMs = Date.parse(input.expiresAt)
  if (!Number.isFinite(expiresAtMs)) {
    throw new PlanValidationError("malformed_plan", "expiresAt must be an ISO-8601 timestamp.")
  }

  const display = validateDisplay(input.display)
  const full = validateSlice(input.full, "full")

  if (!isPlainObject(input.sections)) {
    throw new PlanValidationError("malformed_plan", "sections must be an object.")
  }
  const sectionKeys = Object.keys(input.sections)
  if (sectionKeys.length > PLAN_LIMITS.maxSections) {
    throw new PlanValidationError(
      "oversized_plan",
      `Too many section plans (max ${PLAN_LIMITS.maxSections}).`,
    )
  }

  const sections: Record<string, ValidatedPlanSlice> = {}
  let totalEvents = full.events.length
  for (const key of sectionKeys) {
    if (key.length === 0 || key.length > PLAN_LIMITS.maxSectionIdLength) {
      throw new PlanValidationError("malformed_plan", "section id is invalid.")
    }
    const slice = validateSlice(input.sections[key], `sections.${key}`)
    totalEvents += slice.events.length
    if (totalEvents > PLAN_LIMITS.maxTotalEvents) {
      throw new PlanValidationError(
        "oversized_plan",
        `Total events exceed max ${PLAN_LIMITS.maxTotalEvents}.`,
      )
    }
    sections[key] = slice
  }

  return {
    planId: input.planId,
    engineVersion: input.engineVersion,
    expiresAt: input.expiresAt,
    expiresAtMs,
    display,
    full,
    sections,
  }
}

/** Type guard helper for callers that already hold a typed plan object. */
export function asPreparedPlan(input: PreparedPerformancePlan): ValidatedPerformancePlan {
  return validatePreparedPlan(input)
}
