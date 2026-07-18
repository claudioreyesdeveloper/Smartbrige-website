import { importSmf, type CanonicalMidiDocument } from "@/lib/midi"
import { AuditionPlayer } from "./player"
import type {
  AuditionClock,
  AuditionMidiSession,
  AuditionPlaybackState,
  AuditionTimer,
} from "./types"
import {
  xgMultiPartMessage,
  XG_MULTIPART_BANK_LSB,
  XG_MULTIPART_BANK_MSB,
  XG_MULTIPART_PROGRAM,
} from "./voice-setup"

export const MAX_RENDERED_AUDITION_SMF_BYTES = 8 * 1024 * 1024
export const MAX_RENDERED_AUDITION_DURATION_MS = 86_400_000

const STANDARD_BASE64 =
  /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/

export type RhythmRenderedPart = "bass" | "drums" | "fill" | "solo"

export type RhythmRenderedPlaybackKind =
  | "mega-voice"
  | "dx7-bass1"
  | "channel-current"
  | "drum-kit"

export type RhythmRenderedPlaybackDescriptor = {
  /** Public contract channels are Yamaha's 1-based channel numbers. */
  channel: number
  kind: RhythmRenderedPlaybackKind
  label: string
  bankMsb: number | null
  bankLsb: number | null
  programYamaha: number | null
}

export type RhythmRenderedAuditionPayload = {
  part: RhythmRenderedPart
  durationMs: number
  renderedSmf: string
  playback: RhythmRenderedPlaybackDescriptor
}

export type RhythmRenderedAuditionStatus =
  | "idle"
  | "playing"
  | "stopped"
  | "completed"
  | "error"

export type RhythmRenderedAuditionState = {
  status: RhythmRenderedAuditionStatus
  part: RhythmRenderedPart | null
  durationMs: number
  playback: AuditionPlaybackState
  error: string | null
}

export type RhythmRenderedAuditionPlayerDeps = {
  session: AuditionMidiSession
  clock?: AuditionClock
  timer?: AuditionTimer
  lookaheadMs?: number
  scheduleIntervalMs?: number
}

const initialPlaybackState = (): AuditionPlaybackState => ({
  status: "idle",
  generation: 0,
  positionTick: 0,
  endTick: 0,
  scheduledCount: 0,
  sentCount: 0,
})

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Rendered MIDI audition failed."
}

