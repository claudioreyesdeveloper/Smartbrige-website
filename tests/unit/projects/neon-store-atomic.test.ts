import { PgDialect } from "drizzle-orm/pg-core"
import type { SQL } from "drizzle-orm"
import { describe, expect, it } from "vitest"
import type { AppDatabase } from "@/lib/db"
import {
  buildAtomicAppendRevisionQuery,
  buildAtomicCreateProjectQuery,
  type AtomicProjectMutationRow,
  type AtomicProjectQueryExecutor,
} from "@/lib/projects/atomic-queries"
import { createEmptyProjectDocument } from "@/lib/projects/document"
import { NeonProjectStore } from "@/lib/projects/neon-store"
import type {
  AppendRevisionInput,
  CreateProjectInput,
} from "@/lib/projects/store"

type ExecutorOutcome =
  | { rows: AtomicProjectMutationRow[] }
  | { error: Error & { code?: string } }

class RecordingAtomicExecutor implements AtomicProjectQueryExecutor {
  readonly queries: SQL[] = []
  readonly committedRevisionIds: string[] = []

  constructor(private readonly outcomes: ExecutorOutcome[]) {}

  async execute(query: SQL): Promise<{ rows: AtomicProjectMutationRow[] }> {
    this.queries.push(query)
    const outcome = this.outcomes.shift()
    if (!outcome) throw new Error("Missing test executor outcome.")
    if ("error" in outcome) throw outcome.error
    for (const row of outcome.rows) {
      this.committedRevisionIds.push(row.revisionId)
    }
    return outcome
  }
}

const createdAt = new Date("2026-07-18T10:00:00.000Z")

function createInput(): CreateProjectInput {
  return {
    id: "project-1",
    userId: "owner-1",
    title: "Atomic Song",
    revisionId: "revision-1",
    document: createEmptyProjectDocument("Atomic Song"),
    createdAt,
  }
}

function appendInput(overrides: Partial<AppendRevisionInput> = {}): AppendRevisionInput {
  return {
    revisionId: "revision-2",
    projectId: "project-1",
    version: 2,
    expectedVersion: 1,
    document: createEmptyProjectDocument("Atomic Song v2"),
    createdByUserId: "owner-1",
    title: "Atomic Song v2",
    expectedRevisionId: "revision-1",
    createdAt,
    ...overrides,
  }
}

function mutationRow(
  revisionId: string,
  projectId = "project-1",
): AtomicProjectMutationRow {
  return { projectId, revisionId, projectCreatedAt: createdAt }
}

function compile(query: SQL): { sql: string; params: unknown[] } {
  return new PgDialect().sqlToQuery(query)
}

function normalizedSql(query: SQL): string {
  return compile(query).sql.replace(/\s+/g, " ").trim()
}

function createStore(executor: AtomicProjectQueryExecutor): NeonProjectStore {
  return new NeonProjectStore({} as AppDatabase, executor)
}

