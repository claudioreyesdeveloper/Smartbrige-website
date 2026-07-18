import { and, asc, desc, eq, isNull } from "drizzle-orm"
import { getDb, type AppDatabase } from "@/lib/db"
import { blobReferences, projectRevisions, projects } from "@/lib/db/schema"
import {
  cloneProjectDocument,
  migrateProjectDocument,
} from "@/lib/projects/document"
import {
  buildAtomicAppendRevisionQuery,
  buildAtomicCreateProjectQuery,
  DrizzleAtomicProjectQueryExecutor,
  type AtomicProjectQueryExecutor,
} from "@/lib/projects/atomic-queries"
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

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  )
}

export class NeonProjectStore implements ProjectStore {
  private readonly atomicExecutor: AtomicProjectQueryExecutor

  constructor(
    private readonly db: AppDatabase = getDb(),
    atomicExecutor?: AtomicProjectQueryExecutor,
  ) {
    this.atomicExecutor =
      atomicExecutor ?? new DrizzleAtomicProjectQueryExecutor(db)
  }

  async insertProjectWithInitialRevision(input: CreateProjectInput): Promise<ProjectWithRevision> {
    const result = await this.atomicExecutor.execute(
      buildAtomicCreateProjectQuery(input),
    )
    if (result.rows.length !== 1) {
      throw new Error("Project creation conflict.")
    }
    const mutation = result.rows[0]
    if (
      mutation.projectId !== input.id ||
      mutation.revisionId !== input.revisionId
    ) {
      throw new Error("Atomic project creation returned unexpected identifiers.")
    }

    return {
      project: {
        id: input.id,
        userId: input.userId,
        title: input.title,
        currentRevisionId: input.revisionId,
        createdAt: new Date(mutation.projectCreatedAt),
        updatedAt: new Date(input.createdAt),
        deletedAt: null,
      },
      revision: {
        id: input.revisionId,
        projectId: input.id,
        version: 1,
        document: cloneProjectDocument(input.document),
        createdByUserId: input.userId,
        createdAt: new Date(input.createdAt),
      },
    }
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
    if (input.version !== input.expectedVersion + 1) {
      return null
    }

    let result
    try {
      result = await this.atomicExecutor.execute(
        buildAtomicAppendRevisionQuery(input),
      )
    } catch (error) {
      if (isUniqueViolation(error)) {
        return null
      }
      throw error
    }
    if (result.rows.length !== 1) {
      return null
    }
    const mutation = result.rows[0]
    if (
      mutation.projectId !== input.projectId ||
      mutation.revisionId !== input.revisionId
    ) {
      throw new Error("Atomic project save returned unexpected identifiers.")
    }

    return {
      project: {
        id: input.projectId,
        userId: input.createdByUserId,
        title: input.title,
        currentRevisionId: input.revisionId,
        createdAt: new Date(mutation.projectCreatedAt),
        updatedAt: input.createdAt,
        deletedAt: null,
      },
      revision: {
        id: input.revisionId,
        projectId: input.projectId,
        version: input.version,
        document: cloneProjectDocument(input.document),
        createdByUserId: input.createdByUserId,
        createdAt: new Date(input.createdAt),
      },
    }
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
