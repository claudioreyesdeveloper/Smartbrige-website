import { readU16, readU32 } from "./binary"
import {
  MIDI_CONTRACT_VERSION,
  type CanonicalMidiDocument,
  type CanonicalMidiEvent,
  type CanonicalMidiTrack,
  type MidiFormat,
} from "./contract"
import { readVlq } from "./vlq"

function parseTrack(data: Uint8Array): CanonicalMidiTrack {
  const events: CanonicalMidiEvent[] = []
  let offset = 0
  let tick = 0
  let runningStatus = 0
  let sequence = 0

  while (offset < data.length) {
    const [delta, afterDelta] = readVlq(data, offset)
    offset = afterDelta
    tick += delta
    if (offset >= data.length) break

    let status = data[offset]
    if (status < 0x80) {
      if (!runningStatus) {
        throw new Error("MIDI track uses running status before a status byte.")
      }
      status = runningStatus
    } else {
      offset += 1
      if (status < 0xf0) runningStatus = status
    }

    if (status === 0xff) {
      const metaType = data[offset++]
      const [length, afterLength] = readVlq(data, offset)
      offset = afterLength
      const payload = data.slice(offset, offset + length)
      offset += length
      runningStatus = 0
      events.push({
        kind: "meta",
        tick,
        sequence: sequence++,
        metaType,
        data: Uint8Array.from(payload),
      })
      continue
    }

    if (status === 0xf0 || status === 0xf7) {
      const [length, afterLength] = readVlq(data, offset)
      offset = afterLength
      const payload = data.slice(offset, offset + length)
      offset += length
      runningStatus = 0
      events.push({
        kind: "sysex",
        tick,
        sequence: sequence++,
        status,
        data: Uint8Array.from(payload),
      })
      continue
    }

    const kind = status & 0xf0
    const length = kind === 0xc0 || kind === 0xd0 ? 1 : 2
    const payload = Array.from(data.slice(offset, offset + length))
    offset += length
    events.push({
      kind: "channel",
      tick,
      sequence: sequence++,
      status,
      data: payload,
    })
  }

  return { events, endTick: tick }
}

export function importSmf(bytes: Uint8Array): CanonicalMidiDocument {
  if (bytes.length < 14 || String.fromCharCode(...bytes.slice(0, 4)) !== "MThd") {
    throw new Error("This is not a Standard MIDI file.")
  }

  const headerLength = readU32(bytes, 4)
  const format = readU16(bytes, 8) as MidiFormat
  const trackCount = readU16(bytes, 10)
  const division = readU16(bytes, 12)

  if (division & 0x8000) {
    throw new Error("SMPTE-timed MIDI is not supported.")
  }
  if (!trackCount || !division) {
    throw new Error("The MIDI file has no playable tracks.")
  }
  if (format < 0 || format > 2) {
    throw new Error(`Unsupported MIDI format ${format}.`)
  }

  let offset = 8 + headerLength
  const tracks: CanonicalMidiTrack[] = []
  for (let index = 0; index < trackCount; index += 1) {
    if (String.fromCharCode(...bytes.slice(offset, offset + 4)) !== "MTrk") {
      throw new Error(`Missing MIDI track ${index + 1}.`)
    }
    const length = readU32(bytes, offset + 4)
    const start = offset + 8
    const end = start + length
    if (end > bytes.length) {
      throw new Error("The MIDI file contains a truncated track.")
    }
    tracks.push(parseTrack(bytes.slice(start, end)))
    offset = end
  }

  if (offset < bytes.length) {
    throw new Error("The MIDI file contains trailing bytes after the last track.")
  }

  return {
    version: MIDI_CONTRACT_VERSION,
    format,
    ticksPerQuarter: division,
    tracks,
  }
}
