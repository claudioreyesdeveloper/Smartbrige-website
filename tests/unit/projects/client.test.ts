import { describe, expect, it, vi } from "vitest"
import {
  createEmptyProjectDocument,
  type ProjectDocument,
} from "@/lib/projects/document"
import {
  createProjectSession,
  createTransportActivity,
  needsDocumentMigration,
  parseProjectDetail,
  ProjectClientError,
  type ProjectClock,
  type ProjectTimer,
  type ProjectTimerHandle,
} from "@/lib/projects/client"

class FakeClock implements ProjectClock {
  current = 0
  now() {
    return this.current
  }
  advance(ms: number) {
    this.current += ms
  }
}

class FakeTimer implements ProjectTimer {
  private nextId = 1
  private tasks = new Map<number, { due: number; callback: () => void }>()

  constructor(private readonly clock: FakeClock) {}

  setTimeout(callback: () => void, delayMs: number): ProjectTimerHandle {
    const id = this.nextId++
    this.tasks.set(id, {
      due: this.clock.now() + Math.max(0, delayMs),
      callback,
    })
    return {
      clear: () => {
        this.tasks.delete(id)
      },
    }
  }

  pendingCount() {
    return this.tasks.size
  }

  flush(until?: number) {
    const limit = until ?? this.clock.now()
    for (;;) {
      let next: { id: number; due: number; callback: () => void } | null = null
      for (const [id, task] of this.tasks) {
        if (task.due > limit) continue
        if (!next || task.due < next.due || (task.due === next.due && id < next.id)) {
          next = { id, due: task.due, callback: task.callback }
        }
      }
      if (!next) return
      this.tasks.delete(next.id)
      next.callback()
    }
  }
}

type SaveBody = {
  document: ProjectDocument
  expectedRevisionId: string
  expectedVersion: number
  title?: string
}

type MockCall = {
  url: string
  method: string
  body: SaveBody | Record<string, unknown> | null
}

function asSaveBody(body: MockCall["body"]): SaveBody {
  return body as SaveBody
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

function detail(overrides?: Partial<{
  id: string
  title: string
  revisionId: string
  version: number
  document: ProjectDocument
}>) {
  const document = overrides?.document ?? createEmptyProjectDocument(overrides?.title ?? "Song")
  return {
    id: overrides?.id ?? "proj-1",
    title: overrides?.title ?? document.song.title,
    revisionId: overrides?.revisionId ?? "rev-1",
    version: overrides?.version ?? 1,
    document,
    createdAt: "2026-07-18T10:00:00.000Z",
    updatedAt: "2026-07-18T10:00:00.000Z",
  }
}

function createHarness(options?: {
  fetchImpl?: (call: MockCall, calls: MockCall[]) => Promise<Response> | Response
  transport?: ReturnType<typeof createTransportActivity>
  confirmNavigate?: (message: string) => boolean
}) {
  const clock = new FakeClock()
  const timer = new FakeTimer(clock)
  const calls: MockCall[] = []
  const downloads: Array<{ filename: string; contents: string }> = []
  const transport = options?.transport ?? createTransportActivity()

  const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const method = (init?.method ?? "GET").toUpperCase()
    const body = (init?.body ? JSON.parse(String(init.body)) : null) as MockCall["body"]
    const call: MockCall = { url, method, body }
    calls.push(call)
    if (options?.fetchImpl) {
      return options.fetchImpl(call, calls)
    }
    throw new Error(`Unhandled fetch ${method} ${url}`)
  })

  const session = createProjectSession({
    fetch: fetchImpl as unknown as typeof fetch,
    timer,
    clock,
    transport,
    autosaveDelayMs: 100,
    retryDelayMs: 100,
    confirmNavigate: options?.confirmNavigate ?? (() => true),
    download: (filename, contents) => {
      downloads.push({ filename, contents })
    },
  })

  return { session, clock, timer, calls, downloads, transport, fetchImpl }
}

async function settle() {
  for (let i = 0; i < 15; i += 1) {
    await Promise.resolve()
  }
}

async function runDueTimers(
  clock: FakeClock,
  timer: FakeTimer,
  delayMs = 100,
) {
  clock.advance(delayMs)
  timer.flush()
  await settle()
}

