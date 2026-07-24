/** Website model ids — `genos` maps to DB `genos1`; others match keyboard_models.model_key. */
export type YamahaModelId =
  | "genos"
  | "genos2"
  | "tyros1"
  | "tyros2"
  | "tyros3"
  | "tyros4"
  | "tyros5"
  | "psr_s750"
  | "psr_s770"
  | "psr_s775"
  | "psr_s900"
  | "psr_s950"
  | "psr_s970"
  | "psr_s975"
  | "psr_sx700"
  | "psr_sx900"

export type StyleGenre = "Pop" | "Jazz" | "Gospel" | "Neo Soul" | "Funk"

export type ArrangerSection = "A" | "B" | "C" | "D"

export type SongCategory =
  | "Pop"
  | "Rock"
  | "Ballad"
  | "Dance"
  | "Latin"
  | "Swing & Jazz"
  | "R&B"
  | "Country"

export type ChordEvent = {
  beat: number
  duration?: number
  name: string
}

export type SongSection = {
  id: string
  label: string
  bars: number
  variation: ArrangerSection
  transition?: "fill" | "break"
  chords: ChordEvent[]
}

export type DemoSong = {
  id: string
  title: string
  subtitle: string
  category: SongCategory
  tempo: number
  timeSignature: [number, number]
  key: string
  accent: string
  sections: SongSection[]
}

export type StyleWireMapping = {
  name: string
  category: string
  bytes: [number, number]
  sourceCatalogValue: number
}

export type StyleCatalogEntry = {
  name: string
  category: string
  styleNumber: number
  bpm: number
}

export type KeyboardProfile = {
  id: YamahaModelId
  displayName: string
  identityTokens: string[]
  oneClickActivation: boolean
  styleMappings: Record<StyleGenre, StyleWireMapping>
}

export type TransferProgress = {
  phase:
    | "detecting"
    | "initializing"
    | "scanning"
    | "uploading"
    | "activating"
    | "cleaning"
    | "complete"
  percent: number
  message: string
}
