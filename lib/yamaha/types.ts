export type YamahaModelId = "genos" | "genos2" | "tyros4" | "tyros5"

export type StyleGenre = "Pop" | "Jazz" | "Gospel" | "Neo Soul" | "Funk"

export type ArrangerSection = "A" | "B" | "C" | "D"

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

export type MidiPortChoice = {
  id: string
  name: string
  manufacturer: string
  state: string
}

export type MidiSendTarget = "port1" | "port2" | "both"

export type YamahaPortPair = {
  input1: MidiPortChoice
  output1: MidiPortChoice
  input2: MidiPortChoice
  output2: MidiPortChoice
}

export type MidiSessionSnapshot = {
  supported: boolean
  secure: boolean
  connected: boolean
  connecting: boolean
  inputName: string
  outputName: string
  modelName: string
  profile: KeyboardProfile | null
  error: string
  inputs: MidiPortChoice[]
  outputs: MidiPortChoice[]
}
