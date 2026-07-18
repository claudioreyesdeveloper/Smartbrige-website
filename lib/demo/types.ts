export type YamahaModelId = "genos" | "genos2" | "tyros4" | "tyros5"

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
