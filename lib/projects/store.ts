import type { ProjectDocument } from "@/lib/projects/document"

export type ProjectRow = {
  id: string
  userId: string
  title: string
  currentRevisionId: string | null
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
}

export type ProjectRevisionRow = {
  id: string
  projectId: string
  version: number
  document: ProjectDocument
  createdByUserId: string
  createdAt: Date
}

export type BlobReferenceRow = {
  id: string
  userId: string
  projectId: string | null
  storageKey: string
  contentType: string
  byteSize: number
  checksumSha256: string
  purpose: "render" | "upload" | "factory"
  createdAt: Date
}

export type CreateProjectInput = {
  id: string
  userId: string
  title: string
  revisionId: string
  document: ProjectDocument
  createdAt: Date
}

export type AppendRevisionInput = {
  revisionId: string
  projectId: string
  version: number
  document: ProjectDocument
  createdByUserId: string
  title: string
  expectedRevisionId: string
  createdAt: Date
}

export type ProjectWithRevision = {
  project: ProjectRow
  revision: ProjectRevisionRow
}

/**
 * Persistence boundary for projects. Implementations may use Neon or an
 * in-memory fake for unit tests (no live DATABASE_URL required).
 */
export interface ProjectStore {
  insertProjectWithInitialRevision(input: CreateProjectInput): Promise<ProjectWithRevision>
  listProjectsForUser(userId: string): Promise<ProjectRow[]>
  getProject(projectId: string): Promise<ProjectRow | null>
  getRevision(revisionId: string): Promise<ProjectRevisionRow | null>
  getLatestRevision(projectId: string): Promise<ProjectRevisionRow | null>
  listRevisionsForProject(projectId: string): Promise<ProjectRevisionRow[]>
  listRevisionsForUser(userId: string): Promise<ProjectRevisionRow[]>
  /**
   * Appends an immutable revision and advances the project pointer only when
   * `expectedRevisionId` still matches. Returns null on optimistic conflict.
   */
  appendRevisionIfCurrent(input: AppendRevisionInput): Promise<ProjectWithRevision | null>
  softDeleteProject(projectId: string, userId: string, deletedAt: Date): Promise<boolean>
  detachBlobReferencesForProject(projectId: string, userId: string): Promise<number>
  listBlobReferencesForUser(userId: string): Promise<BlobReferenceRow[]>
  listBlobReferencesForProject(projectId: string, userId: string): Promise<BlobReferenceRow[]>
}
