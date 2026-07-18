import type {
  ProjectBlobRef,
  ProjectDocument,
  ProjectRecipe,
} from "@/lib/projects/document"

export type ClientProjectSummary = {
  id: string
  title: string
  currentRevisionId: string | null
  currentVersion: number | null
  createdAt: string
  updatedAt: string
}

export type ClientProjectDetail = {
  id: string
  title: string
  revisionId: string
  version: number
  document: ProjectDocument
  createdAt: string
  updatedAt: string
}

export type ClientProjectExport = {
  exportedAt: string
  project: Record<string, unknown>
  revisions: unknown[]
  blobReferences: unknown[]
}

export type ProjectSaveState =
  | "clean"
  | "dirty"
  | "scheduled"
  | "saving"
  | "saved"
  | "conflict"
  | "error"

export type ProjectSessionPhase =
  | "idle"
  | "listing"
  | "creating"
  | "opening"
  | "ready"
  | "closed"

export type ProjectConflictChoice = "reload" | "download_copy"

export type ProjectConflictState = {
  message: string
  localTitle: string
  localDocument: ProjectDocument
}

export type ProjectSessionSnapshot = {
  phase: ProjectSessionPhase
  projects: ClientProjectSummary[]
  projectId: string | null
  title: string
  revisionId: string | null
  version: number | null
  document: ProjectDocument | null
  dirty: boolean
  saveState: ProjectSaveState
  lastError: string | null
  conflict: ProjectConflictState | null
  /** True when open/create applied a schema migration to the working document. */
  migrationApplied: boolean
  transportActive: boolean
  /** Dirty/save work waiting because transport is active. */
  pendingSaveAfterTransport: boolean
}

export type ProjectDocumentPatch = {
  title?: string
  document?: ProjectDocument
  bass?: ProjectRecipe | null
  drums?: ProjectRecipe | null
  blobs?: ProjectBlobRef[] | null
  bassRenderBlobId?: string | null
  drumsRenderBlobId?: string | null
}

export type ProjectClientErrorCode =
  | "unauthenticated"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "validation"
  | "payload_too_large"
  | "malformed"
  | "network"
  | "internal"

export class ProjectClientError extends Error {
  readonly code: ProjectClientErrorCode
  readonly status: number | null

  constructor(code: ProjectClientErrorCode, message: string, status: number | null = null) {
    super(message)
    this.name = "ProjectClientError"
    this.code = code
    this.status = status
  }
}

export const DEFAULT_AUTOSAVE_DELAY_MS = 800

export const NAVIGATION_WARNING =
  "You have unsaved project changes. Leave this page and discard them?"
