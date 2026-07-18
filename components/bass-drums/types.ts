export type RhythmPart = "bass" | "drums"

export type RhythmSection = {
  id: string
  name: string
  bars: number
  chordContext: string
  contextRevision: string
}

export type RhythmProject = {
  id: string
  title: string
  tempo: number
  key: string
  sections: RhythmSection[]
  appliedSummary: string | null
}

export type RhythmFilters = {
  genre: string
  section: string
  feel: string
}

export type RhythmFilterOptions = {
  genres: string[]
  sections: string[]
  feels: string[]
}

export type OpaqueAuditionSource = {
  candidateId: string
  part: "bass" | "drums" | "fill"
  durationLabel: string
}

export type RhythmPlaybackDescriptor = {
  channel: number
  kind: "mega-voice" | "dx7-bass1" | "channel-current" | "drum-kit"
  label: string
  bankMsb: number | null
  bankLsb: number | null
  programYamaha: number | null
}

export type PreparedRhythmAudition = {
  renderReferenceId: string
  recipeReferenceId: string
  durationMs: number
  durationLabel: string
  renderedSmf: string
  playback: RhythmPlaybackDescriptor
}

export type RhythmCandidateSummary = {
  id: string
  name: string
  genre: string
  section: string
  feel: string
  bars: number
  summary: string
  audition: OpaqueAuditionSource
}

export type RhythmFillSummary = {
  id: string
  name: string
  feel: string
  lengthLabel: string
  audition: OpaqueAuditionSource
}

export type RhythmCandidateQuery = {
  projectId: string
  sectionId: string
  contextRevision: string
  part: RhythmPart
  filters: RhythmFilters
}

export type RhythmCandidateResult = {
  candidates: RhythmCandidateSummary[]
  total: number
  contextLabel: string
}

export type SuggestedDrumsQuery = Omit<RhythmCandidateQuery, "part"> & {
  bassCandidateId: string
}

export type RhythmApplyRequest = {
  projectId: string
  sectionId: string
  contextRevision: string
  bassCandidateId: string | null
  drumCandidateId: string | null
  fillCandidateIdsBySlot: Record<number, string>
}

export type AppliedRhythmReference = {
  part: RhythmPart
  recipeReferenceId: string
  renderReferenceId: string
  statusLabel?: string
}

export type RhythmApplyResult = {
  project: RhythmProject
  appliedReferences: AppliedRhythmReference[]
  message: string
}

export type RhythmAdapterErrorCode =
  | "quota_exceeded"
  | "unauthorized"
  | "validation"
  | "unavailable"

export class RhythmAdapterError extends Error {
  readonly code: RhythmAdapterErrorCode

  constructor(code: RhythmAdapterErrorCode, message: string) {
    super(message)
    this.name = "RhythmAdapterError"
    this.code = code
  }
}

export type AuditionState = {
  status: "idle" | "playing" | "stopped" | "error"
  renderReferenceId: string | null
  label: string | null
  error: string | null
}

export type RhythmProjectAdapter = {
  list(): Promise<RhythmProject[]>
  open(projectId: string): Promise<RhythmProject>
}

export type RhythmLibraryAdapter = {
  getFilterOptions(part: RhythmPart, projectId: string): Promise<RhythmFilterOptions>
  queryCandidates(query: RhythmCandidateQuery): Promise<RhythmCandidateResult>
  getSuggestedDrums(query: SuggestedDrumsQuery): Promise<RhythmCandidateResult>
  getFills(input: {
    projectId: string
    sectionId: string
    contextRevision: string
    drumCandidateId: string
  }): Promise<RhythmFillSummary[]>
  prepareAudition(input: {
    projectId: string
    sectionId: string
    contextRevision: string
    source: OpaqueAuditionSource
  }): Promise<PreparedRhythmAudition>
  applyToSong(request: RhythmApplyRequest): Promise<RhythmApplyResult>
}

export type RhythmAuditionAdapter = {
  getState(): AuditionState
  play(render: PreparedRhythmAudition, label: string): Promise<void>
  stop(): void
  subscribe(listener: (state: AuditionState) => void): () => void
}

export type BassDrumsAdapters = {
  projects: RhythmProjectAdapter
  library: RhythmLibraryAdapter
  audition: RhythmAuditionAdapter
}
