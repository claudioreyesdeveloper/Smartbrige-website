import type { KeyboardModel } from "@/lib/jam/domain/models"

export type MidiTarget = "port1" | "port2" | "both"

export type TimeSignature = {
  numerator: number
  denominator: 1 | 2 | 4 | 8 | 16
}

export type DisplayChord = {
  symbol: string
  startBar: number
  durationBars: number
}

export type SongSection = {
  id: string
  name: string
  barCount: number
  chords: DisplayChord[]
  styleNumber?: number
}

export type Song = {
  tempoBpm: number
  key: string
  timeSignature: TimeSignature
  sections: SongSection[]
}

/** Private-engine prepare body (no project ownership fields). */
export type JamPrepareEngineRequest = {
  model: KeyboardModel
  song: Song
}

/** Public API prepare body. */
export type JamPrepareRequest = JamPrepareEngineRequest & {
  projectId: string
}

export type DispatchEvent = {
  atMs: number
  target: MidiTarget
  bytes: string
}

export type DisplayTimeline = {
  tempoBpm: number
  key: string
  timeSignature: TimeSignature
  durationMs: number
  sections: Array<{
    id: string
    name: string
    startBar: number
    barCount: number
  }>
  chords: DisplayChord[]
}

export type JamPrepareResponse = {
  planId: string
  expiresAt: string
  display: DisplayTimeline
  dispatch: {
    fullSong: DispatchEvent[]
    sections: Record<string, DispatchEvent[]>
  }
}

/** Private-engine reharmonize body. */
export type JamReharmonizeEngineRequest = {
  model: KeyboardModel
  scope: "section" | "song"
  sectionId?: string
  key: string
  chords: DisplayChord[]
  candidateCount?: number
  subjectId: string
  projectId: string
  style?: string
  sectionName?: string
  sectionClass?: string
  category?: string
  bars?: number
  beatsPerBar?: number
  nextSectionFirstChord?: string
  preserveCadence?: boolean
  romanTimingsJson?: string
  melodyFeatures?: string | Record<string, unknown>
}

/** Public API reharmonize body. */
export type JamReharmonizeRequest = Omit<
  JamReharmonizeEngineRequest,
  "subjectId"
> & {
  projectId: string
}

export type JamReharmonizeCandidate = {
  id: string
  label?: string
  chords: DisplayChord[]
}

export type JamReharmonizeResponse = {
  generationId: string
  candidates: JamReharmonizeCandidate[]
}

export type EngineOperation = "jam_prepare" | "jam_reharmonize"