describe("project client API parsing", () => {
  it("detects legacy documents that need migration", () => {
    expect(needsDocumentMigration({ title: "Old", tempo: 100, key: "C", sections: [] })).toBe(
      true,
    )
    expect(
      needsDocumentMigration({
        schemaVersion: 1,
        song: { title: "New", tempo: 120, key: "C", sections: [] },
      }),
    ).toBe(false)
  })

  it("migrates legacy project payloads when parsing detail", () => {
    const parsed = parseProjectDetail({
      id: "p1",
      title: "Legacy",
      revisionId: "r1",
      version: 1,
      createdAt: "2026-07-18T10:00:00.000Z",
      updatedAt: "2026-07-18T10:00:00.000Z",
      document: {
        version: 0,
        title: "Legacy",
        tempo: 90,
        key: "F",
        sections: [],
      },
    })
    expect(parsed.migrationApplied).toBe(true)
    expect(parsed.detail.document.schemaVersion).toBe(1)
    expect(parsed.detail.document.song.tempo).toBe(90)
  })

  it("rejects malformed project detail payloads", () => {
    expect(() => parseProjectDetail({ id: "p1" })).toThrow(ProjectClientError)
    expect(() =>
      parseProjectDetail({
        id: "p1",
        title: "X",
        revisionId: "r1",
        version: 1,
        createdAt: "2026-07-18T10:00:00.000Z",
        updatedAt: "2026-07-18T10:00:00.000Z",
        document: "nope",
      }),
    ).toThrow(/document/)
  })
})

