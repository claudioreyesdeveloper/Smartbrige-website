import type { KeyboardModel } from "@/lib/jam/domain/models"
import type { DisplayChord, TimeSignature } from "@/lib/jam/domain/types"

export type RhythmKind = "bass" | "drums"
export type RhythmOperation = "rhythm_browse" | "rhythm_fills" | "rhythm_render"

export type RhythmPublicContext = {
  projectId: string
  sectionId: string
  contextRevision: string
}

export type RhythmOptionsRequest = {
  projectId: string
  kind: RhythmKind
}

export type RhythmOptionsEngineRequest = {
  subjectId: string
  projectId: string
  kind: RhythmKind
}

export type RhythmOptionsResponse = {
  genres: string[]
  sectionTypes: string[]
  feels: string[]
}

export type RhythmFilters = {
  genre?: string
  sectionType?: string
  feel?: "straight" | "swing"
}

export type RhythmQueryRequest = RhythmPublicContext & {
  kind: RhythmKind
  mode: "browse" | "suggested"
  filters: RhythmFilters
  bassCandidateId?: string
  limit: number
}

export type RhythmEngineContext = {
  sectionId: string
  sectionName: string
  bars: number
  bpm: number
  key: string
  timeSignature: TimeSignature
  chords?: DisplayChord[]
}

export type RhythmQueryEngineRequest = {
  subjectId: string
  projectId: string
  kind: RhythmKind
  mode: "browse" | "suggested"
  context: RhythmEngineContext
  filters: RhythmFilters
  bassCandidateId?: string
  limit: number
}

export type RhythmCandidate = {
  candidateId: string
  label: string
  category: string
  feel: string
  sectionType: string
  bpm: number
  bars: number
  matchBand: "strong" | "close" | "broad"
  qualityBand: "high" | "standard" | "limited"
}

export type RhythmQueryResponse = {
  queryId: string
  expiresAt: string
  candidates: RhythmCandidate[]
}

export type RhythmFillsRequest = RhythmPublicContext & {
  drumCandidateId: string
  limit: number
}

export type RhythmFillsEngineRequest = {
  subjectId: string
  projectId: string
  drumCandidateId: string
  limit: number
}

export type RhythmFillCandidate = {
  candidateId: string
  label: string
  feel: string
  bars: number
}

export type RhythmFillsResponse = {
  queryId: string
  expiresAt: string
  fills: RhythmFillCandidate[]
}

export type RhythmRenderOptions = {
  timeFeel?: "half" | "normal" | "double"
  bassVelocity?: "soft" | "balanced" | "strong"
  drumMapping?: "gm" | "ambient"
  forceFillEveryFourBars?: boolean
}

export type RhythmFillSlot = {
  slotBar: number
  candidateId: string
}

export type RhythmRenderContext = RhythmEngineContext & {
  sectionType: string
  chords: DisplayChord[]
}

export type RhythmAuditionRequest = RhythmPublicContext & {
  model: KeyboardModel
  operation: "audition"
  part: "bass" | "drums" | "fill"
  candidateId: string
  options?: RhythmRenderOptions
}

export type RhythmApplyRequest = RhythmPublicContext & {
  model: KeyboardModel
  operation: "apply"
  bassCandidateId?: string
  drumCandidateId?: string
  fillSlots?: RhythmFillSlot[]
  options?: RhythmRenderOptions
}

export type RhythmRenderRequest = RhythmAuditionRequest | RhythmApplyRequest

export type RhythmRenderEngineRequest =
  | (Omit<RhythmAuditionRequest, keyof RhythmPublicContext> & {
      subjectId: string
      projectId: string
      context: RhythmRenderContext
    })
  | (Omit<RhythmApplyRequest, keyof RhythmPublicContext> & {
      subjectId: string
      projectId: string
      context: RhythmRenderContext
    })

export type YamahaPlaybackDescriptor = {
  channel: number
  kind: "mega-voice" | "dx7-bass1" | "channel-current" | "drum-kit"
  label: string
  bankMsb: number | null
  bankLsb: number | null
  programYamaha: number | null
}

export type RhythmRenderResult = {
  renderReferenceId: string
  recipeReferenceId: string
  part: "bass" | "drums" | "fill"
  durationMs: number
  renderedSmf: string
  playback: YamahaPlaybackDescriptor
}

export type RhythmRenderResponse = {
  renders: RhythmRenderResult[]
}
