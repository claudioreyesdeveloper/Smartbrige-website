import { displaySectionNameFromMarker } from "@/lib/style-maker/section-names"

export type MidiNote = {
  tick: number
  duration: number
  note: number
  velocity: number
}

export type MidiPreviewEvent = {
  tick: number
  status: number
  data: number[]
}

export type MidiEvent = {
  tick: number
  order: number
  status: number
  data: number[]
}

export type ParsedTrack = {
  events: MidiEvent[]
  endTick: number
}

export type ParsedYamahaStyle = {
  format: number
  ticksPerQuarter: number
  /** First Set Tempo meta (BPM), or 120 when the file has none. */
  bpm: number
  tracks: ParsedTrack[]
  yamahaTail: Uint8Array
  originalBytes: Uint8Array
}

export type StyleSectionRange = {
  id: string
  /** Desktop Style Maker display name (Intro 1, Fill A, …). */
  label: string
  /**
   * Yamaha MIDI marker / CASM Sdec name (Intro A, Fill In AA, …).
   * Defaults to label when the marker is already in Yamaha form.
   */
  templateSection?: string
  startTick: number
  endTick: number
}

const readU16 = (data: Uint8Array, offset: number) =>
  (data[offset] << 8) | data[offset + 1]
const readU32 = (data: Uint8Array, offset: number) =>
  data[offset] * 0x1000000 +
  (data[offset + 1] << 16) +
  (data[offset + 2] << 8) +
  data[offset + 3]

const writeU16 = (value: number) => [(value >> 8) & 0xff, value & 0xff]
const writeU32 = (value: number) => [
  (value >>> 24) & 0xff,
  (value >>> 16) & 0xff,
  (value >>> 8) & 0xff,
  value & 0xff,
]

function readVlq(data: Uint8Array, start: number): [number, number] {
  let value = 0
  let offset = start
  for (let count = 0; count < 4 && offset < data.length; count += 1) {
    const byte = data[offset++]
    value = (value << 7) | (byte & 0x7f)
    if (!(byte & 0x80)) return [value, offset]
  }
  throw new Error("Invalid MIDI variable-length value.")
}

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

function parseTrack(data: Uint8Array): ParsedTrack {
  const events: MidiEvent[] = []
  let offset = 0
  let tick = 0
  let runningStatus = 0
  let order = 0

  while (offset < data.length) {
    const [delta, afterDelta] = readVlq(data, offset)
    offset = afterDelta
    tick += delta
    if (offset >= data.length) break

    let status = data[offset]
    if (status < 0x80) {
      if (!runningStatus) throw new Error("MIDI track uses running status before a status byte.")
      status = runningStatus
    } else {
      offset += 1
      if (status < 0xf0) runningStatus = status
    }

    let payload: number[]
    if (status === 0xff) {
      const type = data[offset++]
      const [length, afterLength] = readVlq(data, offset)
      offset = afterLength
      payload = [type, ...writeVlq(length), ...data.slice(offset, offset + length)]
      offset += length
      runningStatus = 0
    } else if (status === 0xf0 || status === 0xf7) {
      const [length, afterLength] = readVlq(data, offset)
      offset = afterLength
      payload = [...writeVlq(length), ...data.slice(offset, offset + length)]
      offset += length
      runningStatus = 0
    } else {
      const kind = status & 0xf0
      const length = kind === 0xc0 || kind === 0xd0 ? 1 : 2
      payload = Array.from(data.slice(offset, offset + length))
      offset += length
    }
    events.push({ tick, order: order++, status, data: payload })
  }
  return { events, endTick: tick }
}

function tempoBpmFromMetaData(data: number[]): number | null {
  // Meta payload layout from parseTrack: [type, ...VLQ(length), ...bytes]
  if (data[0] !== 0x51 || data.length < 3) return null
  let offset = 1
  let length = 0
  for (let count = 0; count < 4 && offset < data.length; count += 1) {
    const byte = data[offset++]
    length = (length << 7) | (byte & 0x7f)
    if (!(byte & 0x80)) break
  }
  if (length < 3 || offset + 2 >= data.length) {
    // length VLQ may be omitted in odd encodings; try last 3 bytes
    if (data.length >= 4) {
      const us =
        (data[data.length - 3] << 16) |
        (data[data.length - 2] << 8) |
        data[data.length - 1]
      if (us > 0) return Math.max(20, Math.min(300, Math.round(60_000_000 / us)))
    }
    return null
  }
  const microseconds =
    (data[offset] << 16) | (data[offset + 1] << 8) | data[offset + 2]
  if (microseconds <= 0) return null
  return Math.max(20, Math.min(300, Math.round(60_000_000 / microseconds)))
}

