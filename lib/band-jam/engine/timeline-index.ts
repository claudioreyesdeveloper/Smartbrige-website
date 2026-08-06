import type {
  Arrangement,
  BandPart,
  LoopRange,
  NoteEvent,
  PartEvents,
} from "@/lib/band-jam/engine/types"
import { BEATS_PER_BAR } from "@/lib/band-jam/engine/types"

export type IndexedPartEvents = {
  part: BandPart
  events: NoteEvent[]
}

export type ScheduledEvent = {
  event: NoteEvent
  playbackBeat: number
}

/** Build stable, beat-sorted per-part arrays once when an arrangement is installed. */
export function buildArrangementEventIndex(
  arrangement: Arrangement,
): IndexedPartEvents[] {
  return arrangement.parts.map(({ part, events }: PartEvents) => ({
    part,
    events: [...events].sort((a, b) => a.beat - b.beat),
  }))
}

/** Convert a 1-indexed inclusive bar loop into half-open beat bounds. */
export function loopToBeats(loop: LoopRange): { start: number; end: number } {
  return {
    start: (loop.startBar - 1) * BEATS_PER_BAR,
    end: loop.endBar * BEATS_PER_BAR,
  }
}

type TimelineSegment = {
  arrangementFrom: number
  arrangementTo: number
  playbackFrom: number
}

/**
 * Convert a monotonic playback window into one or more non-wrapping arrangement
 * windows. This is shared by audio and MIDI so loop recurrence cannot drift.
 */
export function timelineSegmentsForPlaybackSpan(
  fromBeat: number,
  toBeat: number,
  totalBeats: number,
  loop: LoopRange | null,
): TimelineSegment[] {
  if (!(toBeat > fromBeat) || totalBeats <= 0) return []
  const from = Math.max(0, fromBeat)
  if (!(toBeat > from)) return []

  const out: TimelineSegment[] = []
  const loopRange = loop
    ? {
        start: (loop.startBar - 1) * BEATS_PER_BAR,
        end: loop.endBar * BEATS_PER_BAR,
      }
    : null
  const validLoop =
    loopRange &&
    loopRange.end > loopRange.start &&
    loopRange.start >= 0 &&
    loopRange.end <= totalBeats
      ? loopRange
      : null

  if (validLoop && from < validLoop.start) {
    const directEnd = Math.min(toBeat, validLoop.start)
    if (directEnd > from) {
      out.push({
        arrangementFrom: from,
        arrangementTo: directEnd,
        playbackFrom: from,
      })
    }
  }

  const base = validLoop?.start ?? 0
  const period = validLoop
    ? validLoop.end - validLoop.start
    : totalBeats
  const repeatedFrom = Math.max(from, base)
  if (!(toBeat > repeatedFrom) || period <= 0) return out

  let pass = Math.floor((repeatedFrom - base) / period)
  let playbackCursor = repeatedFrom
  // A scheduler chunk is normally <= one bar. The guard protects malformed
  // sub-beat loops from producing unbounded work while still covering them.
  for (let guard = 0; playbackCursor < toBeat && guard < 64; guard += 1) {
    const passStart = base + pass * period
    const passEnd = passStart + period
    const segmentStart = Math.max(playbackCursor, passStart)
    const segmentEnd = Math.min(toBeat, passEnd)
    if (segmentEnd > segmentStart) {
      out.push({
        arrangementFrom: base + (segmentStart - passStart),
        arrangementTo: base + (segmentEnd - passStart),
        playbackFrom: segmentStart,
      })
    }
    playbackCursor = segmentEnd
    pass += 1
  }
  return out
}

/** Return only events that can start in the requested playback window. */
export function scheduledEventsForSpan(
  sortedEvents: NoteEvent[],
  fromBeat: number,
  toBeat: number,
  totalBeats: number,
  loop: LoopRange | null,
): ScheduledEvent[] {
  const out: ScheduledEvent[] = []
  for (const segment of timelineSegmentsForPlaybackSpan(
    fromBeat,
    toBeat,
    totalBeats,
    loop,
  )) {
    const start = lowerBound(sortedEvents, segment.arrangementFrom)
    for (let index = start; index < sortedEvents.length; index += 1) {
      const event = sortedEvents[index]
      if (event.beat >= segment.arrangementTo) break
      out.push({
        event,
        playbackBeat:
          segment.playbackFrom + (event.beat - segment.arrangementFrom),
      })
    }
  }
  return out
}

function lowerBound(events: NoteEvent[], beat: number): number {
  let low = 0
  let high = events.length
  while (low < high) {
    const middle = Math.floor((low + high) / 2)
    if (events[middle].beat < beat) low = middle + 1
    else high = middle
  }
  return low
}
