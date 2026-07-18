/**
 * Port of JamPlayerScreen::exportRecordedStyleToTempFile for section recordings.
 * 480 PPQ, tempo track + up to 8 named style-part tracks (channels 1–8 after renumber).
 */

import type { CapturedMidiEvent } from "@/lib/demo/style-capture"
import type { MidiNote } from "@/lib/demo/style-midi"

/** Desktop kStyleChannelNames / exportRecordedStyleToTempFile baseTrackNames. */
export const STYLE_CHANNEL_NAMES = [
  "Rhythm 1",
  "Rhythm 2",
  "Bass",
  "Chord 1",
  "Chord 2",
  "Pad",
  "Phrase 1",
  "Phrase 2",
] as const

export type RenumberedCaptureEvent = CapturedMidiEvent & {
  /** 1–8 after desktop renumber (9→1 … 16→8). */
  channel: number
}

const writeU16 = (value: number) => [(value >> 8) & 0xff, value & 0xff]
const writeU32 = (value: number) => [
  (value >>> 24) & 0xff,
  (value >>> 16) & 0xff,
  (value >>> 8) & 0xff,
  value & 0xff,
]

function writeVlq(value: number): number[] {
  let buffer = Math.max(0, Math.floor(value)) & 0x7f
  const bytes: number[] = []
  while ((value >>= 7)) {
    buffer <<= 8
    buffer |= (value & 0x7f) | 0x80
  }
  for (;;) {
    bytes.push(buffer & 0xff)
    if (buffer & 0x80) buffer >>= 8
    else break
  }
  return bytes
}

/**
 * Desktop stopSectionRecording filter + renumber.
 * Notes-only by default (includeControlData = false).
 */
export function filterAndRenumberSectionCapture(
  events: CapturedMidiEvent[],
  channelsEnabled: boolean[],
  includeControlData = false,
): RenumberedCaptureEvent[] {
  const out: RenumberedCaptureEvent[] = []
  for (const event of events) {
    if (event.status === 0xf0) {
      if (includeControlData) {
        out.push({ ...event, channel: 0, data: [...event.data] })
      }
      continue
    }

    const kind = event.status & 0xf0
    const isNote = kind === 0x80 || kind === 0x90
    const isControl =
      kind === 0xb0 ||
      kind === 0xc0 ||
      kind === 0xd0 ||
      kind === 0xe0 ||
      kind === 0xa0
    if (!isNote && !isControl) continue
    if (!includeControlData && !isNote) continue

    const channel = (event.status & 0x0f) + 1 // 1–16
    if (channel < 9 || channel > 16) continue
    const channelIndex = channel - 9
    if (!channelsEnabled[channelIndex]) continue

    // Renumber: 9→1 … 16→8
    const renumbered = channel - 8
    out.push({
      timeSeconds: event.timeSeconds,
      status: (kind) | (renumbered - 1),
      data: [...event.data],
      channel: renumbered,
    })
  }
  return out
}

/**
 * Wall-clock capture → PPQ * (BPM / 60). Same as JamPlayerMotifScreen / RiffMaker.
 * (Do not use JamPlayerScreen_Recording’s /120 — that doubles tempo on real seconds.)
 */
export function sectionCaptureTicksPerSecond(bpm: number, ppq = 480): number {
  const exportBpm = bpm > 0 ? bpm : 120
  return (ppq * exportBpm) / 60
}

export function secondsToSectionTicks(
  timeSeconds: number,
  bpm: number,
  beatZeroOffsetSeconds = 0,
  ppq = 480,
): number {
  const ticksPerSecond = sectionCaptureTicksPerSecond(bpm, ppq)
  let timeInSeconds = timeSeconds - beatZeroOffsetSeconds
  if (timeInSeconds < 0) timeInSeconds = 0
  let timeInTicks = timeInSeconds * ticksPerSecond
  if (
    Math.abs(timeSeconds - beatZeroOffsetSeconds) < 0.00001 &&
    timeInTicks >= 0 &&
    timeInTicks < 1
  ) {
    timeInTicks = 0
  }
  return timeInTicks
}

function serializeTrackEvents(
  events: { tick: number; status: number; data: number[] }[],
): number[] {
  const body: number[] = []
  let lastTick = 0
  const sorted = [...events].sort((a, b) => a.tick - b.tick)
  for (const event of sorted) {
    const tick = Math.max(0, Math.round(event.tick))
    body.push(...writeVlq(tick - lastTick), event.status, ...event.data)
    lastTick = tick
  }
  body.push(...writeVlq(0), 0xff, 0x2f, 0x00)
  return body
}

function trackNameMeta(name: string): { tick: number; status: number; data: number[] } {
  const encoded = Array.from(new TextEncoder().encode(name))
  return {
    tick: 0,
    status: 0xff,
    data: [0x03, ...writeVlq(encoded.length), ...encoded],
  }
}

