import type {
  JamProjectRecord,
  JamProjectSaveState,
  JamProjectSession,
} from "../types"

export type FakeProjectOptions = {
  initial?: JamProjectRecord[]
  failSave?: boolean
}

export function createFakeProjectSession(
  options: FakeProjectOptions = {},
): JamProjectSession {
  const projects = new Map<string, JamProjectRecord>(
    (options.initial ?? []).map((item) => [item.id, structuredClone(item)]),
  )
  let saveState: JamProjectSaveState = "clean"
  let lastError: string | null = null
  let seq = projects.size
  const listeners = new Set<() => void>()

  const emit = () => {
    for (const listener of listeners) listener()
  }

  return {
    async list() {
      return Array.from(projects.values()).sort((a, b) =>
        b.updatedAt.localeCompare(a.updatedAt),
      )
    },

    async create(title: string) {
      seq += 1
      const record: JamProjectRecord = {
        id: `proj_${seq}`,
        title: title.trim() || `Jam Project ${seq}`,
        version: 1,
        updatedAt: new Date().toISOString(),
        songId: "song-coastal-drive",
        key: "C",
        tempo: 112,
        styleId: "style-easypop",
        loop: false,
        generationId: null,
        candidateId: null,
        chordsBySection: null,
      }
      projects.set(record.id, record)
      saveState = "saved"
      lastError = null
      emit()
      return structuredClone(record)
    },

    async open(projectId: string) {
      const record = projects.get(projectId)
      if (!record) throw new Error(`Project not found: ${projectId}`)
      saveState = "clean"
      lastError = null
      emit()
      return structuredClone(record)
    },

    async save(patch) {
      if (options.failSave) {
        saveState = "error"
        lastError = "Could not save project. Check your connection and try again."
        emit()
        throw new Error(lastError)
      }
      saveState = "saving"
      emit()
      const existing = projects.get(patch.id)
      const next: JamProjectRecord = {
        ...patch,
        version: (existing?.version ?? patch.version) + (existing ? 1 : 0),
        updatedAt: new Date().toISOString(),
      }
      if (existing) next.version = existing.version + 1
      projects.set(next.id, next)
      saveState = "saved"
      lastError = null
      emit()
      return structuredClone(next)
    },

    getSaveState() {
      return saveState
    },

    getLastError() {
      return lastError
    },

    markDirty() {
      saveState = "dirty"
      emit()
    },

    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
