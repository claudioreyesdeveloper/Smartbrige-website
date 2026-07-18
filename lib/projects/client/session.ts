import {
  cloneProjectDocument,
  createEmptyProjectDocument,
  type ProjectBlobRef,
  type ProjectDocument,
  type ProjectRecipe,
} from "@/lib/projects/document"
import { createProjectApiClient, type ProjectApiClient, type ProjectFetch } from "@/lib/projects/client/api"
import {
  browserDownload,
  serializeLocalProjectCopy,
  type ProjectDownloadFn,
} from "@/lib/projects/client/download"
import {
  removeBlobReference,
  setBassRecipe,
  setBlobReferences,
  setDrumsRecipe,
  setRecipeRenderBlobId,
  setSongTitle,
  upsertBlobReference,
} from "@/lib/projects/client/editors"
import { createNavigationGuard, type NavigationGuard } from "@/lib/projects/client/navigation"
import {
  browserClock,
  browserTimer,
  type ProjectClock,
  type ProjectTimer,
  type ProjectTimerHandle,
} from "@/lib/projects/client/timers"
import { createTransportActivity, type TransportActivity } from "@/lib/projects/client/transport"
import {
  DEFAULT_AUTOSAVE_DELAY_MS,
  ProjectClientError,
  type ClientProjectExport,
  type ClientProjectSummary,
  type ProjectConflictChoice,
  type ProjectSessionSnapshot,
} from "@/lib/projects/client/types"

export type ProjectSessionDeps = {
  fetch?: ProjectFetch
  api?: ProjectApiClient
  timer?: ProjectTimer
  clock?: ProjectClock
  transport?: TransportActivity
  download?: ProjectDownloadFn
  autosaveDelayMs?: number
  baseUrl?: string
  retryDelayMs?: number
  /** Injected confirm dialog for close/navigation warnings (defaults to window.confirm). */
  confirmNavigate?: (message: string) => boolean
}

function documentsEqual(a: ProjectDocument | null, b: ProjectDocument | null): boolean {
  if (a === b) return true
  if (!a || !b) return false
  return JSON.stringify(a) === JSON.stringify(b)
}

function idleSnapshot(): ProjectSessionSnapshot {
  return {
    phase: "idle",
    projects: [],
    projectId: null,
    title: "",
    revisionId: null,
    version: null,
    document: null,
    dirty: false,
    saveState: "clean",
    lastError: null,
    conflict: null,
    migrationApplied: false,
    transportActive: false,
    pendingSaveAfterTransport: false,
  }
}

/**
 * Browser project session around the versioned A10 document API.
 *
 * Owns list/create/open, dirty tracking, manual save, debounced autosave while
 * transport is idle, optimistic concurrency, conflict choices, and navigation warnings.
 */
export class ProjectSession {
  private readonly api: ProjectApiClient
  private readonly timer: ProjectTimer
  private readonly clock: ProjectClock
  private readonly transport: TransportActivity
  private readonly download: ProjectDownloadFn
  private readonly autosaveDelayMs: number
  private readonly retryDelayMs: number
  private readonly confirmNavigate?: (message: string) => boolean
  private readonly listeners = new Set<() => void>()
  private readonly navigation: NavigationGuard

  private snapshot: ProjectSessionSnapshot = idleSnapshot()
  private savedDocument: ProjectDocument | null = null
  private autosaveHandle: ProjectTimerHandle | null = null
  private retryHandle: ProjectTimerHandle | null = null
  private transportUnsubscribe: (() => void) | null = null
  private inFlightSave = false
  private saveQueued = false
  private disposed = false
  private saveGeneration = 0

