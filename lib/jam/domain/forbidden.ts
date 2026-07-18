/**
 * Keys that must never appear on public responses.
 * Defense-in-depth strip after backend output.
 */
export const FORBIDDEN_RESPONSE_KEYS = [
  "sourcePhraseId",
  "sourcePhraseIds",
  "source_phrase_id",
  "patternName",
  "patternNames",
  "pattern_name",
  "score",
  "scores",
  "rankingScore",
  "seed",
  "seeds",
  "recipe",
  "recipes",
  "trace",
  "traces",
  "algorithmSettings",
  "algorithm_settings",
  "settings",
  "internalDebug",
  "debug",
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
