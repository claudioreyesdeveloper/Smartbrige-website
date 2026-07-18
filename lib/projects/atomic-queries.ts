import { sql, type SQL } from "drizzle-orm"
import type { AppDatabase } from "@/lib/db"
import type {
  AppendRevisionInput,
  CreateProjectInput,
} from "@/lib/projects/store"

export type AtomicProjectMutationRow = {
  projectId: string
  revisionId: string
  projectCreatedAt: Date | string
}

export interface AtomicProjectQueryExecutor {
  execute(query: SQL): Promise<{ rows: AtomicProjectMutationRow[] }>
}

export class DrizzleAtomicProjectQueryExecutor
  implements AtomicProjectQueryExecutor
{
  constructor(private readonly db: AppDatabase) {}

  async execute(
    query: SQL,
  ): Promise<{ rows: AtomicProjectMutationRow[] }> {
    return this.db.execute<AtomicProjectMutationRow>(query)
  }
}

export function buildAtomicCreateProjectQuery(
  input: CreateProjectInput,
): SQL {
  const documentJson = JSON.stringify(input.document)

  return sql`
    WITH inserted_project AS (
      INSERT INTO projects (
        id,
        user_id,
        title,
        current_revision_id,
        created_at,
        updated_at,
        deleted_at
      )
      VALUES (
        ${input.id},
        ${input.userId},
        ${input.title},
        ${input.revisionId},
        ${input.createdAt},
        ${input.createdAt},
        NULL
      )
      ON CONFLICT DO NOTHING
      RETURNING id
    ),
    inserted_revision AS (
      INSERT INTO project_revisions (
        id,
        project_id,
        version,
        document,
        created_by_user_id,
        created_at
      )
      SELECT
        ${input.revisionId},
        inserted_project.id,
        1,
        ${documentJson}::jsonb,
        ${input.userId},
        ${input.createdAt}
      FROM inserted_project
      RETURNING id, project_id
    )
    SELECT
      inserted_project.id AS "projectId",
      inserted_revision.id AS "revisionId",
      ${input.createdAt} AS "projectCreatedAt"
    FROM inserted_project
    INNER JOIN inserted_revision
      ON inserted_revision.project_id = inserted_project.id
  `
}

export function buildAtomicAppendRevisionQuery(
  input: AppendRevisionInput,
): SQL {
  const documentJson = JSON.stringify(input.document)

  return sql`
    WITH advanced_project AS (
      UPDATE projects
      SET
        title = ${input.title},
        current_revision_id = ${input.revisionId},
        updated_at = ${input.createdAt}
      WHERE projects.id = ${input.projectId}
        AND projects.user_id = ${input.createdByUserId}
        AND projects.current_revision_id = ${input.expectedRevisionId}
        AND projects.deleted_at IS NULL
        AND EXISTS (
          SELECT 1
          FROM project_revisions AS current_revision
          WHERE current_revision.id = ${input.expectedRevisionId}
            AND current_revision.project_id = projects.id
            AND current_revision.version = ${input.expectedVersion}
        )
      RETURNING
        projects.id,
        projects.created_at
    ),
    inserted_revision AS (
      INSERT INTO project_revisions (
        id,
        project_id,
        version,
        document,
        created_by_user_id,
        created_at
      )
      SELECT
        ${input.revisionId},
        advanced_project.id,
        ${input.version},
        ${documentJson}::jsonb,
        ${input.createdByUserId},
        ${input.createdAt}
      FROM advanced_project
      RETURNING id, project_id
    )
    SELECT
      advanced_project.id AS "projectId",
      inserted_revision.id AS "revisionId",
      advanced_project.created_at AS "projectCreatedAt"
    FROM advanced_project
    INNER JOIN inserted_revision
      ON inserted_revision.project_id = advanced_project.id
  `
}
