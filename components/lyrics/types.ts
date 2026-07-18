export type CreativeDirection = {
  title: string
  about: string
  theme: string
  mood: string
  avoidWords: string
}

export type DisplayNoteContext = {
  id: string
  label: string
  pitchLabel: string
  beatLabel: string
  durationLabel: string
}

export type LyricAssignment = {
  id: string
  word: string
  syllable: string
  noteId: string
}

export type LyricsSection = {
  id: string
  name: string
  bars: number
  melodyLabel: string
  contextRevision: string
  notes: DisplayNoteContext[]
}

export type SavedLyrics = {
  creative: CreativeDirection
  assignments: LyricAssignment[]
  recipeReferenceId: string
  renderReferenceId: string | null
  exportReferenceId: string | null
  savedLabel: string
}

export type LyricsProject = {
  id: string
  title: string
  tempo: number
  key: string
  sections: LyricsSection[]
  savedBySection: Record<string, SavedLyrics | undefined>
}

export type GenerateLyricsRequest = {
  projectId: string
  sectionId: string
  contextRevision: string
  creative: CreativeDirection
  notes: DisplayNoteContext[]
}

export type GenerateLyricsResult = {
  assignments: LyricAssignment[]
  recipeReferenceId: string
  statusLabel: string
}

export type RefitLyricsRequest = {
  projectId: string
  sectionId: string
  contextRevision: string
  assignments: LyricAssignment[]
  notes: DisplayNoteContext[]
  recipeReferenceId: string
}

export type RefitLyricsResult = GenerateLyricsResult

export type LyricsRenderResult = {
  renderReferenceId: string
  statusLabel: string
}

export type LyricsExportResult = {
  exportReferenceId: string
  statusLabel: string
}

export type SaveLyricsRequest = {
  projectId: string
  sectionId: string
  contextRevision: string
  creative: CreativeDirection
  assignments: LyricAssignment[]
  recipeReferenceId: string
  renderReferenceId: string | null
  exportReferenceId: string | null
}

export type LyricsProjectAdapter = {
  list(): Promise<LyricsProject[]>
  open(projectId: string): Promise<LyricsProject>
  save(request: SaveLyricsRequest): Promise<LyricsProject>
}

export type LyricsCreativeAdapter = {
  generate(request: GenerateLyricsRequest): Promise<GenerateLyricsResult>
  refit(request: RefitLyricsRequest): Promise<RefitLyricsResult>
  audition(input: {
    projectId: string
    sectionId: string
    contextRevision: string
    recipeReferenceId: string
    assignments: LyricAssignment[]
  }): Promise<LyricsRenderResult>
  export(input: {
    projectId: string
    sectionId: string
    contextRevision: string
    recipeReferenceId: string
    renderReferenceId: string | null
  }): Promise<LyricsExportResult>
}

export type LyricsAdapters = {
  projects: LyricsProjectAdapter
  lyrics: LyricsCreativeAdapter
}