  constructor(deps: ProjectSessionDeps = {}) {
    this.api =
      deps.api ??
      createProjectApiClient({
        fetch: deps.fetch,
        baseUrl: deps.baseUrl,
      })
    this.timer = deps.timer ?? browserTimer
    this.clock = deps.clock ?? browserClock
    this.transport = deps.transport ?? createTransportActivity()
    this.download = deps.download ?? browserDownload
    this.autosaveDelayMs = deps.autosaveDelayMs ?? DEFAULT_AUTOSAVE_DELAY_MS
    this.retryDelayMs = deps.retryDelayMs ?? this.autosaveDelayMs
    this.confirmNavigate = deps.confirmNavigate
    this.navigation = createNavigationGuard(() => this.shouldWarnOnNavigate())
    this.snapshot = {
      ...idleSnapshot(),
      transportActive: this.transport.isActive(),
    }
    this.transportUnsubscribe = this.transport.subscribe((active) => {
      this.patch({ transportActive: active })
      if (active) {
        this.clearAutosaveTimer()
        this.clearRetryTimer()
      } else if (this.snapshot.pendingSaveAfterTransport || this.snapshot.dirty) {
        this.patch({ pendingSaveAfterTransport: false })
        this.scheduleAutosave()
      }
    })
  }

  getNavigationGuard(): NavigationGuard {
    return this.navigation
  }

  getTransport(): TransportActivity {
    return this.transport
  }

  /** Test/diagnostic access to the injected clock. */
  now(): number {
    return this.clock.now()
  }