/** First tempo meta in the MIDI (StyleTemplateService::inspectTemplate path). */
export function extractStyleBpm(style: ParsedYamahaStyle): number {
  for (const track of style.tracks) {
    for (const event of track.events) {
      if (event.status !== 0xff) continue
      const bpm = tempoBpmFromMetaData(event.data)
      if (bpm) return bpm
    }
  }
  return style.bpm || 120
}

export function parseYamahaStyle(bytes: Uint8Array): ParsedYamahaStyle {
  if (
    bytes.length < 14 ||
    String.fromCharCode(...bytes.slice(0, 4)) !== "MThd"
  ) {
    throw new Error("This is not a Standard MIDI/Yamaha style file.")
  }
  const headerLength = readU32(bytes, 4)
  const format = readU16(bytes, 8)
  const trackCount = readU16(bytes, 10)
  const division = readU16(bytes, 12)
  if (division & 0x8000) throw new Error("SMPTE-timed MIDI is not supported.")
  if (!trackCount || !division) throw new Error("The style has no playable MIDI tracks.")

  let offset = 8 + headerLength
  const tracks: ParsedTrack[] = []
  for (let index = 0; index < trackCount; index += 1) {
    if (String.fromCharCode(...bytes.slice(offset, offset + 4)) !== "MTrk") {
      throw new Error(`Missing MIDI track ${index + 1}.`)
    }
    const length = readU32(bytes, offset + 4)
    const start = offset + 8
    const end = start + length
    if (end > bytes.length) throw new Error("The style contains a truncated MIDI track.")
    tracks.push(parseTrack(bytes.slice(start, end)))
    offset = end
  }

  let bpm = 120
  outer: for (const track of tracks) {
    for (const event of track.events) {
      if (event.status !== 0xff) continue
      const found = tempoBpmFromMetaData(event.data)
      if (found) {
        bpm = found
        break outer
      }
    }
  }

  return {
    format,
    ticksPerQuarter: division,
    bpm,
    tracks,
    yamahaTail: bytes.slice(offset),
    originalBytes: bytes,
  }
}

export function serializeTrack(track: ParsedTrack): Uint8Array {
  const body: number[] = []
  let lastTick = 0
  const events = [...track.events].sort(
    (a, b) => a.tick - b.tick || a.order - b.order,
  )
  const withoutEnd = events.filter(
    (event) => !(event.status === 0xff && event.data[0] === 0x2f),
  )
  for (const event of withoutEnd) {
    body.push(...writeVlq(event.tick - lastTick), event.status, ...event.data)
    lastTick = event.tick
  }
  body.push(...writeVlq(Math.max(0, track.endTick - lastTick)), 0xff, 0x2f, 0x00)
  return Uint8Array.from(body)
}

export function notesToEvents(
  notes: MidiNote[],
  channel: number,
  repeatTicks: number,
  endTick: number,
  startingOrder: number,
  rangeStart = 0,
): MidiEvent[] {
  const events: MidiEvent[] = []
  let order = startingOrder
  const cycle = Math.max(1, repeatTicks)
  for (let offset = rangeStart; offset < endTick; offset += cycle) {
    for (const note of notes) {
      const start = offset + note.tick
      if (start >= endTick) continue
      const end = Math.min(endTick, start + Math.max(1, note.duration))
      events.push({
        tick: start,
        order: order++,
        status: 0x90 | channel,
        data: [note.note & 0x7f, Math.max(1, Math.min(127, note.velocity))],
      })
      events.push({
        tick: end,
        order: order++,
        status: 0x80 | channel,
        data: [note.note & 0x7f, 0],
      })
    }
  }
  return events
}

