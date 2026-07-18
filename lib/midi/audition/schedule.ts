import type {
  CanonicalChannelEvent,
  CanonicalMidiDocument,
  CanonicalMidiEvent,
  CanonicalSysExEvent,
} from "@/lib/midi/contract"
import { buildTempoMap, tickToMs } from "./tempo"
import type { AuditionPort, AuditionStartOptions, ScheduledAuditionEvent } from "./types"
import { DEFAULT_BPM } from "./types"
import { stylePartVoiceSetupSysEx } from "./voice-setup"

const CHANNEL_DATA_LENGTH: Record<number, number> = {
  0x80: 2,
  0x90: 2,
  0xa0: 2,
  0xb0: 2,
  0xc0: 1,
  0xd0: 1,
  0xe0: 2,
}

export type PreparedAudition = {
  events: ScheduledAuditionEvent[]
  endTick: number
  endMs: number
}

function channelDataLength(status: number): number | null {
  const kind = status & 0xf0
  return CHANNEL_DATA_LENGTH[kind] ?? null
}

function isPlayableChannel(event: CanonicalChannelEvent): boolean {
  const expected = channelDataLength(event.status)
  if (expected === null) return false
  if (event.data.length < expected) return false
  if ((event.status & 0xf0) >= 0xf0) return false
  return true
}

function channelBytes(event: CanonicalChannelEvent): Uint8Array {
  const expected = channelDataLength(event.status) ?? 0
  return Uint8Array.of(event.status, ...event.data.slice(0, expected))
}

function sysexBytes(event: CanonicalSysExEvent): Uint8Array | null {
  if (event.status === 0xf0) {
    const body = event.data
    if (body.length === 0) return null
    if (body[body.length - 1] === 0xf7) {
      return Uint8Array.from([0xf0, ...body])
    }
    return Uint8Array.from([0xf0, ...body, 0xf7])
  }
  if (event.status === 0xf7) {
    if (event.data.length === 0) return null
    return Uint8Array.from([0xf7, ...event.data])
  }
  return null
}

function passesFilters(
  event: CanonicalMidiEvent,
  trackIndex: number,
  options: AuditionStartOptions,
): boolean {
  if (options.tracks && !options.tracks.includes(trackIndex)) return false
  if (event.kind === "channel" && options.channels) {
    return options.channels.includes(event.status & 0x0f)
  }
  if (event.kind === "sysex" && options.channels) {
    // SysEx is not channel-addressed; keep when any channel filter is active only
    // if the caller did not restrict to channel events exclusively. Dropping SysEx
    // when a channel filter is set keeps note/controller audits predictable.
    return false
  }
  if (event.kind === "meta") return false
  return true
}

function encodeEvent(
  event: CanonicalMidiEvent,
  port: AuditionPort,
  stylePartVoiceSetup: boolean,
): { bytes: Uint8Array; port: AuditionPort } | null {
  if (event.kind === "channel") {
    if (!isPlayableChannel(event)) return null
    if (stylePartVoiceSetup) {
      const voice = stylePartVoiceSetupSysEx(event.status, event.data)
      if (voice) return { bytes: voice, port }
    }
    return { bytes: channelBytes(event), port }
  }
  if (event.kind === "sysex") {
    const bytes = sysexBytes(event)
    if (!bytes) return null
    return { bytes, port }
  }
  return null
}

/**
 * Flatten, filter, and timestamp a canonical document for audition playback.
 * Ordering: tick → trackIndex → sequence (preserves same-tick note-off/CC/PC/SysEx order).
 */
export function prepareAuditionSchedule(
  document: CanonicalMidiDocument,
  options: AuditionStartOptions = {},
): PreparedAudition {
  const port: AuditionPort = options.port ?? "port2"
  const stylePartVoiceSetup = options.stylePartVoiceSetup !== false
  const bpm = options.bpm ?? DEFAULT_BPM
  const tempoMap = buildTempoMap(document, bpm)
  const tpq = Math.max(1, document.ticksPerQuarter)

  type Raw = {
    tick: number
    sequence: number
    trackIndex: number
    event: CanonicalMidiEvent
  }

  const raw: Raw[] = []
  let endTick = 0

  document.tracks.forEach((track, trackIndex) => {
    endTick = Math.max(endTick, track.endTick)
    for (const event of track.events) {
      endTick = Math.max(endTick, event.tick)
      if (!passesFilters(event, trackIndex, options)) continue
      raw.push({ tick: event.tick, sequence: event.sequence, trackIndex, event })
    }
  })

  raw.sort(
    (left, right) =>
      left.tick - right.tick ||
      left.trackIndex - right.trackIndex ||
      left.sequence - right.sequence,
  )

  const events: ScheduledAuditionEvent[] = []
  for (const item of raw) {
    const encoded = encodeEvent(item.event, port, stylePartVoiceSetup)
    if (!encoded) continue
    events.push({
      tick: item.tick,
      sequence: item.sequence,
      trackIndex: item.trackIndex,
      absMs: tickToMs(item.tick, tpq, tempoMap),
      bytes: encoded.bytes,
      port: encoded.port,
    })
  }

  const endMs = events.length
    ? Math.max(...events.map((event) => event.absMs))
    : tickToMs(endTick, tpq, tempoMap)

  return { events, endTick, endMs }
}
