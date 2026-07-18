import {
  migrateProjectDocument,
  PROJECT_DOCUMENT_SCHEMA_VERSION,
  type ProjectDocument,
} from "@/lib/projects/document"
import {
  ProjectClientError,
  type ClientProjectDetail,
  type ClientProjectExport,
  type ClientProjectSummary,
} from "@/lib/projects/client/types"

export type ProjectFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>

export type ProjectApiClientOptions = {
  fetch?: ProjectFetch
  baseUrl?: string
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isIsoString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text.trim()) return null
  try {
    return JSON.parse(text) as unknown
  } catch {
    throw new ProjectClientError("malformed", "API response is not valid JSON.", response.status)
  }
}

function mapError(status: number, body: unknown): ProjectClientError {
  const message =
    isPlainObject(body) && typeof body.error === "string"
      ? body.error
      : `Request failed with status ${status}.`
  const code =
    isPlainObject(body) && typeof body.code === "string" ? body.code : undefined

  switch (status) {
    case 401:
      return new ProjectClientError("unauthenticated", message, status)
    case 403:
      return new ProjectClientError("forbidden", message, status)
    case 404:
      return new ProjectClientError("not_found", message, status)
    case 409:
      return new ProjectClientError("conflict", message, status)
    case 413:
      return new ProjectClientError("payload_too_large", message, status)
    case 400:
      return new ProjectClientError("validation", message, status)
    default:
      if (code === "conflict") return new ProjectClientError("conflict", message, status)
      return new ProjectClientError("internal", message, status)
  }
}

function parseSummary(raw: unknown, label: string): ClientProjectSummary {
  if (!isPlainObject(raw)) {
    throw new ProjectClientError("malformed", `${label} must be an object.`)
  }
  if (typeof raw.id !== "string" || !raw.id) {
    throw new ProjectClientError("malformed", `${label}.id is required.`)
  }
  if (typeof raw.title !== "string") {
    throw new ProjectClientError("malformed", `${label}.title is required.`)
  }
  if (
    raw.currentRevisionId !== null &&
    raw.currentRevisionId !== undefined &&
    typeof raw.currentRevisionId !== "string"
  ) {
    throw new ProjectClientError("malformed", `${label}.currentRevisionId is invalid.`)
  }
  if (
    raw.currentVersion !== null &&
    raw.currentVersion !== undefined &&
    (typeof raw.currentVersion !== "number" || !Number.isFinite(raw.currentVersion))
  ) {
    throw new ProjectClientError("malformed", `${label}.currentVersion is invalid.`)
  }
  if (!isIsoString(raw.createdAt) || !isIsoString(raw.updatedAt)) {
    throw new ProjectClientError("malformed", `${label} timestamps are invalid.`)
  }
  return {
    id: raw.id,
    title: raw.title,
    currentRevisionId: (raw.currentRevisionId as string | null | undefined) ?? null,
    currentVersion: (raw.currentVersion as number | null | undefined) ?? null,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  }
}

export type ParsedProjectDetail = {
  detail: ClientProjectDetail
  migrationApplied: boolean
}

/**
 * Parses a project detail payload and migrates legacy documents into schema v1.
 */
export function parseProjectDetail(raw: unknown, label = "project"): ParsedProjectDetail {
  if (!isPlainObject(raw)) {
    throw new ProjectClientError("malformed", `${label} must be an object.`)
  }
  if (typeof raw.id !== "string" || !raw.id) {
    throw new ProjectClientError("malformed", `${label}.id is required.`)
  }
  if (typeof raw.title !== "string") {
    throw new ProjectClientError("malformed", `${label}.title is required.`)
  }
  if (typeof raw.revisionId !== "string" || !raw.revisionId) {
    throw new ProjectClientError("malformed", `${label}.revisionId is required.`)
  }
  if (typeof raw.version !== "number" || !Number.isInteger(raw.version) || raw.version < 1) {
    throw new ProjectClientError("malformed", `${label}.version is invalid.`)
  }
  if (!isIsoString(raw.createdAt) || !isIsoString(raw.updatedAt)) {
    throw new ProjectClientError("malformed", `${label} timestamps are invalid.`)
  }
  if (!("document" in raw)) {
    throw new ProjectClientError("malformed", `${label}.document is required.`)
  }

  const migrationApplied = needsDocumentMigration(raw.document)
  let document: ProjectDocument
  try {
    document = migrateProjectDocument(raw.document)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid project document."
    throw new ProjectClientError("malformed", `${label}.document: ${message}`)
  }

  return {
    migrationApplied,
    detail: {
      id: raw.id,
      title: raw.title,
      revisionId: raw.revisionId,
      version: raw.version,
      document,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
    },
  }
}

