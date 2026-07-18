export const MIDI_CONTRACT_VERSION = 1 as const

export type MidiFormat = 0 | 1 | 2

export type CanonicalChannelEvent = {
  kind: "channel"
  tick: number
  sequence: number
  status: number
  data: number[]
}

export type CanonicalMetaEvent = {
  kind: "meta"
  tick: number
  sequence: number
  metaType: number
  data: Uint8Array
}

export type CanonicalSysExEvent = {
  kind: "sysex"
  tick: number
  sequence: number
  status: 0xf0 | 0xf7
  data: Uint8Array
}

export type CanonicalMidiEvent =
  | CanonicalChannelEvent
  | CanonicalMetaEvent
  | CanonicalSysExEvent

export type CanonicalMidiTrack = {
  events: CanonicalMidiEvent[]
  endTick: number
}

export type CanonicalMidiDocument = {
  version: typeof MIDI_CONTRACT_VERSION
  format: MidiFormat
  ticksPerQuarter: number
  tracks: CanonicalMidiTrack[]
}

export function compareMidiEvents(
  left: CanonicalMidiEvent,
  right: CanonicalMidiEvent,
): number {
  return left.tick - right.tick || left.sequence - right.sequence
}

export function sortMidiEvents(events: CanonicalMidiEvent[]): CanonicalMidiEvent[] {
  return [...events].sort(compareMidiEvents)
}

export function cloneMidiDocument(
  document: CanonicalMidiDocument,
): CanonicalMidiDocument {
  return {
    version: document.version,
    format: document.format,
    ticksPerQuarter: document.ticksPerQuarter,
    tracks: document.tracks.map((track) => ({
      endTick: track.endTick,
      events: track.events.map((event) => {
        if (event.kind === "channel") {
          return { ...event, data: [...event.data] }
        }
        if (event.kind === "meta") {
          return { ...event, data: Uint8Array.from(event.data) }
        }
        return { ...event, data: Uint8Array.from(event.data) }
      }),
    })),
  }
}

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false
  }
  return true
}

export function midiEventsEqual(
  left: CanonicalMidiEvent,
  right: CanonicalMidiEvent,
): boolean {
  if (left.kind !== right.kind || left.tick !== right.tick || left.sequence !== right.sequence) {
    return false
  }
  if (left.kind === "channel" && right.kind === "channel") {
    return left.status === right.status && left.data.length === right.data.length &&
      left.data.every((byte, index) => byte === right.data[index])
  }
  if (left.kind === "meta" && right.kind === "meta") {
    return left.metaType === right.metaType && bytesEqual(left.data, right.data)
  }
  if (left.kind === "sysex" && right.kind === "sysex") {
    return left.status === right.status && bytesEqual(left.data, right.data)
  }
  return false
}

export function midiDocumentsEqual(
  left: CanonicalMidiDocument,
  right: CanonicalMidiDocument,
): boolean {
  if (
    left.version !== right.version ||
    left.format !== right.format ||
    left.ticksPerQuarter !== right.ticksPerQuarter ||
    left.tracks.length !== right.tracks.length
  ) {
    return false
  }
  return left.tracks.every((track, trackIndex) => {
    const other = right.tracks[trackIndex]
    if (track.endTick !== other.endTick || track.events.length !== other.events.length) {
      return false
    }
    return track.events.every((event, eventIndex) =>
      midiEventsEqual(event, other.events[eventIndex]),
    )
  })
}

export function isNoteOnEvent(event: CanonicalMidiEvent): event is CanonicalChannelEvent {
  return event.kind === "channel" && (event.status & 0xf0) === 0x90
}

export function isNoteOffEvent(event: CanonicalMidiEvent): event is CanonicalChannelEvent {
  return event.kind === "channel" &&
    ((event.status & 0xf0) === 0x80 ||
      ((event.status & 0xf0) === 0x90 && (event.data[1] ?? 0) === 0))
}

export function isControlChangeEvent(event: CanonicalMidiEvent): event is CanonicalChannelEvent {
  return event.kind === "channel" && (event.status & 0xf0) === 0xb0
}

export function isProgramChangeEvent(event: CanonicalMidiEvent): event is CanonicalChannelEvent {
  return event.kind === "channel" && (event.status & 0xf0) === 0xc0
}
