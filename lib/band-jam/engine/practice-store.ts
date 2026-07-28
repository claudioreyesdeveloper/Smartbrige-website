/**
 * Per-progression practice history, persisted locally.
 *
 * This is what makes the tempo-ramp trainer work across sessions: the app has
 * to remember that you played this progression at 96 last week in order to
 * suggest 104 today. Product plan section 6 calls that the strongest retention
 * mechanism, because it makes progress visible rather than merely felt.
 *
 * localStorage deliberately, not the database: practice history is useful
 * before a user has an account, and the free tier must work without one.
 * A signed-in user's history can be synced later; the shape here is designed
 * to serialise straight to a server row when that happens.
 */

const STORAGE_KEY = "smartbridge.jam.practice.v1"
const MAX_ENTRIES = 500

export type PracticeRecord = {
  /** `${styleId}::${progressionId}` */
  key: string
  styleId: string
  progressionId: string
  /** Fastest tempo actually played for at least MIN_QUALIFYING_BEATS. */
  bestTempo: number
  /** Most recent tempo, which is where a session resumes. */
  lastTempo: number
  targetTempo: number | null
  /** Total beats played, the honest measure of time spent. */
  beatsPlayed: number
  sessions: number
  /** Epoch ms. Stamped by the caller so this module stays deterministic. */
  lastPlayedAt: number
}

export type PracticeStore = Record<string, PracticeRecord>

/**
 * A tempo only counts once you have held it for a couple of bars. Otherwise
 * nudging the stepper to 200 and immediately back would record a "best" you
 * never actually played.
 */
export const MIN_QUALIFYING_BEATS = 32

export function practiceKey(styleId: string, progressionId: string): string {
  return `${styleId}::${progressionId}`
}

function isBrowser(): boolean {
  return typeof window !== "undefined" && !!window.localStorage
}

export function loadPracticeStore(): PracticeStore {
  if (!isBrowser()) return {}
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== "object") return {}
    return parsed as PracticeStore
  } catch {
    // Corrupt or unavailable storage must never break playback.
    return {}
  }
}

export function savePracticeStore(store: PracticeStore): void {
  if (!isBrowser()) return
  try {
    const entries = Object.entries(store)
    const trimmed =
      entries.length <= MAX_ENTRIES
        ? store
        : Object.fromEntries(
            entries
              .sort((a, b) => b[1].lastPlayedAt - a[1].lastPlayedAt)
              .slice(0, MAX_ENTRIES),
          )
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))
  } catch {
    /* quota or private mode — practice history is not worth an exception */
  }
}

export function getRecord(
  store: PracticeStore,
  styleId: string,
  progressionId: string,
): PracticeRecord | null {
  return store[practiceKey(styleId, progressionId)] ?? null
}

/** Fold a finished practice span into the store. Pure; returns a new store. */
export function recordPractice(
  store: PracticeStore,
  input: {
    styleId: string
    progressionId: string
    tempo: number
    beatsPlayed: number
    targetTempo?: number | null
    now: number
    /** True when this is the first span of a new session. */
    newSession?: boolean
  },
): PracticeStore {
  const key = practiceKey(input.styleId, input.progressionId)
  const prev = store[key]
  const qualifies = input.beatsPlayed >= MIN_QUALIFYING_BEATS

  const next: PracticeRecord = {
    key,
    styleId: input.styleId,
    progressionId: input.progressionId,
    bestTempo: qualifies
      ? Math.max(prev?.bestTempo ?? 0, input.tempo)
      : (prev?.bestTempo ?? input.tempo),
    lastTempo: input.tempo,
    targetTempo:
      input.targetTempo !== undefined
        ? input.targetTempo
        : (prev?.targetTempo ?? null),
    beatsPlayed: (prev?.beatsPlayed ?? 0) + Math.max(0, input.beatsPlayed),
    sessions: (prev?.sessions ?? 0) + (input.newSession || !prev ? 1 : 0),
    lastPlayedAt: input.now,
  }
  return { ...store, [key]: next }
}

// ---------------------------------------------------------------------------
// Tempo ramp
// ---------------------------------------------------------------------------

export type RampConfig = {
  /** Beats to hold a tempo before stepping up. 4 bars is a musical minimum. */
  beatsPerStep: number
  /** BPM added per step. */
  stepBpm: number
  targetTempo: number
}

export const DEFAULT_RAMP: Omit<RampConfig, "targetTempo"> = {
  beatsPerStep: 64,
  stepBpm: 2,
}

/**
 * Tempo after practising `beatsPlayed` beats from `startTempo`.
 * Never overshoots the target, and never goes backwards.
 */
export function rampTempo(
  startTempo: number,
  beatsPlayed: number,
  cfg: RampConfig,
): number {
  if (cfg.targetTempo <= startTempo) return startTempo
  if (cfg.beatsPerStep <= 0 || cfg.stepBpm <= 0) return startTempo
  const steps = Math.floor(Math.max(0, beatsPlayed) / cfg.beatsPerStep)
  return Math.min(cfg.targetTempo, startTempo + steps * cfg.stepBpm)
}

/**
 * Where to resume, and what to aim at.
 *
 * Resuming at `lastTempo` rather than `bestTempo` is deliberate: a session
 * should start somewhere you can actually play, not at your record.
 */
export function suggestSession(
  record: PracticeRecord | null,
  styleDefaultTempo: number,
): { startTempo: number; targetTempo: number | null } {
  if (!record) return { startTempo: styleDefaultTempo, targetTempo: null }
  const start = record.lastTempo || styleDefaultTempo
  if (record.targetTempo && record.targetTempo > start) {
    return { startTempo: start, targetTempo: record.targetTempo }
  }
  // No explicit target: propose a modest stretch above the best held tempo.
  const stretch = Math.round((record.bestTempo || start) * 1.08)
  return {
    startTempo: start,
    targetTempo: stretch > start ? stretch : null,
  }
}
