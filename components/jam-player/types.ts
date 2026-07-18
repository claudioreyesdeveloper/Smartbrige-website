/**
 * Typed contracts for the paid Jam Player UI.
 * Real A15/A16/A18 modules replace these fakes at I03 — UI depends only on these surfaces.
 */

export type YamahaModelId = "genos" | "genos2" | "tyros4" | "tyros5"

export type MainVariation = "A" | "B" | "C" | "D"

export type DisplayChord = {
  beat: number
  duration: number
  name: string
}

export type JamSongSection = {
  id: string
  /** Exact source section name from catalog / project. */
  label: string
  bars: number
  variation: MainVariation
  chords: DisplayChord[]
}

export type JamSong = {
  id: string
  title: string
  subtitle: string
  category: string
  tempo: number
  key: string
  timeSignature: readonly [number, number]
  accent: string
  sections: JamSongSection[]
}

export type JamSongSummary = {
  id: string
  title: string
  category: string
  tempo: number
  key: string
  sectionCount: number
  accent: string
}

export type JamStyleSummary = {
  id: string
  name: string
  category: string
  styleNumber: number
  bpm: number
}

export type DispatchTarget = "port1" | "port2" | "both"

export type DispatchEvent = {
  atMs: number
  target: DispatchTarget
  bytes: number[]
}

export type DispatchPlanSlice = {
  durationMs: number
  events: DispatchEvent[]
  pauseSafe?: boolean
}

export type DisplayTimelineChord = {
  atMs: number
  name: string
}

export type DisplayTimelineSection = {
  id: string
  label: string
  startMs: number
  endMs: number
  chords?: DisplayTimelineChord[]
}

/** UI-only timeline metadata from a prepared plan. Never used for MIDI decisions. */
export type DisplayTimeline = {
  sections: DisplayTimelineSection[]
  tempoBpm?: number
  key?: string
  timeSignature?: readonly [number, number]
}

/**
 * Opaque server-precomputed performance plan (A16 shape).
 * Contains no arranger / anticipation / reharmonization logic.
 */
export type PreparedPerformancePlan = {
  planId: string
  engineVersion: string
  expiresAt: string
  display: DisplayTimeline
  full: DispatchPlanSlice
  sections: Record<string, DispatchPlanSlice>
}

export type JamPrepareRequest = {
  model: YamahaModelId
  song: JamSong
  key: string
  tempo: number
  styleId: string
  loop: boolean
  /** Opaque selected reharmonization candidate, if any. */
  candidateId?: string | null
  generationId?: string | null
}

export type ReharmonizeCandidate = {
  /** Opaque candidate id — never a pattern name or score. */
  id: string
  /** Short user-facing label only. */
  label: string
  chordsBySection: Record<string, DisplayChord[]>
}

export type JamReharmonizeRequest = {
  model: YamahaModelId
  song: JamSong
  key: string
  scope: "song" | "section"
  sectionId?: string
}

export type JamReharmonizeResponse = {
  generationId: string
  candidates: ReharmonizeCandidate[]
}

export type JamEngineErrorCode =
  | "quota_exceeded"
  | "unauthorized"
  | "validation"
  | "unavailable"
  | "network"

export class JamEngineError extends Error {
  readonly code: JamEngineErrorCode

  constructor(code: JamEngineErrorCode, message: string) {
    super(message)
    this.name = "JamEngineError"
    this.code = code
  }
}

export type JamEngineClient = {
  prepare(request: JamPrepareRequest): Promise<PreparedPerformancePlan>
  reharmonize(request: JamReharmonizeRequest): Promise<JamReharmonizeResponse>
}

export type JamCatalogClient = {
  listCategories(): Promise<string[]>
  listSongs(options?: { category?: string; search?: string }): Promise<JamSongSummary[]>
  getSong(songId: string): Promise<JamSong>
  listStyles(options: {
    model: YamahaModelId
    category?: string
    search?: string
  }): Promise<JamStyleSummary[]>
}

export type DispatchSelection =
  | { mode: "full" }
  | { mode: "section"; sectionId: string }

export type DispatchStatus =
  | "idle"
  | "ready"
  | "playing"
  | "paused"
  | "stopped"
  | "completed"
  | "error"

export type DispatchPlaybackState = {
  status: DispatchStatus
  planId: string | null
  selection: DispatchSelection | null
  positionMs: number
  durationMs: number
  currentChord: string
  currentSectionLabel: string
  error: string | null
}

export type PlanDispatcher = {
  loadPlan(plan: PreparedPerformancePlan): void
  play(selection: DispatchSelection): void
  stop(): void
  panic(): void
  getState(): DispatchPlaybackState
  subscribe(listener: (state: DispatchPlaybackState) => void): () => void
}

export type JamProjectRecord = {
  id: string
  title: string
  version: number
  updatedAt: string
  songId: string
  key: string
  tempo: number
  styleId: string
  loop: boolean
  /** Opaque ids kept for reopen — never shown as recipes/seeds. */
  generationId: string | null
  candidateId: string | null
  /** Display chords when a candidate is applied. */
  chordsBySection: Record<string, DisplayChord[]> | null
}

export type JamProjectSaveState = "clean" | "dirty" | "saving" | "saved" | "error"

export type JamProjectSession = {
  list(): Promise<JamProjectRecord[]>
  create(title: string): Promise<JamProjectRecord>
  open(projectId: string): Promise<JamProjectRecord>
  save(patch: Omit<JamProjectRecord, "updatedAt">): Promise<JamProjectRecord>
  getSaveState(): JamProjectSaveState
  getLastError(): string | null
  markDirty(): void
  subscribe(listener: () => void): () => void
}

export type JamConnectionState = {
  browserSupported: boolean
  connected: boolean
  model: YamahaModelId | null
  displayName: string | null
  guidance: string
}

export type JamConnectionClient = {
  getState(): JamConnectionState
  subscribe(listener: (state: JamConnectionState) => void): () => void
  refresh(): Promise<void>
}

export type JamPlayerAdapters = {
  catalog: JamCatalogClient
  engine: JamEngineClient
  dispatcher: PlanDispatcher
  projects: JamProjectSession
  connection: JamConnectionClient
}