export function replaceStyleLanes(
  style: ParsedYamahaStyle,
  replacements: {
    bass?: { notes: MidiNote[]; cycleTicks: number }
    drums?: { notes: MidiNote[]; cycleTicks: number }
    range?: StyleSectionRange
  },
): Uint8Array {
  const tracks = style.tracks.map((track) => ({
    endTick: track.endTick,
    events: track.events.map((event) => ({ ...event, data: [...event.data] })),
  }))
  const target = tracks[0]
  const endTick = Math.max(...tracks.map((track) => track.endTick))
  let order = Math.max(0, ...target.events.map((event) => event.order)) + 1
  const noteChannels = tracks.flatMap((track) =>
    track.events
      .filter((event) => {
        const kind = event.status & 0xf0
        return kind === 0x80 || kind === 0x90
      })
      .map((event) => event.status & 0x0f),
  )
  const nativeStyleChannels = noteChannels.filter((channel) => channel >= 8).length
    > noteChannels.filter((channel) => channel < 8).length
  const channelBase = nativeStyleChannels ? 8 : 0
  const rangeStart = Math.max(0, replacements.range?.startTick || 0)
  const rangeEnd = Math.min(endTick, replacements.range?.endTick || endTick)

  const removeNotesOnChannels = (channels: number[]) => {
    tracks.forEach((track) => {
      track.events = track.events.filter((event) => {
        const kind = event.status & 0xf0
        const channel = event.status & 0x0f
        return !(
          (kind === 0x80 || kind === 0x90) &&
          channels.includes(channel) &&
          event.tick >= rangeStart &&
          event.tick < rangeEnd
        )
      })
    })
  }

  if (replacements.drums) {
    removeNotesOnChannels([1, 9])
    const events = notesToEvents(
      replacements.drums.notes,
      channelBase + 1,
      replacements.drums.cycleTicks,
      rangeEnd,
      order,
      rangeStart,
    )
    order += events.length
    target.events.push(...events)
  }
  if (replacements.bass) {
    removeNotesOnChannels([2, 10])
    const events = notesToEvents(
      replacements.bass.notes,
      channelBase + 2,
      replacements.bass.cycleTicks,
      rangeEnd,
      order,
      rangeStart,
    )
    target.events.push(...events)
  }

  const output: number[] = [
    ...Array.from(style.originalBytes.slice(0, 8 + readU32(style.originalBytes, 4))),
  ]
  tracks.forEach((track) => {
    const data = serializeTrack(track)
    output.push(...Array.from(new TextEncoder().encode("MTrk")), ...writeU32(data.length), ...data)
  })
  output.push(...style.yamahaTail)
  return Uint8Array.from(output)
}

export function extractStyleSections(style: ParsedYamahaStyle): StyleSectionRange[] {
  const endTick = Math.max(...style.tracks.map((track) => track.endTick))
  const markers = style.tracks
    .flatMap((track) => track.events)
    .filter((event) => event.status === 0xff && event.data[0] === 0x06)
    .map((event) => {
      const bytes = Uint8Array.from(event.data)
      const [length, textStart] = readVlq(bytes, 1)
      const label = new TextDecoder()
        .decode(bytes.slice(textStart, textStart + length))
        .replace(/\0/g, "")
        .trim()
      return { tick: event.tick, label }
    })
    .filter(({ label }) => /^(intro|main|fill|break|ending)/i.test(label))
    .sort((a, b) => a.tick - b.tick)

  if (!markers.length) {
    return [
      {
        id: "main-a",
        label: "Main A",
        templateSection: "Main A",
        startTick: 0,
        endTick,
      },
    ]
  }

  // Display names match desktop Style Maker (Intro 1, Fill A); keep Yamaha
  // marker in templateSection for CASM / MIDI source lookup.
  return markers
    .map((marker, index) => {
      const templateSection = marker.label.trim()
      const label = displaySectionNameFromMarker(templateSection)
      return {
        id: `${templateSection.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${marker.tick}`,
        label,
        templateSection,
        startTick: marker.tick,
        endTick: markers[index + 1]?.tick || endTick,
      }
    })
    .filter((section) => section.endTick > section.startTick)
}

export function patternToMidiNotes(
  notes: number[][],
  ticksPerQuarter: number,
): MidiNote[] {
  return notes.map(([beat, note, duration, velocity]) => ({
    tick: Math.round(beat * ticksPerQuarter),
    duration: Math.max(1, Math.round(duration * ticksPerQuarter)),
    note,
    velocity,
  }))
}

