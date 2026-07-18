import { and, asc, desc, eq, isNull } from "drizzle-orm"
import { getDb, type AppDatabase } from "@/lib/db"
import { blobReferences, projectRevisions, projects } from "@/lib/db/schema"
import {
  cloneProjectDocument,
  migrateProjectDocument,
  type ProjectDocument,
} from "@/lib/projects/document"
import type {
  AppendRevisionInput,
  BlobReferenceRow,
  CreateProjectInput,
  ProjectRevisionRow,
  ProjectRow,
  ProjectStore,
  ProjectWithRevision,
} from "@/lib/projects/store"

function mapProject(row: typeof projects.$inferSelect): ProjectRow {
  return {
    id: row.id,
    userId: row.userId,
    title: row.title,
    currentRevisionId: row.currentRevisionId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
  }
}

function mapRevision(row: typeof projectRevisions.$inferSelect): ProjectRevisionRow {
  return {
    id: row.id,
    projectId: row.projectId,
    version: row.version,
    document: migrateProjectDocument(row.document),
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt,
  }
}

function mapBlob(row: typeof blobReferences.$inferSelect): BlobReferenceRow {
  return {
    id: row.id,
    userId: row.userId,
    projectId: row.projectId,
    storageKey: row.storageKey,
    contentType: row.contentType,
    byteSize: row.byteSize,
    checksumSha256: row.checksumSha256,
    purpose: row.purpose,
    createdAt: row.createdAt,
  }
}

export class NeonProjectStore implements ProjectStore {
  constructor(private readonly db: AppDatabase = getDb()) {}

  async insertProjectWithInitialRevision(input: CreateProjectInput): Promise<ProjectWithRevision> {
    await this.db.insert(projects).values({
      id: input.id,
      userId: input.userId,
      title: input.title,
      currentRevisionId: null,
      createdAt: input.createdAt,
      updatedAt: input.createdAt,
      deletedAt: null,
    })

    await this.db.insert(projectRevisions).values({
      id: input.revisionId,
      projectId: input.id,
      version: 1,
      document: cloneProjectDocument(input.document),
      createdByUserId: input.userId,
      createdAt: input.createdAt,
    })

    await this.db
      .update(projects)
      .set({ currentRevisionId: input.revisionId, updatedAt: input.createdAt })
      .where(eq(projects.id, input.id))

    const project = await this.getProject(input.id)
    const revision = await this.getRevision(input.revisionId)
    if (!project || !revision) {
      throw new Error("Failed to create project revision")
    }
    return { project, revision }
  }

  async listProjectsForUser(userId: string): Promise<ProjectRow[]> {
    const rows = await this.db
      .select()
      .from(projects)
      .where(and(eq(projects.userId, userId), isNull(projects.deletedAt)))
      .orderBy(desc(projects.updatedAt))
    return rows.map(mapProject)
  }

  async getProject(projectId: string): Promise<ProjectRow | null> {
    const row = await this.db.query.projects.findFirst({
      where: eq(projects.id, projectId),
    })
    return row ? mapProject(row) : null
  }

  async getRevision(revisionId: string): Promise<ProjectRevisionRow | null> {
    const row = await this.db.query.projectRevisions.findFirst({
      where: eq(projectRevisions.id, revisionId),
    })
    return row ? mapRevision(row) : null
  }

  async getLatestRevision(projectId: string): Promise<ProjectRevisionRow | null> {
    const project = await this.getProject(projectId)
    if (!project?.currentRevisionId) return null
    return this.getRevision(project.currentRevisionId)
  }

  async listRevisionsForProject(projectId: string): Promise<ProjectRevisionRow[]> {
    const rows = await this.db
      .select()
      .from(projectRevisions)
      .where(eq(projectRevisions.projectId, projectId))
      .orderBy(asc(projectRevisions.version))
    return rows.map(mapRevision)
  }

  async listRevisionsForUser(userId: string): Promise<ProjectRevisionRow[]> {
    const rows = await this.db
      .select({ revision: projectRevisions })
      .from(projectRevisions)
      .innerJoin(projects, eq(projectRevisions.projectId, projects.id))
      .where(and(eq(projects.userId, userId), isNull(projects.deletedAt)))
      .orderBy(asc(projectRevisions.projectId), asc(projectRevisions.version))
    return rows.map((row) => mapRevision(row.revision))
  }

  async appendRevisionIfCurrent(input: AppendRevisionInput): Promise<ProjectWithRevision | null> {
    const current = await this.getProject(input.projectId)
    if (!current || current.deletedAt !== null) return null
    if (current.currentRevisionId !== input.expectedRevisionId) return null

    try {
      await this.db.insert(projectRevisions).values({
        id: input.revisionId,
        projectId: input.projectId,
        version: input.version,
        document: cloneProjectDocument(input.document) as ProjectDocument,
        createdByUserId: input.createdByUserId,
        createdAt: input.createdAt,
      })
    } catch {
      return null
    }

    const updated = await this.db
      .update(projects)
      .set({
        title: input.title,
        currentRevisionId: input.revisionId,
        updatedAt: input.createdAt,
      })
      .where(
        and(
          eq(projects.id, input.projectId),
          eq(projects.currentRevisionId, input.expectedRevisionId),
          isNull(projects.deletedAt),
        ),
      )
      .returning()

    if (updated.length === 0) {
      return null
    }

    const revision = await this.getRevision(input.revisionId)
    if (!revision) return null
    return { project: mapProject(updated[0]), revision }
  }

  async softDeleteProject(projectId: string, userId: string, deletedAt: Date): Promise<boolean> {
    const updated = await this.db
      .update(projects)
      .set({ deletedAt, updatedAt: deletedAt })
      .where(
        and(eq(projects.id, projectId), eq(projects.userId, userId), isNull(projects.deletedAt)),
      )
      .returning({ id: projects.id })
    return updated.length > 0
  }

  async detachBlobReferencesForProject(projectId: string, userId: string): Promise<number> {
    const updated = await this.db
      .update(blobReferences)
      .set({ projectId: null })
      .where(and(eq(blobReferences.projectId, projectId), eq(blobReferences.userId, userId)))
      .returning({ id: blobReferences.id })
    return updated.length
  }

  async listBlobReferencesForUser(userId: string): Promise<BlobReferenceRow[]> {
    const rows = await this.db
      .select()
      .from(blobReferences)
      .where(eq(blobReferences.userId, userId))
      .orderBy(asc(blobReferences.createdAt))
    return rows.map(mapBlob)
  }

  async listBlobReferencesForProject(
    projectId: string,
    userId: string,
  ): Promise<BlobReferenceRow[]> {
    const rows = await this.db
      .select()
      .from(blobReferences)
      .where(and(eq(blobReferences.projectId, projectId), eq(blobReferences.userId, userId)))
      .orderBy(asc(blobReferences.createdAt))
    return rows.map(mapBlob)
  }
}
