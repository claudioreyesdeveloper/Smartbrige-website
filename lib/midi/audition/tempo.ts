import type { CanonicalMidiDocument, CanonicalMidiEvent } from "@/lib/midi/contract"
import { DEFAULT_BPM } from "./types"

/** Microseconds per quarter note at the given BPM. */
export function microsecondsPerQuarterFromBpm(bpm: number): number {
  const safe = Math.max(1, bpm)
  return Math.round(60_000_000 / safe)
}

export function bpmFromMicrosecondsPerQuarter(usPerQuarter: number): number {
  if (usPerQuarter <= 0) return DEFAULT_BPM
  return 60_000_000 / usPerQuarter
}

export type TempoPoint = {
  tick: number
  microsecondsPerQuarter: number
}

/**
 * Build a tempo map from Set Tempo (0x51) meta events across all tracks.
 * Points are sorted by tick; same-tick later sequence/track wins by last-write.
 */
export function buildTempoMap(
  document: CanonicalMidiDocument,
  initialBpm = DEFAULT_BPM,
): TempoPoint[] {
  const points: TempoPoint[] = [
    {
      tick: 0,
      microsecondsPerQuarter: microsecondsPerQuarterFromBpm(initialBpm),
    },
  ]

  const tempoEvents: Array<{ tick: number; trackIndex: number; sequence: number; us: number }> = []
  document.tracks.forEach((track, trackIndex) => {
    for (const event of track.events) {
      const us = readTempoMicroseconds(event)
      if (us === null) continue
      tempoEvents.push({ tick: event.tick, trackIndex, sequence: event.sequence, us })
    }
  })

  tempoEvents.sort(
    (left, right) =>
      left.tick - right.tick ||
      left.trackIndex - right.trackIndex ||
      left.sequence - right.sequence,
  )

  for (const event of tempoEvents) {
    const last = points[points.length - 1]
    if (last.tick === event.tick) {
      last.microsecondsPerQuarter = event.us
    } else {
      points.push({ tick: event.tick, microsecondsPerQuarter: event.us })
    }
  }

  return points
}

export function readTempoMicroseconds(event: CanonicalMidiEvent): number | null {
  if (event.kind !== "meta" || event.metaType !== 0x51 || event.data.length < 3) {
    return null
  }
  return ((event.data[0] << 16) | (event.data[1] << 8) | event.data[2]) >>> 0
}

/** Convert an absolute tick to milliseconds from tick 0 using the tempo map. */
export function tickToMs(
  tick: number,
  ticksPerQuarter: number,
  tempoMap: TempoPoint[],
): number {
  if (tick <= 0) return 0
  const tpq = Math.max(1, ticksPerQuarter)
  let ms = 0
  let cursor = 0
  let tempoIndex = 0

  while (cursor < tick) {
    const current = tempoMap[tempoIndex] ?? tempoMap[0]
    const next = tempoMap[tempoIndex + 1]
    const segmentEnd = next ? Math.min(tick, next.tick) : tick
    const deltaTicks = Math.max(0, segmentEnd - cursor)
    ms += (deltaTicks * current.microsecondsPerQuarter) / tpq / 1000
    cursor = segmentEnd
    if (next && cursor >= next.tick) tempoIndex += 1
    else break
  }

  return ms
}

export function msPerTickAt(
  tick: number,
  ticksPerQuarter: number,
  tempoMap: TempoPoint[],
): number {
  const tpq = Math.max(1, ticksPerQuarter)
  let current = tempoMap[0]
  for (const point of tempoMap) {
    if (point.tick > tick) break
    current = point
  }
  return current.microsecondsPerQuarter / tpq / 1000
}
