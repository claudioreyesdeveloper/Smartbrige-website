import { describe, expect, it } from "vitest"
import {
  scheduledEventsForSpan,
  timelineSegmentsForPlaybackSpan,
} from "@/lib/band-jam/engine/timeline-index"
import type { NoteEvent } from "@/lib/band-jam/engine/types"

const events: NoteEvent[] = [
  { beat: 0, note: 60, velocity: 100, durationBeats: 1 },
  { beat: 4, note: 61, velocity: 100, durationBeats: 1 },
  { beat: 8, note: 62, velocity: 100, durationBeats: 1 },
  { beat: 11.5, note: 63, velocity: 100, durationBeats: 0.5 },
]

describe("timelineSegmentsForPlaybackSpan", () => {
  it("splits a span at a loop wrap", () => {
    expect(
      timelineSegmentsForPlaybackSpan(11, 13, 16, { startBar: 2, endBar: 3 }),
    ).toEqual([
      { arrangementFrom: 11, arrangementTo: 12, playbackFrom: 11 },
      { arrangementFrom: 4, arrangementTo: 5, playbackFrom: 12 },
    ])
  })

  it("ignores negative count-in playback beats", () => {
    expect(timelineSegmentsForPlaybackSpan(-4, 1, 16, null)).toEqual([
      { arrangementFrom: 0, arrangementTo: 1, playbackFrom: 0 },
    ])
  })
})

describe("scheduledEventsForSpan", () => {
  it("uses binary-ranged events for a normal span", () => {
    expect(scheduledEventsForSpan(events, 3.5, 8.5, 16, null)).toEqual([
      { event: events[1], playbackBeat: 4 },
      { event: events[2], playbackBeat: 8 },
    ])
  })

  it("repeats loop events on the next playback pass", () => {
    expect(
      scheduledEventsForSpan(events, 11, 13, 16, { startBar: 2, endBar: 3 }),
    ).toEqual([
      { event: events[3], playbackBeat: 11.5 },
      { event: events[1], playbackBeat: 12 },
    ])
  })
})
