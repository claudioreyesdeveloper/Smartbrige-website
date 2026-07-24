/**
 * Desktop StyleMakerEngine section length helpers.
 * Changing Bars updates StyleSectionRecipe::bars; clips are looped/truncated
 * to section.bars × beatsPerBar at render/audition (appendClipSmfLoopedAsBeats).
 */

import type { MidiNote } from "@/lib/demo/style-midi"
import type { StyleSectionRange } from "@/lib/demo/style-midi"

export const DEFAULT_BEATS_PER_BAR = 4

export function ticksPerBar(
  ticksPerQuarter: number,
  beatsPerBar = DEFAULT_BEATS_PER_BAR,
): number {
  return Math.max(1, Math.round(ticksPerQuarter) * Math.max(1, beatsPerBar))
}

/** Donor marker span → bar count (ceil), matching desktop donorBars. */
export function donorSectionBars(
  range: Pick<StyleSectionRange, "startTick" | "endTick">,
  ticksPerQuarter: number,
  beatsPerBar = DEFAULT_BEATS_PER_BAR,
): number {
  const barTicks = ticksPerBar(ticksPerQuarter, beatsPerBar)
  const span = Math.max(0, range.endTick - range.startTick)
  return Math.max(1, Math.ceil(span / barTicks))
}

export function sectionTargetTicks(
  bars: number,
  ticksPerQuarter: number,
  beatsPerBar = DEFAULT_BEATS_PER_BAR,
): number {
  return Math.max(1, Math.round(bars)) * ticksPerBar(ticksPerQuarter, beatsPerBar)
}

/**
 * StyleMakerEngine.cpp appendClipSmfLoopedAsBeats — note-level port.
 * Loops (or truncates) a take so it fills targetTicks; cycleTicks is the
 * source loop period (assignment.bars × bar ticks / detected cycle).
 */
export function loopNotesToTargetTicks(
  notes: MidiNote[],
  cycleTicks: number,
  targetTicks: number,
): MidiNote[] {
  if (!notes.length || targetTicks <= 0) return []
  const cycle = Math.max(1, Math.round(cycleTicks))
  const target = Math.max(1, Math.round(targetTicks))
  const out: MidiNote[] = []
  for (let offset = 0; offset < target; offset += cycle) {
    const remaining = target - offset
    for (const note of notes) {
      if (note.tick >= remaining) continue
      const duration = Math.min(
        Math.max(1, note.duration),
        Math.max(1, remaining - note.tick),
      )
      out.push({
        ...note,
        tick: offset + note.tick,
        duration,
      })
    }
  }
  return out
}