export function needsDocumentMigration(raw: unknown): boolean {
  if (!isPlainObject(raw)) return true
  if (typeof raw.schemaVersion === "number") {
    return raw.schemaVersion < PROJECT_DOCUMENT_SCHEMA_VERSION
  }
  if (typeof raw.version === "number") return true
  if (!isPlainObject(raw.song)) return true
  return false
}

export function createProjectApiClient(options: ProjectApiClientOptions = {}) {
  const fetchImpl = options.fetch ?? fetch
  const baseUrl = (options.baseUrl ?? "").replace(/\/$/, "")

  async function request(path: string, init?: RequestInit): Promise<unknown> {
    let response: Response
    try {
      response = await fetchImpl(`${baseUrl}${path}`, {
        ...init,
        headers: {
          Accept: "application/json",
          ...(init?.body ? { "Content-Type": "application/json" } : {}),
          ...init?.headers,
        },
      })
    } catch {
      throw new ProjectClientError("network", "Network request failed.")
    }

    const body = await readBody(response)
    if (!response.ok) {
      throw mapError(response.status, body)
    }
    return body
  }

  return {
    async list(): Promise<ClientProjectSummary[]> {
      const body = await request("/api/projects", { method: "GET" })
      if (!isPlainObject(body) || !Array.isArray(body.projects)) {
        throw new ProjectClientError("malformed", "List response must include projects[].")
      }
      return body.projects.map((item, index) => parseSummary(item, `projects[${index}]`))
    },

    async create(input: {
      title?: string
      document?: ProjectDocument
    }): Promise<ParsedProjectDetail> {
      const body = await request("/api/projects", {
        method: "POST",
        body: JSON.stringify({
          title: input.title,
          document: input.document,
        }),
      })
      if (!isPlainObject(body) || !("project" in body)) {
        throw new ProjectClientError("malformed", "Create response must include project.")
      }
      return parseProjectDetail(body.project)
    },

    async open(projectId: string): Promise<ParsedProjectDetail> {
      const body = await request(`/api/projects/${encodeURIComponent(projectId)}`, {
        method: "GET",
      })
      if (!isPlainObject(body) || !("project" in body)) {
        throw new ProjectClientError("malformed", "Open response must include project.")
      }
      return parseProjectDetail(body.project)
    },

    async save(
      projectId: string,
      input: {
        document: ProjectDocument
        expectedRevisionId: string
        expectedVersion: number
        title?: string
      },
    ): Promise<ParsedProjectDetail> {
      const body = await request(`/api/projects/${encodeURIComponent(projectId)}`, {
        method: "PUT",
        body: JSON.stringify({
          document: input.document,
          expectedRevisionId: input.expectedRevisionId,
          expectedVersion: input.expectedVersion,
          title: input.title,
        }),
      })
      if (!isPlainObject(body) || !("project" in body)) {
        throw new ProjectClientError("malformed", "Save response must include project.")
      }
      return parseProjectDetail(body.project)
    },

    async delete(projectId: string): Promise<{ ok: true }> {
      const body = await request(`/api/projects/${encodeURIComponent(projectId)}`, {
        method: "DELETE",
      })
      if (!isPlainObject(body) || body.ok !== true) {
        throw new ProjectClientError("malformed", "Delete response must be { ok: true }.")
      }
      return { ok: true }
    },

    async exportProject(projectId: string): Promise<ClientProjectExport> {
      const body = await request(`/api/projects/${encodeURIComponent(projectId)}/export`, {
        method: "GET",
      })
      if (!isPlainObject(body)) {
        throw new ProjectClientError("malformed", "Export response must be an object.")
      }
      if (!isIsoString(body.exportedAt)) {
        throw new ProjectClientError("malformed", "Export response missing exportedAt.")
      }
      if (!isPlainObject(body.project)) {
        throw new ProjectClientError("malformed", "Export response missing project.")
      }
      if (!Array.isArray(body.revisions) || !Array.isArray(body.blobReferences)) {
        throw new ProjectClientError(
          "malformed",
          "Export response must include revisions[] and blobReferences[].",
        )
      }
      return {
        exportedAt: body.exportedAt,
        project: body.project,
        revisions: body.revisions,
        blobReferences: body.blobReferences,
      }
    },
  }
}

export type ProjectApiClient = ReturnType<typeof createProjectApiClient>
