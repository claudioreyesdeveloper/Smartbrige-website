import type {
  ChordEvent,
  CompactChordEvent,
  Progression,
} from "@/lib/band-jam/engine/types"

export const ORIGINAL_REHARM_STYLE = "Original"

function expandChord(tuple: CompactChordEvent): ChordEvent {
  const [startBeat, durationBeats, root, name, bassRoot] = tuple
  return {
    startBeat,
    durationBeats,
    root,
    name,
    ...(bassRoot === undefined ? {} : { bassRoot }),
  }
}

/**
 * Apply one of the desktop JamPlayer's named chord sets without touching the
 * performance/style data. Missing per-section variants deliberately fall
 * back to Original, matching DatabaseManager::getResolvedChordTimelineJson.
 */
export function applyReharmonization(
  progression: Progression,
  styleName: string,
): Progression {
  if (styleName === ORIGINAL_REHARM_STYLE) return progression
  const styleIndex = progression.reharmStyles?.indexOf(styleName) ?? -1
  if (styleIndex < 0) return progression
  const styleBit = 1 << styleIndex

  return {
    ...progression,
    sections: progression.sections.map((section) => {
      const group = section.reharmonizations?.find(
        ([mask]) => (mask & styleBit) !== 0,
      )
      if (!group) return section
      return { ...section, chords: group[1].map(expandChord) }
    }),
  }
}
