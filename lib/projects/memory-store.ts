import { cloneProjectDocument } from "@/lib/projects/document"
import type {
  AppendRevisionInput,
  BlobReferenceRow,
  CreateProjectInput,
  ProjectRevisionRow,
  ProjectRow,
  ProjectStore,
  ProjectWithRevision,
} from "@/lib/projects/store"

function cloneProject(row: ProjectRow): ProjectRow {
  return { ...row, createdAt: new Date(row.createdAt), updatedAt: new Date(row.updatedAt), deletedAt: row.deletedAt ? new Date(row.deletedAt) : null }
}

function cloneRevision(row: ProjectRevisionRow): ProjectRevisionRow {
  return {
    ...row,
    document: cloneProjectDocument(row.document),
    createdAt: new Date(row.createdAt),
  }
}

function cloneBlob(row: BlobReferenceRow): BlobReferenceRow {
  return { ...row, createdAt: new Date(row.createdAt) }
}

/** In-memory ProjectStore for pure unit tests (no Neon credentials). */
export class MemoryProjectStore implements ProjectStore {
  private readonly projects = new Map<string, ProjectRow>()
  private readonly revisions = new Map<string, ProjectRevisionRow>()
  private readonly blobs = new Map<string, BlobReferenceRow>()

  seedBlob(row: BlobReferenceRow): void {
    this.blobs.set(row.id, cloneBlob(row))
  }

  async insertProjectWithInitialRevision(input: CreateProjectInput): Promise<ProjectWithRevision> {
    if (this.projects.has(input.id)) {
      throw new Error(`Project ${input.id} already exists`)
    }
    const project: ProjectRow = {
      id: input.id,
      userId: input.userId,
      title: input.title,
      currentRevisionId: input.revisionId,
      createdAt: new Date(input.createdAt),
      updatedAt: new Date(input.createdAt),
      deletedAt: null,
    }
    const revision: ProjectRevisionRow = {
      id: input.revisionId,
      projectId: input.id,
      version: 1,
      document: cloneProjectDocument(input.document),
      createdByUserId: input.userId,
      createdAt: new Date(input.createdAt),
    }
    this.projects.set(project.id, project)
    this.revisions.set(revision.id, revision)
    return { project: cloneProject(project), revision: cloneRevision(revision) }
  }

  async listProjectsForUser(userId: string): Promise<ProjectRow[]> {
    return [...this.projects.values()]
      .filter((project) => project.userId === userId && project.deletedAt === null)
      .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime())
      .map(cloneProject)
  }

  async getProject(projectId: string): Promise<ProjectRow | null> {
    const project = this.projects.get(projectId)
    return project ? cloneProject(project) : null
  }

  async getRevision(revisionId: string): Promise<ProjectRevisionRow | null> {
    const revision = this.revisions.get(revisionId)
    return revision ? cloneRevision(revision) : null
  }

  async getLatestRevision(projectId: string): Promise<ProjectRevisionRow | null> {
    const project = this.projects.get(projectId)
    if (!project?.currentRevisionId) return null
    return this.getRevision(project.currentRevisionId)
  }

  async listRevisionsForProject(projectId: string): Promise<ProjectRevisionRow[]> {
    return [...this.revisions.values()]
      .filter((revision) => revision.projectId === projectId)
      .sort((left, right) => left.version - right.version)
      .map(cloneRevision)
  }

  async listRevisionsForUser(userId: string): Promise<ProjectRevisionRow[]> {
    const projectIds = new Set(
      [...this.projects.values()]
        .filter((project) => project.userId === userId && project.deletedAt === null)
        .map((project) => project.id),
    )
    return [...this.revisions.values()]
      .filter((revision) => projectIds.has(revision.projectId))
      .sort((left, right) => {
        if (left.projectId === right.projectId) return left.version - right.version
        return left.projectId.localeCompare(right.projectId)
      })
      .map(cloneRevision)
  }

  async appendRevisionIfCurrent(input: AppendRevisionInput): Promise<ProjectWithRevision | null> {
    const project = this.projects.get(input.projectId)
    if (!project || project.deletedAt !== null) return null
    if (project.currentRevisionId !== input.expectedRevisionId) return null

    const existingVersion = [...this.revisions.values()].some(
      (revision) => revision.projectId === input.projectId && revision.version === input.version,
    )
    if (existingVersion) return null

    const revision: ProjectRevisionRow = {
      id: input.revisionId,
      projectId: input.projectId,
      version: input.version,
      document: cloneProjectDocument(input.document),
      createdByUserId: input.createdByUserId,
      createdAt: new Date(input.createdAt),
    }
    project.title = input.title
    project.currentRevisionId = input.revisionId
    project.updatedAt = new Date(input.createdAt)
    this.revisions.set(revision.id, revision)
    return { project: cloneProject(project), revision: cloneRevision(revision) }
  }

  async softDeleteProject(projectId: string, userId: string, deletedAt: Date): Promise<boolean> {
    const project = this.projects.get(projectId)
    if (!project || project.userId !== userId || project.deletedAt !== null) return false
    project.deletedAt = new Date(deletedAt)
    project.updatedAt = new Date(deletedAt)
    return true
  }

  async detachBlobReferencesForProject(projectId: string, userId: string): Promise<number> {
    let count = 0
    for (const blob of this.blobs.values()) {
      if (blob.projectId === projectId && blob.userId === userId) {
        blob.projectId = null
        count += 1
      }
    }
    return count
  }

  async listBlobReferencesForUser(userId: string): Promise<BlobReferenceRow[]> {
    return [...this.blobs.values()].filter((blob) => blob.userId === userId).map(cloneBlob)
  }

  async listBlobReferencesForProject(
    projectId: string,
    userId: string,
  ): Promise<BlobReferenceRow[]> {
    return [...this.blobs.values()]
      .filter((blob) => blob.userId === userId && blob.projectId === projectId)
      .map(cloneBlob)
  }
}
