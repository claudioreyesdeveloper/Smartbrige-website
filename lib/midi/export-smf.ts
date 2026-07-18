import { asciiBytes, writeU32 } from "./binary"
import {
  sortMidiEvents,
  type CanonicalMidiDocument,
  type CanonicalMidiEvent,
  type CanonicalMidiTrack,
} from "./contract"
import { writeVlq } from "./vlq"

function serializeEventBody(event: CanonicalMidiEvent): number[] {
  if (event.kind === "meta") {
    return [0xff, event.metaType, ...writeVlq(event.data.length), ...event.data]
  }
  if (event.kind === "sysex") {
    return [event.status, ...writeVlq(event.data.length), ...event.data]
  }
  return [event.status, ...event.data]
}

function isEndOfTrack(event: CanonicalMidiEvent): boolean {
  return event.kind === "meta" && event.metaType === 0x2f
}

export function serializeTrack(track: CanonicalMidiTrack): Uint8Array {
  const body: number[] = []
  let lastTick = 0
  const events = sortMidiEvents(track.events)
  const withoutEnd = events.filter((event) => !isEndOfTrack(event))

  for (const event of withoutEnd) {
    body.push(...writeVlq(event.tick - lastTick), ...serializeEventBody(event))
    lastTick = event.tick
  }

  body.push(...writeVlq(Math.max(0, track.endTick - lastTick)), 0xff, 0x2f, 0x00)
  return Uint8Array.from(body)
}

export function exportSmf(document: CanonicalMidiDocument): Uint8Array {
  const header = [
    ...asciiBytes("MThd"),
    ...writeU32(6),
    ...[(document.format >> 8) & 0xff, document.format & 0xff],
    ...[(document.tracks.length >> 8) & 0xff, document.tracks.length & 0xff],
    ...[
      (document.ticksPerQuarter >> 8) & 0xff,
      document.ticksPerQuarter & 0xff,
    ],
  ]

  const chunks = document.tracks.map((track) => {
    const data = serializeTrack(track)
    return [
      ...asciiBytes("MTrk"),
      ...writeU32(data.length),
      ...data,
    ]
  })

  return Uint8Array.from(header.concat(...chunks))
}