export function extractMidiNotes(bytes: Uint8Array): {
  notes: MidiNote[]
  cycleTicks: number
  ticksPerQuarter: number
} {
  const parsed = parseYamahaStyle(bytes)
  const open = new Map<string, { tick: number; velocity: number; note: number }>()
  const notes: MidiNote[] = []
  parsed.tracks.forEach((track, trackIndex) => {
    track.events.forEach((event) => {
      const kind = event.status & 0xf0
      if (kind !== 0x80 && kind !== 0x90) return
      const note = event.data[0]
      const key = `${trackIndex}-${event.status & 0x0f}-${note}`
      if (kind === 0x90 && event.data[1] > 0) {
        open.set(key, { tick: event.tick, velocity: event.data[1], note })
      } else {
        const start = open.get(key)
        if (!start) return
        notes.push({
          tick: start.tick,
          duration: Math.max(1, event.tick - start.tick),
          note: start.note,
          velocity: start.velocity,
        })
        open.delete(key)
      }
    })
  })
  if (!notes.length) throw new Error("The uploaded MIDI file contains no notes.")
  const firstTick = Math.min(...notes.map((note) => note.tick))
  notes.forEach((note) => (note.tick -= firstTick))
  const lastTick = Math.max(...notes.map((note) => note.tick + note.duration))
  const barTicks = parsed.ticksPerQuarter * 4
  return {
    notes,
    cycleTicks: Math.max(barTicks, Math.ceil(lastTick / barTicks) * barTicks),
    ticksPerQuarter: parsed.ticksPerQuarter,
  }
}

export function extractStylePreviewEvents(
  style: ParsedYamahaStyle,
  options?: { bumpChannelsBelow9?: boolean },
): MidiPreviewEvent[] {
  // Demo styles often store parts on ch 1–8; bumping maps them onto Genos style
  // parts 9–16. Style Maker CASM audition must NOT bump — source channels are
  // absolute and get remapped to destinations separately.
  const bumpChannelsBelow9 = options?.bumpChannelsBelow9 !== false
  const eventPriority = (event: MidiPreviewEvent) => {
    const kind = event.status & 0xf0
    if (kind === 0xb0 && (event.data[0] === 0 || event.data[0] === 32)) return 0
    if (kind === 0xc0) return 1
    if (kind === 0x80 || (kind === 0x90 && (event.data[1] || 0) === 0)) return 2
    if (kind === 0x90) return 4
    return 3
  }
  return style.tracks
    .flatMap((track) =>
      track.events
        .filter((event) => {
          const kind = event.status & 0xf0
          return kind >= 0x80 && kind <= 0xe0
        })
        .map((event) => {
          const sourceChannel = event.status & 0x0f
          const previewChannel =
            bumpChannelsBelow9 && sourceChannel < 8
              ? sourceChannel + 8
              : sourceChannel
          return {
            tick: event.tick,
            status: (event.status & 0xf0) | previewChannel,
            data: [...event.data],
          }
        }),
    )
    .sort((a, b) => a.tick - b.tick || eventPriority(a) - eventPriority(b))
}

export function extractStyleSectionPreviewEvents(
  style: ParsedYamahaStyle,
  range: StyleSectionRange,
  channels?: number[],
  options?: { bumpChannelsBelow9?: boolean },
): MidiPreviewEvent[] {
  const events = extractStylePreviewEvents(style, options)
  const onWantedChannel = (event: MidiPreviewEvent) =>
    !channels || channels.includes(event.status & 0x0f)
  const isVoiceSetup = (event: MidiPreviewEvent) => {
    const kind = event.status & 0xf0
    return kind === 0xc0 ||
      (kind === 0xb0 && (event.data[0] === 0 || event.data[0] === 32))
  }
  const setup = new Map<string, MidiPreviewEvent>()
  events.forEach((event) => {
    if (!onWantedChannel(event) || event.tick > range.startTick || !isVoiceSetup(event)) return
    const kind = event.status & 0xf0
    const key = `${event.status & 0x0f}:${kind}:${kind === 0xb0 ? event.data[0] : 0}`
    setup.set(key, { ...event, tick: range.startTick })
  })
  const body = events.filter((event) =>
    onWantedChannel(event) &&
    event.tick >= range.startTick &&
    event.tick < range.endTick &&
    !(event.tick === range.startTick && isVoiceSetup(event)),
  )
  return [...setup.values(), ...body].sort((a, b) => a.tick - b.tick)
}
