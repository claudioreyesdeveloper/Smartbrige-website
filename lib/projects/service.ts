import { assertAuthenticatedUserId, assertResourceOwner, AuthorizationError } from "@/lib/auth/owner"
import {
  createEmptyProjectDocument,
  parseAndValidateProjectDocument,
  type ProjectDocument,
} from "@/lib/projects/document"
import { ProjectError } from "@/lib/projects/errors"
import { PROJECT_TITLE_MAX_LENGTH } from "@/lib/projects/limits"
import type {
  BlobReferenceRow,
  ProjectRevisionRow,
  ProjectRow,
  ProjectStore,
  ProjectWithRevision,
} from "@/lib/projects/store"

export type ProjectSummary = {
  id: string
  title: string
  currentRevisionId: string | null
  currentVersion: number | null
  createdAt: string
  updatedAt: string
}

export type ProjectDetail = {
  id: string
  title: string
  revisionId: string
  version: number
  document: ProjectDocument
  createdAt: string
  updatedAt: string
}

export type ProjectSaveResult = ProjectDetail

export type ProjectExportPayload = {
  exportedAt: string
  project: ProjectRow
  revisions: ProjectRevisionRow[]
  blobReferences: BlobReferenceRow[]
}

export type AccountExportPayload = {
  exportedAt: string
  userId: string
  projects: Array<{
    project: ProjectRow
    revisions: ProjectRevisionRow[]
    blobReferences: BlobReferenceRow[]
  }>
  orphanBlobReferences: BlobReferenceRow[]
}

export type CreateProjectParams = {
  userId: string | undefined | null
  title?: string
  document?: unknown
}

export type SaveProjectParams = {
  userId: string | undefined | null
  projectId: string
  document: unknown
  expectedRevisionId: string
  expectedVersion: number
  title?: string
}

function toIso(date: Date): string {
  return date.toISOString()
}

function normalizeTitle(title: string | undefined, fallback: string): string {
  const value = (title ?? fallback).trim()
  if (!value) {
    throw new ProjectError("validation", "Project title must be a non-empty string.")
  }
  if (value.length > PROJECT_TITLE_MAX_LENGTH) {
    throw new ProjectError(
      "validation",
      `Project title exceeds maximum length ${PROJECT_TITLE_MAX_LENGTH}.`,
    )
  }
  return value
}

function mapAuthorizationError(error: unknown): never {
  if (error instanceof AuthorizationError) {
    throw new ProjectError(error.code, error.message)
  }
  throw error
}

function requireUserId(userId: string | undefined | null): string {
  try {
    assertAuthenticatedUserId(userId)
    return userId
  } catch (error) {
    mapAuthorizationError(error)
  }
}

async function requireOwnedActiveProject(
  store: ProjectStore,
  userId: string,
  projectId: string,
): Promise<ProjectRow> {
  const project = await store.getProject(projectId)
  if (!project || project.deletedAt !== null) {
    throw new ProjectError("not_found", "Project was not found.")
  }
  try {
    assertResourceOwner(project.userId, userId, "project")
  } catch (error) {
    mapAuthorizationError(error)
  }
  return project
}

export class ProjectService {
  constructor(
    private readonly store: ProjectStore,
    private readonly idFactory: () => string = () => crypto.randomUUID(),
    private readonly now: () => Date = () => new Date(),
  ) {}

  async create(params: CreateProjectParams): Promise<ProjectDetail> {
    const userId = requireUserId(params.userId)
    const document = params.document
      ? parseAndValidateProjectDocument(params.document)
      : createEmptyProjectDocument(params.title ?? "Untitled")
    const title = normalizeTitle(params.title ?? document.song.title, document.song.title)
    document.song.title = title

    const createdAt = this.now()
    const result = await this.store.insertProjectWithInitialRevision({
      id: this.idFactory(),
      userId,
      title,
      revisionId: this.idFactory(),
      document,
      createdAt,
    })
    return this.toDetail(result)
  }

  async list(userId: string | undefined | null): Promise<ProjectSummary[]> {
    const ownerId = requireUserId(userId)
    const rows = await this.store.listProjectsForUser(ownerId)
    const summaries: ProjectSummary[] = []
    for (const project of rows) {
      let currentVersion: number | null = null
      if (project.currentRevisionId) {
        const revision = await this.store.getRevision(project.currentRevisionId)
        currentVersion = revision?.version ?? null
      }
      summaries.push({
        id: project.id,
        title: project.title,
        currentRevisionId: project.currentRevisionId,
        currentVersion,
        createdAt: toIso(project.createdAt),
        updatedAt: toIso(project.updatedAt),
      })
    }
    return summaries
  }