function integerInRange(value: unknown, min: number, max: number, path: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${path} must be an integer from ${min} to ${max}.`)
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

function decodeRenderedSmf(value: unknown): Uint8Array {
  const maxChars = Math.ceil(MAX_RENDERED_AUDITION_SMF_BYTES / 3) * 4
  if (
    typeof value !== "string" ||
    value.length < 4 ||
    value.length > maxChars ||
    !STANDARD_BASE64.test(value)
  ) {
    throw new Error("renderedSmf must be canonical standard base64 within the size limit.")
  }

  let decoded: string
  try {
    decoded = atob(value)
  } catch {
    throw new Error("renderedSmf must be canonical standard base64.")
  }
  if (decoded.length < 14 || decoded.length > MAX_RENDERED_AUDITION_SMF_BYTES) {
    throw new Error(
      `renderedSmf must contain a Standard MIDI file up to ${MAX_RENDERED_AUDITION_SMF_BYTES} bytes.`,
    )
  }

  const bytes = Uint8Array.from(decoded, (character) => character.charCodeAt(0))
  if (encodeBase64(bytes) !== value) {
    throw new Error("renderedSmf must use canonical standard-base64 padding.")
  }
  return bytes
}

function validatePart(value: unknown): RhythmRenderedPart {
  if (value !== "bass" && value !== "drums" && value !== "fill" && value !== "solo") {
    throw new Error("part must be bass, drums, fill, or solo.")
  }
  return value
}

function validateDescriptor(
  value: RhythmRenderedPlaybackDescriptor,
  part: RhythmRenderedPart,
): RhythmRenderedPlaybackDescriptor {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("playback must be a Yamaha playback descriptor.")
  }

  const channel = integerInRange(value.channel, 1, 16, "playback.channel")
  if (
    value.kind !== "mega-voice" &&
    value.kind !== "dx7-bass1" &&
    value.kind !== "channel-current" &&
    value.kind !== "drum-kit"
  ) {
    throw new Error("playback.kind is unsupported.")
  }
  if (
    typeof value.label !== "string" ||
    value.label.length < 1 ||
    value.label.length > 64 ||
    /[\u0000-\u001f\u007f]/.test(value.label)
  ) {
    throw new Error("playback.label must be display-safe text up to 64 characters.")
  }

  const isCurrent = value.kind === "channel-current"
  if (isCurrent) {
    if (value.bankMsb !== null || value.bankLsb !== null || value.programYamaha !== null) {
      throw new Error("channel-current playback must not contain bank or program values.")
    }
  } else {
    integerInRange(value.bankMsb, 0, 127, "playback.bankMsb")
    integerInRange(value.bankLsb, 0, 127, "playback.bankLsb")
    integerInRange(value.programYamaha, 1, 128, "playback.programYamaha")
  }

  const validBass = part === "bass" && channel === 11 &&
    (value.kind === "mega-voice" || value.kind === "dx7-bass1")
  const validDrums = (part === "drums" || part === "fill") &&
    ((channel === 10 && value.kind === "channel-current") ||
      (channel === 9 && value.kind === "drum-kit"))
  const validSolo = part === "solo" && channel === 1 && value.kind === "channel-current"
  if (!validBass && !validDrums && !validSolo) {
    throw new Error(
      `Unexpected ${part} audition channel or playback kind; stored-project channels are not playable.`,
    )
  }

  return { ...value, channel }
}

function validateDocumentChannel(
  document: CanonicalMidiDocument,
  expectedChannel: number,
): void {
  for (const track of document.tracks) {
    for (const event of track.events) {
      if (event.kind !== "channel") continue
      const channel = (event.status & 0x0f) + 1
      if (channel !== expectedChannel) {
        throw new Error(
          `Rendered MIDI channel ${channel} does not match playback channel ${expectedChannel}.`,
        )
      }
    }
  }
}

function parsePayload(payload: RhythmRenderedAuditionPayload): {
  part: RhythmRenderedPart
  durationMs: number
  document: CanonicalMidiDocument
  playback: RhythmRenderedPlaybackDescriptor
} {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Rendered audition payload must be an object.")
  }
  const part = validatePart(payload.part)
  const durationMs = integerInRange(
    payload.durationMs,
    1,
    MAX_RENDERED_AUDITION_DURATION_MS,
    "durationMs",
  )
  const playback = validateDescriptor(payload.playback, part)
  const document = importSmf(decodeRenderedSmf(payload.renderedSmf))
  validateDocumentChannel(document, playback.channel)
  return { part, durationMs, document, playback }
}

/**
 * Production boundary for already-rendered public rhythm auditions.
 *
 * It performs no candidate lookup, ranking, rendering, adaptation, assembly,
 * persistence, or network I/O.
 */
export class RhythmRenderedAuditionPlayer {
  private readonly session: AuditionMidiSession
  private readonly player: AuditionPlayer
  private readonly listeners = new Set<(state: RhythmRenderedAuditionState) => void>()
  private state: RhythmRenderedAuditionState = {
    status: "idle",
    part: null,
    durationMs: 0,
    playback: initialPlaybackState(),
    error: null,
  }

  constructor(deps: RhythmRenderedAuditionPlayerDeps) {
    this.session = deps.session
    this.player = new AuditionPlayer({
      ...deps,
      onStateChange: (playback) => {
        this.publish({
          ...this.state,
          status: playback.status,
          playback: { ...playback },
          error: null,
        })
      },
      onError: (error) => this.fail(error),
    })
  }

  get playbackState(): RhythmRenderedAuditionState {
    return this.snapshot()
  }

  start(payload: RhythmRenderedAuditionPayload): void {
    try {
      const parsed = parsePayload(payload)
      this.player.stop()
      this.publish({
        ...this.state,
        part: parsed.part,
        durationMs: parsed.durationMs,
        error: null,
      })
      this.applyPlaybackDescriptor(parsed.playback)
      this.player.start(parsed.document, {
        port: "port2",
        channels: [parsed.playback.channel - 1],
        stylePartVoiceSetup: false,
      })
    } catch (error) {
      this.fail(error)
      throw error
    }
  }

  stop(): void {
    try {
      this.player.stop()
    } catch (error) {
      this.fail(error)
    }
  }

  panic(): void {
    try {
      this.player.panic()
    } catch (error) {
      this.fail(error)
    }
  }

  subscribe(listener: (state: RhythmRenderedAuditionState) => void): () => void {
    this.listeners.add(listener)
    listener(this.snapshot())
    return () => {
      this.listeners.delete(listener)
    }
  }

  private applyPlaybackDescriptor(playback: RhythmRenderedPlaybackDescriptor): void {
    if (playback.kind === "channel-current") return
    const channel = playback.channel - 1
    this.session.sendPort2(
      xgMultiPartMessage(channel, XG_MULTIPART_BANK_MSB, playback.bankMsb!),
    )
    this.session.sendPort2(
      xgMultiPartMessage(channel, XG_MULTIPART_BANK_LSB, playback.bankLsb!),
    )
    this.session.sendPort2(
      xgMultiPartMessage(channel, XG_MULTIPART_PROGRAM, playback.programYamaha! - 1),
    )
  }

  private fail(error: unknown): void {
    try {
      this.player.stop()
    } catch {
      // Preserve the original validation or connection failure.
    }
    this.publish({
      ...this.state,
      status: "error",
      playback: { ...this.player.playbackState },
      error: errorMessage(error),
    })
  }

  private snapshot(): RhythmRenderedAuditionState {
    return {
      ...this.state,
      playback: { ...this.state.playback },
    }
  }

  private publish(state: RhythmRenderedAuditionState): void {
    this.state = state
    for (const listener of this.listeners) listener(this.snapshot())
  }
}