/**
 * Port of exportRecordedStyleToTempFile(const MidiMessageSequence&).
 * Returns a Standard MIDI File byte array.
 */
export function exportRecordedStyleMidi(
  events: RenumberedCaptureEvent[],
  options: {
    bpm?: number
    beatZeroOffsetSeconds?: number
    songName?: string
    ppq?: number
  } = {},
): Uint8Array {
  const bpm = options.bpm && options.bpm > 0 ? options.bpm : 120
  const ppq = options.ppq ?? 480
  const anchor = options.beatZeroOffsetSeconds ?? 0
  const songName = options.songName || "Song"

  const channelTracks: { tick: number; status: number; data: number[] }[][] =
    Array.from({ length: 8 }, () => [])

  for (const event of events) {
    if (event.channel < 1 || event.channel > 8) continue
    const tick = secondsToSectionTicks(event.timeSeconds, bpm, anchor, ppq)
    channelTracks[event.channel - 1].push({
      tick,
      status: event.status,
      data: event.data,
    })
  }

  // Force-snap to playable zero (desktop forceSnapTracksToPlayableZero)
  let leadingTick = Infinity
  for (const track of channelTracks) {
    for (const event of track) {
      if (event.tick < leadingTick) leadingTick = event.tick
    }
  }
  if (Number.isFinite(leadingTick) && Math.abs(leadingTick) >= 0.00001) {
    for (const track of channelTracks) {
      for (const event of track) {
        event.tick = Math.max(0, event.tick - leadingTick)
      }
    }
  }

  const microsecondsPerQuarter = Math.round(60_000_000 / bpm)
  const tempoTrack = serializeTrackEvents([
    {
      tick: 0,
      status: 0xff,
      data: [0x51, 0x03, (microsecondsPerQuarter >> 16) & 0xff, (microsecondsPerQuarter >> 8) & 0xff, microsecondsPerQuarter & 0xff],
    },
    {
      tick: 0,
      status: 0xff,
      data: [0x58, 0x04, 4, 2, 24, 8],
    },
  ])

  const output: number[] = [
    ...Array.from(new TextEncoder().encode("MThd")),
    ...writeU32(6),
    ...writeU16(1),
    ...writeU16(1 + channelTracks.filter((t) => t.length > 0).length),
    ...writeU16(ppq),
    ...Array.from(new TextEncoder().encode("MTrk")),
    ...writeU32(tempoTrack.length),
    ...tempoTrack,
  ]

  for (let ch = 0; ch < 8; ch += 1) {
    if (!channelTracks[ch].length) continue
    const name = `${STYLE_CHANNEL_NAMES[ch]} - ${songName}`
    const body = serializeTrackEvents([
      trackNameMeta(name),
      ...channelTracks[ch],
    ])
    output.push(
      ...Array.from(new TextEncoder().encode("MTrk")),
      ...writeU32(body.length),
      ...body,
    )
  }

  return Uint8Array.from(output)
}

/** Convert renumbered note events (channels 1–8) into MidiNote[] per lane index 0–7. */
export function renumberedCaptureToLaneNotes(
  events: RenumberedCaptureEvent[],
  bpm: number,
  beatZeroOffsetSeconds = 0,
  ppq = 480,
): MidiNote[][] {
  const lanes: MidiNote[][] = Array.from({ length: 8 }, () => [])
  const open = new Map<string, { tick: number; velocity: number; note: number }>()

  const timed = events
    .filter((event) => event.channel >= 1 && event.channel <= 8)
    .map((event) => ({
      ...event,
      tick: secondsToSectionTicks(event.timeSeconds, bpm, beatZeroOffsetSeconds, ppq),
    }))
    .sort((a, b) => a.tick - b.tick)

  for (const event of timed) {
    const kind = event.status & 0xf0
    if (kind !== 0x80 && kind !== 0x90) continue
    const note = event.data[0] & 0x7f
    const velocity = event.data[1] ?? 0
    const key = `${event.channel}-${note}`
    const laneIndex = event.channel - 1

    if (kind === 0x90 && velocity > 0) {
      open.set(key, { tick: event.tick, velocity, note })
    } else {
      const start = open.get(key)
      if (!start) continue
      lanes[laneIndex].push({
        tick: Math.round(start.tick),
        duration: Math.max(1, Math.round(event.tick - start.tick)),
        note: start.note,
        velocity: start.velocity,
      })
      open.delete(key)
    }
  }

  // Force-snap notes to zero like export
  let leading = Infinity
  for (const lane of lanes) {
    for (const note of lane) {
      if (note.tick < leading) leading = note.tick
    }
  }
  if (Number.isFinite(leading) && Math.abs(leading) >= 0.00001) {
    for (const lane of lanes) {
      for (const note of lane) {
        note.tick = Math.max(0, note.tick - leading)
      }
    }
  }

  return lanes
}
