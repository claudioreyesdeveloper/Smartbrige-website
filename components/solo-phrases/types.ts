export type SoloSection = {
  id: string
  name: string
  bars: number
  chordContextLabel: string
  contextRevision: string
}

export type SavedSoloTake = {
  takeId: string
  renderReferenceId: string
  recipeReferenceId: string
  label: string
  durationLabel: string
  instrumentLabel: string
  styleLabel: string
  statusLabel: string
}

export type SoloProject = {
  id: string
  title: string
  tempoLabel: string
  keyLabel: string
  sections: SoloSection[]
  savedTakeBySection: Record<string, SavedSoloTake>
}

export type SoloOption = {
  id: string
  label: string
}

export type SoloOptionCatalog = {
  instruments: SoloOption[]
  styles: SoloOption[]
  lineFeels: SoloOption[]
  grooves: SoloOption[]
  voicings: SoloOption[]
}

export type SoloSelections = {
  instrumentId: string
  styleId: string
  lineFeelId: string
  grooveId: string
  voicingId: string
}

export type SoloTakeSummary = {
  takeId: string
  label: string
  description: string
  durationLabel: string
  instrumentLabel: string
  styleLabel: string
  lineFeelLabel: string
  grooveLabel: string
  playbackStatus: "ready" | "playing" | "stopped"
}

export type GenerateSoloTakesRequest = {
  projectId: string
  sectionId: string
  contextRevision: string
  selections: SoloSelections
  takeCount: number
}

export type GeneratedSoloTakes = {
  takes: SoloTakeSummary[]
  contextStatusLabel: string
}

export type PreparedSoloAudition = {
  takeId: string
  renderReferenceId: string
  recipeReferenceId: string
  durationLabel: string
  playbackStatusLabel: string
}

export type SoloPlaybackState = {
  status: "idle" | "playing" | "stopped" | "error"
  takeId: string | null
  label: string | null
  statusLabel: string
}

export type SaveSoloTakeRequest = {
  projectId: string
  sectionId: string
  contextRevision: string
  take: SoloTakeSummary
  audition: PreparedSoloAudition
}

export type SaveSoloTakeResult = {
  project: SoloProject
  savedTake: SavedSoloTake
  message: string
}

export type SoloProjectAdapter = {
  list(): Promise<SoloProject[]>
  open(projectId: string): Promise<SoloProject>
}

export type SoloGeneratorAdapter = {
  getOptions(projectId: string): Promise<SoloOptionCatalog>
  generateTakes(request: GenerateSoloTakesRequest): Promise<GeneratedSoloTakes>
  prepareAudition(input: {
    projectId: string
    sectionId: string
    contextRevision: string
    takeId: string
  }): Promise<PreparedSoloAudition>
  saveTake(request: SaveSoloTakeRequest): Promise<SaveSoloTakeResult>
}

export type SoloAuditionAdapter = {
  getState(): SoloPlaybackState
  start(audition: PreparedSoloAudition, label: string): Promise<void>
  stop(): void
  subscribe(listener: (state: SoloPlaybackState) => void): () => void
}

export type SoloPhrasesAdapters = {
  projects: SoloProjectAdapter
  generator: SoloGeneratorAdapter
  audition: SoloAuditionAdapter
}