  getSnapshot(): ProjectSessionSnapshot {
    return this.snapshot
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  shouldWarnOnNavigate(): boolean {
    return (
      this.snapshot.dirty ||
      this.snapshot.saveState === "saving" ||
      this.snapshot.saveState === "scheduled" ||
      this.snapshot.pendingSaveAfterTransport ||
      this.snapshot.conflict !== null
    )
  }

  dispose(): void {
    this.disposed = true
    this.clearAutosaveTimer()
    this.clearRetryTimer()
    this.transportUnsubscribe?.()
    this.transportUnsubscribe = null
    this.listeners.clear()
  }

  async list(): Promise<ClientProjectSummary[]> {
    this.ensureNotDisposed()
    this.patch({ phase: "listing", lastError: null })
    try {
      const projects = await this.api.list()
      this.patch({
        phase: this.snapshot.projectId ? "ready" : "idle",
        projects,
      })
      return projects
    } catch (error) {
      this.fail(error)
      throw error
    }
  }

  async create(input?: { title?: string; document?: ProjectDocument }): Promise<void> {
    this.ensureNotDisposed()
    if (!this.confirmCloseIfNeeded()) return
    this.patch({ phase: "creating", lastError: null, conflict: null })
    try {
      const parsed = await this.api.create({
        title: input?.title,
        document: input?.document ?? createEmptyProjectDocument(input?.title ?? "Untitled"),
      })
      this.applyOpened(parsed.detail, parsed.migrationApplied)
    } catch (error) {
      this.fail(error)
      throw error
    }
  }

  async open(projectId: string): Promise<void> {
    this.ensureNotDisposed()
    if (!this.confirmCloseIfNeeded()) return
    this.patch({ phase: "opening", lastError: null, conflict: null })
    try {
      const parsed = await this.api.open(projectId)
      this.applyOpened(parsed.detail, parsed.migrationApplied)
      if (parsed.migrationApplied) {
        // Migrated working copy matches local baseline content-wise; force dirty
        // so the upgraded schema can be persisted on the next idle save.
        this.forceDirtyForMigration()
      }
    } catch (error) {
      this.fail(error)
      throw error
    }
  }

  /**
   * Close the open project. Returns false when the caller should abort
   * (dirty/conflict and confirmation declined).
   */
  close(options?: { force?: boolean }): boolean {
    this.ensureNotDisposed()
    if (!options?.force && !this.confirmCloseIfNeeded()) return false
    this.clearAutosaveTimer()
    this.clearRetryTimer()
    this.inFlightSave = false
    this.saveQueued = false
    this.savedDocument = null
    this.patch({
      ...idleSnapshot(),
      projects: this.snapshot.projects,
      phase: "closed",
      transportActive: this.transport.isActive(),
    })
    return true
  }

  updateDocument(document: ProjectDocument): void {
    this.ensureReady()
    this.markDirty(document, this.snapshot.title)
  }

  updateTitle(title: string): void {
    this.ensureReady()
    const document = this.requireDocument()
    const next = setSongTitle(document, title)
    this.markDirty(next, next.song.title)
  }

  setBass(recipe: ProjectRecipe | null | undefined): void {
    this.ensureReady()
    this.markDirty(setBassRecipe(this.requireDocument(), recipe), this.snapshot.title)
  }

  setDrums(recipe: ProjectRecipe | null | undefined): void {
    this.ensureReady()
    this.markDirty(setDrumsRecipe(this.requireDocument(), recipe), this.snapshot.title)
  }

  setBassRenderBlobId(renderBlobId: string | null | undefined): void {
    this.ensureReady()
    this.markDirty(
      setRecipeRenderBlobId(this.requireDocument(), "bass", renderBlobId),
      this.snapshot.title,
    )
  }

  setDrumsRenderBlobId(renderBlobId: string | null | undefined): void {
    this.ensureReady()
    this.markDirty(
      setRecipeRenderBlobId(this.requireDocument(), "drums", renderBlobId),
      this.snapshot.title,
    )
  }

  setBlobs(blobs: ProjectBlobRef[] | null | undefined): void {
    this.ensureReady()
    this.markDirty(setBlobReferences(this.requireDocument(), blobs), this.snapshot.title)
  }

  upsertBlob(ref: ProjectBlobRef): void {
    this.ensureReady()
    this.markDirty(upsertBlobReference(this.requireDocument(), ref), this.snapshot.title)
  }

  removeBlob(blobReferenceId: string): void {
    this.ensureReady()
    this.markDirty(removeBlobReference(this.requireDocument(), blobReferenceId), this.snapshot.title)
  }

  /** Explicit manual save. Suspended while transport is active. */
  async save(): Promise<boolean> {
    this.ensureReady()
    if (this.snapshot.conflict) {
      return false
    }
    this.clearAutosaveTimer()
    this.clearRetryTimer()
    if (this.transport.isActive()) {
      this.patch({ pendingSaveAfterTransport: true, saveState: "dirty" })
      return false
    }
    return this.flushSave()
  }

  async resolveConflict(choice: ProjectConflictChoice): Promise<void> {
    this.ensureNotDisposed()
    const conflict = this.snapshot.conflict
    if (!conflict || !this.snapshot.projectId) {
      throw new ProjectClientError("validation", "No conflict to resolve.")
    }

    if (choice === "download_copy") {
      this.downloadLocalCopy()
      return
    }

    // reload — discard local draft and reopen server revision
    const projectId = this.snapshot.projectId
    this.patch({ conflict: null, lastError: null, phase: "opening" })
    const parsed = await this.api.open(projectId)
    this.applyOpened(parsed.detail, parsed.migrationApplied)
    if (parsed.migrationApplied) {
      this.forceDirtyForMigration()
    }
  }

  downloadLocalCopy(): void {
    const document = this.snapshot.conflict?.localDocument ?? this.snapshot.document
    const title = this.snapshot.conflict?.localTitle ?? this.snapshot.title
    if (!document) {
      throw new ProjectClientError("validation", "No local document to download.")
    }
    const safeTitle = title.trim().replace(/[^\w\-]+/g, "_") || "project"
    this.download(
      `${safeTitle}-local-copy.json`,
      serializeLocalProjectCopy({
        title,
        document,
        projectId: this.snapshot.projectId,
        revisionId: this.snapshot.revisionId,
        version: this.snapshot.version,
      }),
      "application/json",
    )
  }

  async delete(): Promise<void> {
    this.ensureReady()
    const projectId = this.snapshot.projectId
    if (!projectId) return
    try {
      await this.api.delete(projectId)
      this.clearAutosaveTimer()
      this.clearRetryTimer()
      this.savedDocument = null
      this.patch({
        ...idleSnapshot(),
        projects: this.snapshot.projects.filter((item) => item.id !== projectId),
        phase: "idle",
        transportActive: this.transport.isActive(),
      })
    } catch (error) {
      this.fail(error)
      throw error
    }
  }

  async exportProject(): Promise<ClientProjectExport> {
    this.ensureReady()
    const projectId = this.snapshot.projectId
    if (!projectId) {
      throw new ProjectClientError("validation", "No project is open.")
    }
    try {
      return await this.api.exportProject(projectId)
    } catch (error) {
      this.fail(error)
      throw error
    }
  }

  private confirmCloseIfNeeded(): boolean {
    if (!this.shouldWarnOnNavigate()) return true
    return this.navigation.confirmNavigation(this.confirmNavigate)
  }

  private applyOpened(
    detail: {
      id: string
      title: string
      revisionId: string
      version: number
      document: ProjectDocument
    },
    migrationApplied: boolean,
  ): void {
    this.clearAutosaveTimer()
    this.clearRetryTimer()
    this.inFlightSave = false
    this.saveQueued = false
    this.savedDocument = cloneProjectDocument(detail.document)
    this.patch({
      phase: "ready",
      projectId: detail.id,
      title: detail.title,
      revisionId: detail.revisionId,
      version: detail.version,
      document: cloneProjectDocument(detail.document),
      dirty: false,
      saveState: "clean",
      lastError: null,
      conflict: null,
      migrationApplied,
      pendingSaveAfterTransport: false,
    })
  }

  private forceDirtyForMigration(): void {
    this.patch({ dirty: true, saveState: "dirty", migrationApplied: true })
    if (this.transport.isActive()) {
      this.patch({ pendingSaveAfterTransport: true })
      this.clearAutosaveTimer()
      return
    }
    this.scheduleAutosave()
  }

  private markDirty(document: ProjectDocument, title: string): void {
    const nextDocument = cloneProjectDocument(document)
    const nextTitle = title.trim() || nextDocument.song.title
    nextDocument.song.title = nextTitle

    if (this.snapshot.conflict) {
      this.patch({
        document: nextDocument,
        title: nextTitle,
        dirty: true,
        saveState: "conflict",
        conflict: {
          message: this.snapshot.conflict.message,
          localTitle: nextTitle,
          localDocument: cloneProjectDocument(nextDocument),
        },
      })
      return
    }

    const savedTitle = this.savedDocument?.song.title ?? ""
    const isDirty =
      !documentsEqual(nextDocument, this.savedDocument) || nextTitle !== savedTitle

    this.patch({
      document: nextDocument,
      title: nextTitle,
      dirty: isDirty,
      saveState: isDirty ? "dirty" : "clean",
      lastError: null,
    })

    if (!isDirty) {
      this.clearAutosaveTimer()
      return
    }

    if (this.transport.isActive()) {
      this.patch({ pendingSaveAfterTransport: true })
      this.clearAutosaveTimer()
      return
    }

    this.scheduleAutosave()
  }

  private scheduleAutosave(): void {
    if (this.disposed || this.snapshot.conflict || !this.snapshot.dirty) return
    if (this.transport.isActive()) {
      this.patch({ pendingSaveAfterTransport: true })
      return
    }
    this.clearAutosaveTimer()
    this.patch({ saveState: "scheduled" })
    this.autosaveHandle = this.timer.setTimeout(() => {
      this.autosaveHandle = null
      void this.flushSave()
    }, this.autosaveDelayMs)
  }

  private scheduleRetry(): void {
    if (this.disposed || this.snapshot.conflict || !this.snapshot.dirty) return
    if (this.transport.isActive()) {
      this.patch({ pendingSaveAfterTransport: true })
      return
    }
    this.clearRetryTimer()
    this.retryHandle = this.timer.setTimeout(() => {
      this.retryHandle = null
      void this.flushSave()
    }, this.retryDelayMs)
  }

  private async flushSave(): Promise<boolean> {
    if (this.disposed || this.snapshot.conflict) return false
    if (!this.snapshot.projectId || !this.snapshot.revisionId || this.snapshot.version == null) {
      return false
    }
    if (!this.snapshot.document) return false

    if (this.transport.isActive()) {
      this.patch({ pendingSaveAfterTransport: true, saveState: "dirty" })
      return false
    }

    if (this.inFlightSave) {
      this.saveQueued = true
      return false
    }

    if (!this.snapshot.dirty && !this.saveQueued) {
      return true
    }

    this.clearAutosaveTimer()
    this.clearRetryTimer()
    this.inFlightSave = true
    this.saveQueued = false
    const generation = ++this.saveGeneration

    const projectId = this.snapshot.projectId
    const expectedRevisionId = this.snapshot.revisionId
    const expectedVersion = this.snapshot.version
    const document = cloneProjectDocument(this.snapshot.document)
    const title = this.snapshot.title

    this.patch({ saveState: "saving", lastError: null })

    try {
      const parsed = await this.api.save(projectId, {
        document,
        expectedRevisionId,
        expectedVersion,
        title,
      })

      if (this.disposed || generation !== this.saveGeneration) {
        return false
      }

      this.savedDocument = cloneProjectDocument(parsed.detail.document)
      const stillDirty = !documentsEqual(this.snapshot.document, this.savedDocument)

      this.patch({
        phase: "ready",
        projectId: parsed.detail.id,
        title: stillDirty ? this.snapshot.title : parsed.detail.title,
        revisionId: parsed.detail.revisionId,
        version: parsed.detail.version,
        document: stillDirty
          ? this.snapshot.document
          : cloneProjectDocument(parsed.detail.document),
        dirty: stillDirty,
        saveState: stillDirty ? "dirty" : "saved",
        lastError: null,
        conflict: null,
        migrationApplied: this.snapshot.migrationApplied || parsed.migrationApplied,
        pendingSaveAfterTransport: false,
      })

      // Keep list metadata fresh when possible.
      this.patch({
        projects: this.snapshot.projects.map((item) =>
          item.id === parsed.detail.id
            ? {
                ...item,
                title: parsed.detail.title,
                currentRevisionId: parsed.detail.revisionId,
                currentVersion: parsed.detail.version,
                updatedAt: parsed.detail.updatedAt,
              }
            : item,
        ),
      })

      if (stillDirty) {
        this.scheduleAutosave()
      }
      return !stillDirty
    } catch (error) {
      if (this.disposed || generation !== this.saveGeneration) {
        return false
      }

      if (error instanceof ProjectClientError && error.code === "conflict") {
        this.clearAutosaveTimer()
        this.clearRetryTimer()
        this.patch({
          dirty: true,
          saveState: "conflict",
          lastError: error.message,
          conflict: {
            message: error.message,
            localTitle: title,
            localDocument: cloneProjectDocument(document),
          },
          pendingSaveAfterTransport: false,
        })
        return false
      }

      if (error instanceof ProjectClientError && error.code === "network") {
        // Keep a single pending retry; do not open parallel saves that could duplicate.
        this.patch({
          dirty: true,
          saveState: "error",
          lastError: error.message,
        })
        this.scheduleRetry()
        return false
      }

      this.fail(error)
      return false
    } finally {
      this.inFlightSave = false
      if (this.saveQueued && !this.snapshot.conflict && this.snapshot.dirty) {
        this.saveQueued = false
        if (this.transport.isActive()) {
          this.patch({ pendingSaveAfterTransport: true })
        } else {
          this.scheduleAutosave()
        }
      }
    }
  }

  private requireDocument(): ProjectDocument {
    if (!this.snapshot.document) {
      throw new ProjectClientError("validation", "No project document is open.")
    }
    return this.snapshot.document
  }

  private ensureReady(): void {
    this.ensureNotDisposed()
    if (this.snapshot.phase !== "ready" || !this.snapshot.projectId) {
      throw new ProjectClientError("validation", "No project is open.")
    }
  }

  private ensureNotDisposed(): void {
    if (this.disposed) {
      throw new ProjectClientError("validation", "Project session has been disposed.")
    }
  }

  private fail(error: unknown): void {
    const message = error instanceof Error ? error.message : "Unexpected project client error."
    this.patch({
      lastError: message,
      saveState: this.snapshot.dirty ? "error" : this.snapshot.saveState,
      phase:
        this.snapshot.phase === "listing" ||
        this.snapshot.phase === "creating" ||
        this.snapshot.phase === "opening"
          ? this.snapshot.projectId
            ? "ready"
            : "idle"
          : this.snapshot.phase,
    })
  }

  private clearAutosaveTimer(): void {
    this.autosaveHandle?.clear()
    this.autosaveHandle = null
  }

  private clearRetryTimer(): void {
    this.retryHandle?.clear()
    this.retryHandle = null
  }

  private patch(partial: Partial<ProjectSessionSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...partial }
    for (const listener of this.listeners) listener()
  }
}

export function createProjectSession(deps?: ProjectSessionDeps): ProjectSession {
  return new ProjectSession(deps)
}