describe("NeonProjectStore atomic SQL", () => {
  it("creates project and initial revision in one data-modifying CTE statement", async () => {
    const input = createInput()
    const query = buildAtomicCreateProjectQuery(input)
    const generated = normalizedSql(query)
    const compiled = compile(query)

    expect(generated).toContain("WITH inserted_project AS ( INSERT INTO projects")
    expect(generated).toContain(
      "current_revision_id, created_at, updated_at, deleted_at",
    )
    expect(generated).toContain(
      "inserted_revision AS ( INSERT INTO project_revisions",
    )
    expect(generated).toContain("FROM inserted_project")
    expect(generated).not.toContain("UPDATE projects")
    expect(generated.match(/INSERT INTO project_revisions/g)).toHaveLength(1)
    expect(compiled.params).toContain("project-1")
    expect(compiled.params).toContain("revision-1")
    expect(compiled.params).toContain("owner-1")

    const executor = new RecordingAtomicExecutor([
      { rows: [mutationRow("revision-1")] },
    ])
    const created = await createStore(executor).insertProjectWithInitialRevision(
      input,
    )

    expect(executor.queries).toHaveLength(1)
    expect(created.project.currentRevisionId).toBe("revision-1")
    expect(created.revision.version).toBe(1)
  })

  it("generates one save statement with owner, revision, and version predicates", () => {
    const input = appendInput()
    const query = buildAtomicAppendRevisionQuery(input)
    const generated = normalizedSql(query)
    const compiled = compile(query)

    expect(generated).toMatch(/^WITH advanced_project AS \( UPDATE projects/)
    expect(generated).toContain("projects.user_id =")
    expect(generated).toContain("projects.current_revision_id =")
    expect(generated).toContain("current_revision.version =")
    expect(generated).toContain("projects.deleted_at IS NULL")
    expect(generated).toContain(
      "inserted_revision AS ( INSERT INTO project_revisions",
    )
    expect(generated).toContain("FROM advanced_project")
    expect(generated).not.toContain("ON CONFLICT")
    expect(compiled.params).toContain("owner-1")
    expect(compiled.params).toContain("revision-1")
    expect(compiled.params).toContain(1)
    expect(compiled.params).toContain(2)
  })

  it("allows only one concurrent save and returns no result for the stale save", async () => {
    const executor = new RecordingAtomicExecutor([
      { rows: [mutationRow("revision-2")] },
      { rows: [] },
    ])
    const store = createStore(executor)

    const winner = await store.appendRevisionIfCurrent(appendInput())
    const stale = await store.appendRevisionIfCurrent(
      appendInput({ revisionId: "revision-3" }),
    )

    expect(winner?.revision.id).toBe("revision-2")
    expect(stale).toBeNull()
    expect(executor.queries).toHaveLength(2)
    expect(executor.committedRevisionIds).toEqual(["revision-2"])
  })

  it("leaves no committed revision after interruption and permits retry", async () => {
    const executor = new RecordingAtomicExecutor([
      { error: new Error("network interrupted") },
      { rows: [mutationRow("revision-2")] },
    ])
    const store = createStore(executor)

    await expect(store.appendRevisionIfCurrent(appendInput())).rejects.toThrow(
      /network interrupted/,
    )
    expect(executor.committedRevisionIds).toEqual([])

    const retry = await store.appendRevisionIfCurrent(appendInput())
    expect(retry?.revision.id).toBe("revision-2")
    expect(executor.committedRevisionIds).toEqual(["revision-2"])
  })

  it("rolls back initial creation failure and permits a clean retry", async () => {
    const executor = new RecordingAtomicExecutor([
      { error: new Error("statement failed") },
      { rows: [mutationRow("revision-1")] },
    ])
    const store = createStore(executor)
    const input = createInput()

    await expect(
      store.insertProjectWithInitialRevision(input),
    ).rejects.toThrow(/statement failed/)
    expect(executor.committedRevisionIds).toEqual([])

    const retry = await store.insertProjectWithInitialRevision(input)
    expect(retry.project.currentRevisionId).toBe("revision-1")
    expect(executor.committedRevisionIds).toEqual(["revision-1"])
  })

  it("treats duplicate revision/version as conflict with no orphan revision", async () => {
    const duplicate = Object.assign(new Error("duplicate key"), {
      code: "23505",
    })
    const executor = new RecordingAtomicExecutor([{ error: duplicate }])
    const store = createStore(executor)

    const result = await store.appendRevisionIfCurrent(appendInput())

    expect(result).toBeNull()
    expect(executor.queries).toHaveLength(1)
    expect(executor.committedRevisionIds).toEqual([])
  })

  it("rejects a non-sequential version before issuing SQL", async () => {
    const executor = new RecordingAtomicExecutor([])
    const store = createStore(executor)

    const result = await store.appendRevisionIfCurrent(
      appendInput({ version: 4 }),
    )

    expect(result).toBeNull()
    expect(executor.queries).toEqual([])
  })
})
