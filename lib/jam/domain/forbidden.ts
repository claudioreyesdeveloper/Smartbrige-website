/**
 * Keys that must never appear on public responses.
 * Defense-in-depth strip after backend output.
 */
export const FORBIDDEN_RESPONSE_KEYS = [
  "sourcePhraseId",
  "sourcePhraseIds",
  "source_phrase_id",
  "sourceClipId",
  "sourceSongId",
  "sourceSongName",
  "patternName",
  "patternNames",
  "pattern_name",
  "patternPool",
  "technique",
  "techniques",
  "techniqueId",
  "techniqueIds",
  "explanation",
  "score",
  "scores",
  "rankingScore",
  "seed",
  "seeds",
  "phraseStep",
  "phraseSteps",
  "phraseInternalId",
  "motifFamily",
  "recipe",
  "recipes",
  "trace",
  "traces",
  "algorithmSettings",
  "algorithm_settings",
  "algorithmMetadata",
  "algorithm_metadata",
  "settings",
  "internalDebug",
  "debug",
  "melodyFeatures",
  "romanTimingsJson",
  "internalId",
  "sourceKind",
  "sourceLibrary",
  "sourcePath",
  "sourceName",
  "songName",
  "clipName",
  "midiData",
  "midiReference",
  "midiSha256",
  "midiPath",
  "rawMidi",
  "sourceCandidateId",
  "sourceKeyPc",
  "candidateInternalId",
  "fillFamily",
  "family",
  "reason",
  "reasons",
  "privateRecipe",
  "privateMetadata",
  "recordKey",
  "grooveRecordKey",
  "inputDigest",
  "contextDigest",
  "outputDigest",
  "megaVoiceMap",
  "velocityMap",
  "articulationMap",
  "histogram",
  "histograms",
  "onset16",
  "onset12",
  "kick16",
  "kick12",
  "snare16",
  "snare12",
  "rankScore",
  "rankReasons",
  "weights",
  "ordinal",
  "notesPerBeat",
  "corpusVersion",
  "corpusMetadata",
  "prompt",
  "prompts",
  "systemPrompt",
  "providerRequest",
  "providerResponse",
  "model",
  "models",
  "dictionary",
  "dictionaries",
  "phonemes",
  "pronunciation",
  "pronunciations",
  "stressPattern",
  "analysedNotes",
  "syllableCapacity",
  "slotMap",
  "capacityMap",
  "modeMap",
] as const

export type ForbiddenResponseKey = (typeof FORBIDDEN_RESPONSE_KEYS)[number]

export function stripForbiddenKeys<T>(value: T): T {
  return stripForbiddenKeysInner(value) as T
}

function stripForbiddenKeysInner(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stripForbiddenKeysInner)
  }
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {}
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if ((FORBIDDEN_RESPONSE_KEYS as readonly string[]).includes(key)) {
        continue
      }
      out[key] = stripForbiddenKeysInner(child)
    }
    return out
  }
  return value
}

export function containsForbiddenKeys(value: unknown): string[] {
  const found = new Set<string>()
  walk(value, found)
  return [...found].sort()
}

function walk(value: unknown, found: Set<string>): void {
  if (Array.isArray(value)) {
    for (const item of value) walk(item, found)
    return
  }
  if (value !== null && typeof value === "object") {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if ((FORBIDDEN_RESPONSE_KEYS as readonly string[]).includes(key)) {
        found.add(key)
      }
      walk(child, found)
    }
  }
}
