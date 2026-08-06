import type {
  BandPart,
  BandStyle,
  NoteEvent,
  Progression,
} from "@/lib/band-jam/engine/types"

export type ClipRecord = {
  sourceKeyPc: number
  events: NoteEvent[]
}

export type CatalogIntegrityIssue = {
  kind: "missing_clip" | "empty_style" | "empty_progression" | "invalid_clip"
  message: string
}

const PARTS: BandPart[] = ["drums", "bass", "guitar", "keys", "solo"]

/** Validate generated catalogue references before the user reaches playback. */
export function validateJamPlayerCatalog(
  styles: BandStyle[],
  progressions: Progression[],
  clips: Map<number, ClipRecord>,
): CatalogIntegrityIssue[] {
  const issues: CatalogIntegrityIssue[] = []

  for (const progression of progressions) {
    if (progression.sections.length === 0) {
      issues.push({
        kind: "empty_progression",
        message: `Progression "${progression.id}" has no sections.`,
      })
    }
  }

  for (const style of styles) {
    const referenced = clipIdsForStyle(style)
    for (const clipId of referenced) {
      const clip = clips.get(clipId)
      if (!clip) {
        issues.push({
          kind: "missing_clip",
          message: `Style "${style.id}" references missing clip ${clipId}.`,
        })
        continue
      }
      if (!Array.isArray(clip.events)) {
        issues.push({
          kind: "invalid_clip",
          message: `Clip ${clipId} does not contain an event array.`,
        })
      }
    }
    if (referenced.length === 0) {
      issues.push({
        kind: "empty_style",
        message: `Style "${style.id}" has no playable clip references.`,
      })
    }
  }

  return issues
}

function collectClipIds(definition: NonNullable<BandStyle["parts"][BandPart]>): number[] {
  const ids = new Set<number>()
  const add = (value: unknown) => {
    if (typeof value === "number" && Number.isFinite(value)) ids.add(value)
  }

  Object.values(definition.slots ?? {}).forEach(add)
  for (const variations of Object.values(definition.variations ?? {})) {
    variations?.forEach(add)
  }
  add(definition.reuseClipId)
  definition.fills?.pool.forEach(add)
  definition.fills?.variationPools?.forEach((pool) => pool?.forEach(add))
  definition.intensityLadder?.forEach(add)

  return [...ids]
}

/** Every clip id reachable from a style, including fills and density variants. */
export function clipIdsForStyle(style: BandStyle): number[] {
  const ids = new Set<number>()
  for (const part of PARTS) {
    const definition = style.parts[part]
    if (!definition) continue
    collectClipIds(definition).forEach((id) => ids.add(id))
  }
  return [...ids].sort((a, b) => a - b)
}