describe("ProjectSession", () => {
  it("lists, creates, and opens projects", async () => {
    const { session, calls } = createHarness({
      fetchImpl: (call) => {
        if (call.method === "GET" && call.url.endsWith("/api/projects")) {
          return jsonResponse(200, {
            projects: [
              {
                id: "proj-1",
                title: "Listed",
                currentRevisionId: "rev-1",
                currentVersion: 1,
                createdAt: "2026-07-18T10:00:00.000Z",
                updatedAt: "2026-07-18T10:00:00.000Z",
              },
            ],
          })
        }
        if (call.method === "POST" && call.url.endsWith("/api/projects")) {
          return jsonResponse(201, { project: detail({ title: "Created", revisionId: "rev-new" }) })
        }
        if (call.method === "GET" && call.url.includes("/api/projects/proj-1")) {
          return jsonResponse(200, { project: detail({ title: "Opened" }) })
        }
        throw new Error(`unexpected ${call.method} ${call.url}`)
      },
    })

    const listed = await session.list()
    expect(listed).toHaveLength(1)
    expect(session.getSnapshot().projects[0]?.title).toBe("Listed")

    await session.create({ title: "Created" })
    expect(session.getSnapshot().phase).toBe("ready")
    expect(session.getSnapshot().revisionId).toBe("rev-new")

    await session.open("proj-1")
    expect(session.getSnapshot().title).toBe("Opened")
    expect(calls.some((call) => call.method === "POST")).toBe(true)
  })

  it("coalesces rapid edits into a single autosave", async () => {
    let version = 1
    let revisionId = "rev-1"
    const { session, clock, timer, calls } = createHarness({
      fetchImpl: (call) => {
        if (call.method === "GET" && call.url.includes("/proj-1") && !call.url.includes("export")) {
          return jsonResponse(200, { project: detail() })
        }
        if (call.method === "PUT") {
          version += 1
          revisionId = `rev-${version}`
          const document = asSaveBody(call.body).document
          return jsonResponse(200, {
            project: detail({
              revisionId,
              version,
              document,
              title: document.song.title,
            }),
          })
        }
        throw new Error(`unexpected ${call.method} ${call.url}`)
      },
    })

    await session.open("proj-1")
    session.updateTitle("A")
    session.updateTitle("AB")
    session.updateTitle("ABC")
    expect(session.getSnapshot().dirty).toBe(true)
    expect(session.getSnapshot().saveState).toBe("scheduled")

    await runDueTimers(clock, timer)
    const puts = calls.filter((call) => call.method === "PUT")
    expect(puts).toHaveLength(1)
    expect(asSaveBody(puts[0]?.body ?? null).document.song.title).toBe("ABC")
    expect(asSaveBody(puts[0]?.body ?? null).expectedRevisionId).toBe("rev-1")
    expect(asSaveBody(puts[0]?.body ?? null).expectedVersion).toBe(1)
    expect(session.getSnapshot().dirty).toBe(false)
    expect(session.getSnapshot().version).toBe(2)
    expect(session.getSnapshot().revisionId).toBe("rev-2")
  })

  it("does not fetch while transport is active and resumes after stop", async () => {
    let version = 1
    const transport = createTransportActivity()
    const { session, clock, timer, calls } = createHarness({
      transport,
      fetchImpl: (call) => {
        if (call.method === "GET") {
          return jsonResponse(200, { project: detail() })
        }
        if (call.method === "PUT") {
          version += 1
          const saved = asSaveBody(call.body)
          return jsonResponse(200, {
            project: detail({
              revisionId: `rev-${version}`,
              version,
              document: saved.document,
              title: saved.document.song.title,
            }),
          })
        }
        throw new Error(`unexpected ${call.method}`)
      },
    })

    await session.open("proj-1")
    const fetchesAfterOpen = calls.length

    transport.setActive(true)
    session.updateTitle("During playback")
    await runDueTimers(clock, timer, 500)

    expect(calls.length).toBe(fetchesAfterOpen)
    expect(session.getSnapshot().pendingSaveAfterTransport).toBe(true)
    expect(session.getSnapshot().dirty).toBe(true)

    const manual = await session.save()
    expect(manual).toBe(false)
    expect(calls.length).toBe(fetchesAfterOpen)

    transport.setActive(false)
    expect(session.getSnapshot().saveState).toBe("scheduled")
    await runDueTimers(clock, timer)

    const puts = calls.filter((call) => call.method === "PUT")
    expect(puts).toHaveLength(1)
    expect(asSaveBody(puts[0]?.body ?? null).document.song.title).toBe("During playback")
    expect(session.getSnapshot().dirty).toBe(false)
  })

  it("handles stale 409 with reload and download-copy choices", async () => {
    let getCount = 0
    const { session, clock, timer, downloads } = createHarness({
      fetchImpl: (call) => {
        if (call.method === "GET" && call.url.endsWith("/proj-1")) {
          getCount += 1
          return jsonResponse(200, {
            project: detail({
              title: "Server",
              document: createEmptyProjectDocument("Server"),
              revisionId: getCount > 1 ? "rev-2" : "rev-1",
              version: getCount > 1 ? 2 : 1,
            }),
          })
        }
        if (call.method === "PUT") {
          return jsonResponse(409, {
            error: "Project was modified; reload and retry with the current revision.",
            code: "conflict",
          })
        }
        throw new Error(`unexpected ${call.method}`)
      },
    })

    await session.open("proj-1")
    session.updateTitle("Local edit")
    await runDueTimers(clock, timer)

    expect(session.getSnapshot().saveState).toBe("conflict")
    expect(session.getSnapshot().conflict?.localDocument.song.title).toBe("Local edit")

    session.downloadLocalCopy()
    expect(downloads).toHaveLength(1)
    expect(downloads[0]?.contents).toContain("Local edit")

    await session.resolveConflict("reload")
    expect(session.getSnapshot().conflict).toBeNull()
    expect(session.getSnapshot().title).toBe("Server")
    expect(session.getSnapshot().version).toBe(2)
    expect(session.getSnapshot().revisionId).toBe("rev-2")
  })

  it("retries offline failures without duplicating revisions", async () => {
    let putCount = 0
    let failOnce = true
    const { session, clock, timer, calls } = createHarness({
      fetchImpl: (call) => {
        if (call.method === "GET") {
          return jsonResponse(200, { project: detail() })
        }
        if (call.method === "PUT") {
          putCount += 1
          if (failOnce) {
            failOnce = false
            throw new TypeError("Failed to fetch")
          }
          const saved = asSaveBody(call.body)
          return jsonResponse(200, {
            project: detail({
              revisionId: "rev-2",
              version: 2,
              document: saved.document,
              title: saved.document.song.title,
            }),
          })
        }
        throw new Error(`unexpected ${call.method}`)
      },
    })

    await session.open("proj-1")
    session.setBass({
      sourceId: "bass-a",
      engineVersion: "1.0.0",
      renderBlobId: "blob-1",
    })
    session.upsertBlob({
      blobReferenceId: "blob-1",
      purpose: "render",
      label: "Bass render",
    })

    await runDueTimers(clock, timer)

    expect(session.getSnapshot().saveState).toBe("error")
    expect(session.getSnapshot().dirty).toBe(true)
    expect(putCount).toBe(1)

    // Rapid edits while offline coalesce into the same retry.
    session.setBassRenderBlobId("blob-2")
    session.upsertBlob({
      blobReferenceId: "blob-2",
      purpose: "render",
      label: "Bass render 2",
    })

    await runDueTimers(clock, timer)

    const puts = calls.filter((call) => call.method === "PUT")
    expect(puts).toHaveLength(2)
    expect(asSaveBody(puts[0]?.body ?? null).expectedRevisionId).toBe("rev-1")
    expect(asSaveBody(puts[1]?.body ?? null).expectedRevisionId).toBe("rev-1")
    expect(asSaveBody(puts[1]?.body ?? null).expectedVersion).toBe(1)
    expect(asSaveBody(puts[1]?.body ?? null).document.bass?.renderBlobId).toBe("blob-2")
    expect(session.getSnapshot().version).toBe(2)
    expect(session.getSnapshot().dirty).toBe(false)
  })

  it("deletes and exports the open project", async () => {
    const { session } = createHarness({
      fetchImpl: (call) => {
        if (call.method === "GET" && call.url.endsWith("/proj-1")) {
          return jsonResponse(200, { project: detail() })
        }
        if (call.method === "GET" && call.url.endsWith("/export")) {
          return jsonResponse(200, {
            exportedAt: "2026-07-18T12:00:00.000Z",
            project: { id: "proj-1", title: "Song" },
            revisions: [{ id: "rev-1", version: 1 }],
            blobReferences: [],
          })
        }
        if (call.method === "DELETE") {
          return jsonResponse(200, { ok: true })
        }
        if (call.method === "GET" && call.url.endsWith("/api/projects")) {
          return jsonResponse(200, { projects: [] })
        }
        throw new Error(`unexpected ${call.method} ${call.url}`)
      },
    })

    await session.open("proj-1")
    const exported = await session.exportProject()
    expect(exported.revisions).toHaveLength(1)

    await session.delete()
    expect(session.getSnapshot().projectId).toBeNull()
    expect(session.getSnapshot().phase).toBe("idle")
  })

  it("marks migrated documents dirty so schema upgrades can autosave", async () => {
    const { session, clock, timer, calls } = createHarness({
      fetchImpl: (call) => {
        if (call.method === "GET") {
          return jsonResponse(200, {
            project: {
              ...detail({ title: "Legacy" }),
              document: {
                version: 0,
                title: "Legacy",
                tempo: 110,
                key: "G",
                sections: [],
              },
            },
          })
        }
        if (call.method === "PUT") {
          const saved = asSaveBody(call.body)
          return jsonResponse(200, {
            project: detail({
              revisionId: "rev-2",
              version: 2,
              document: saved.document,
              title: "Legacy",
            }),
          })
        }
        throw new Error(`unexpected ${call.method}`)
      },
    })

    await session.open("proj-1")
    expect(session.getSnapshot().migrationApplied).toBe(true)
    expect(session.getSnapshot().dirty).toBe(true)
    expect(session.getSnapshot().document?.schemaVersion).toBe(1)

    await runDueTimers(clock, timer)

    expect(calls.some((call) => call.method === "PUT")).toBe(true)
    expect(session.getSnapshot().dirty).toBe(false)
  })

  it("surfaces malformed API responses without corrupting session state", async () => {
    const { session } = createHarness({
      fetchImpl: () => jsonResponse(200, { unexpected: true }),
    })

    await expect(session.list()).rejects.toMatchObject({ code: "malformed" })
    expect(session.getSnapshot().projects).toEqual([])
  })

  it("warns on navigation while dirty and clears after save", async () => {
    const { session, clock, timer } = createHarness({
      fetchImpl: (call) => {
        if (call.method === "GET") {
          return jsonResponse(200, { project: detail() })
        }
        if (call.method === "PUT") {
          const saved = asSaveBody(call.body)
          return jsonResponse(200, {
            project: detail({
              revisionId: "rev-2",
              version: 2,
              document: saved.document,
              title: saved.document.song.title,
            }),
          })
        }
        throw new Error(`unexpected ${call.method}`)
      },
    })

    await session.open("proj-1")
    expect(session.shouldWarnOnNavigate()).toBe(false)
    session.updateTitle("Dirty")
    expect(session.shouldWarnOnNavigate()).toBe(true)
    expect(session.getNavigationGuard().shouldWarn()).toBe(true)

    await runDueTimers(clock, timer)

    expect(session.shouldWarnOnNavigate()).toBe(false)
    expect(session.close()).toBe(true)
  })

  it("supports recipe and blob reference editing helpers on the session", async () => {
    const { session } = createHarness({
      fetchImpl: (call) => {
        if (call.method === "GET") {
          return jsonResponse(200, { project: detail() })
        }
        throw new Error(`unexpected ${call.method}`)
      },
    })

    await session.open("proj-1")
    session.setDrums({
      sourceId: "drums-1",
      engineVersion: "2.0.0",
      tempo: 120,
    })
    session.setDrumsRenderBlobId("drum-blob")
    session.setBlobs([
      { blobReferenceId: "drum-blob", purpose: "render", label: "Drums" },
    ])
    session.removeBlob("drum-blob")
    session.upsertBlob({ blobReferenceId: "keep", purpose: "upload" })

    const document = session.getSnapshot().document
    expect(document?.drums?.renderBlobId).toBe("drum-blob")
    expect(document?.blobs).toEqual([{ blobReferenceId: "keep", purpose: "upload" }])
  })
})
