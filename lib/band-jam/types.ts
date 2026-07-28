/** Band Jam Player pilot — types only. No dependency on old jam-player demo code. */

export type BandPart = "drums" | "bass" | "guitar" | "solo"

export type SectionRole = "intro" | "verse" | "chorus" | "bridge"

export type ChordEvent = {
  startBeat: number
  durationBeats: number
  /** Pitch class 0–11 (C=0). */
  root: number
  name: string
}

export type ProgressionSection = {
  role: SectionRole
  bars: number
  chords: ChordEvent[]
}

export type Progression = {
  id: string
  name: string
  /** Default song key as pitch class. */
  keyPc: number
  keyLabel: string
  /** Optional default tempo override; style default used when absent. */
  tempo?: number
  sections: ProgressionSection[]
}

export type StylePartSlots = Partial<Record<SectionRole, { clipId: number }>>

export type StylePartDef = {
  sfz: string
  gain: number
  harmonic: boolean
  register?: [number, number]
  slots: StylePartSlots
  /** Pilot: guitar may reuse one clip for all sections. */
  reuseClipId?: number
  fills?: {
    atSectionEnd: boolean
    minSectionBars: number
    pool: number[]
  }
}

export type BandStyle = {
  id: string
  name: string
  tempoDefault: number
  tempoMin: number
  tempoMax: number
  parts: Partial<Record<BandPart, StylePartDef>>
}

export type StemPackMeta = {
  packId: string
  styleId: string
  progressionId: string
  keyPc: number
  tempo: number
  durationSeconds: number
  parts: BandPart[]
  /** Relative URLs under /jam-player/stems/ */
  stems: Partial<Record<BandPart, string>>
}

export type BandJamCatalog = {
  styles: BandStyle[]
  progressions: Progression[]
  /** Pre-rendered packs available for browser playback. */
  packs: StemPackMeta[]
}