  async load(userId: string | undefined | null, projectId: string): Promise<ProjectDetail> {
    const ownerId = requireUserId(userId)
    const project = await requireOwnedActiveProject(this.store, ownerId, projectId)
    if (!project.currentRevisionId) {
      throw new ProjectError("not_found", "Project has no current revision.")
    }
    const revision = await this.store.getRevision(project.currentRevisionId)
    if (!revision) {
      throw new ProjectError("not_found", "Project revision was not found.")
    }
    return {
      id: project.id,
      title: project.title,
      revisionId: revision.id,
      version: revision.version,
      document: revision.document,
      createdAt: toIso(project.createdAt),
      updatedAt: toIso(project.updatedAt),
    }
  }

  async save(params: SaveProjectParams): Promise<ProjectSaveResult> {
    const userId = requireUserId(params.userId)
    if (
      typeof params.expectedRevisionId !== "string" ||
      params.expectedRevisionId.trim().length === 0
    ) {
      throw new ProjectError("validation", "expectedRevisionId is required.")
    }
    if (
      typeof params.expectedVersion !== "number" ||
      !Number.isInteger(params.expectedVersion) ||
      params.expectedVersion < 1
    ) {
      throw new ProjectError("validation", "expectedVersion must be a positive integer.")
    }

    const project = await requireOwnedActiveProject(this.store, userId, params.projectId)
    const currentRevision = project.currentRevisionId
      ? await this.store.getRevision(project.currentRevisionId)
      : null
    if (!currentRevision) {
      throw new ProjectError("not_found", "Project revision was not found.")
    }

    if (
      currentRevision.id !== params.expectedRevisionId ||
      currentRevision.version !== params.expectedVersion
    ) {
      throw new ProjectError(
        "conflict",
        "Project was modified; reload and retry with the current revision.",
      )
    }

    const document = parseAndValidateProjectDocument(params.document)
    const title = normalizeTitle(params.title ?? document.song.title, document.song.title)
    document.song.title = title

    const createdAt = this.now()
    const result = await this.store.appendRevisionIfCurrent({
      revisionId: this.idFactory(),
      projectId: project.id,
      version: currentRevision.version + 1,
      document,
      createdByUserId: userId,
      title,
      expectedRevisionId: params.expectedRevisionId,
      createdAt,
    })

    if (!result) {
      throw new ProjectError(
        "conflict",
        "Project was modified; reload and retry with the current revision.",
      )
    }

    return this.toDetail(result)
  }

  async delete(userId: string | undefined | null, projectId: string): Promise<{ ok: true }> {
    const ownerId = requireUserId(userId)
    await requireOwnedActiveProject(this.store, ownerId, projectId)
    const deletedAt = this.now()
    const deleted = await this.store.softDeleteProject(projectId, ownerId, deletedAt)
    if (!deleted) {
      throw new ProjectError("not_found", "Project was not found.")
    }
    // Soft-delete keeps immutable revisions; detach live blob ownership links.
    await this.store.detachBlobReferencesForProject(projectId, ownerId)
    return { ok: true }
  }

  async exportProject(
    userId: string | undefined | null,
    projectId: string,
  ): Promise<ProjectExportPayload> {
    const ownerId = requireUserId(userId)
    const project = await requireOwnedActiveProject(this.store, ownerId, projectId)
    const revisions = await this.store.listRevisionsForProject(project.id)
    const blobRefs = await this.store.listBlobReferencesForProject(project.id, ownerId)
    return {
      exportedAt: toIso(this.now()),
      project,
      revisions,
      blobReferences: blobRefs,
    }
  }

  async exportAccount(userId: string | undefined | null): Promise<AccountExportPayload> {
    const ownerId = requireUserId(userId)
    const projectRows = await this.store.listProjectsForUser(ownerId)
    const allBlobs = await this.store.listBlobReferencesForUser(ownerId)
    const activeProjectIds = new Set(projectRows.map((project) => project.id))

    const projectsPayload = []
    for (const project of projectRows) {
      const revisions = await this.store.listRevisionsForProject(project.id)
      projectsPayload.push({
        project,
        revisions,
        blobReferences: allBlobs.filter((blob) => blob.projectId === project.id),
      })
    }

    return {
      exportedAt: toIso(this.now()),
      userId: ownerId,
      projects: projectsPayload,
      orphanBlobReferences: allBlobs.filter(
        (blob) => blob.projectId === null || !activeProjectIds.has(blob.projectId),
      ),
    }
  }

  private toDetail(result: ProjectWithRevision): ProjectDetail {
    return {
      id: result.project.id,
      title: result.project.title,
      revisionId: result.revision.id,
      version: result.revision.version,
      document: result.revision.document,
      createdAt: toIso(result.project.createdAt),
      updatedAt: toIso(result.project.updatedAt),
    }
  }
}
