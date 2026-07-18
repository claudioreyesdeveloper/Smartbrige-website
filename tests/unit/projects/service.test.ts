import { describe, expect, it } from "vitest"
import {
  MemoryProjectStore,
  ProjectError,
  ProjectService,
  createEmptyProjectDocument,
} from "@/lib/projects"

function createService(options?: {
  ids?: string[]
  now?: Date
  store?: MemoryProjectStore
}) {
  const ids = [...(options?.ids ?? [])]
  const store = options?.store ?? new MemoryProjectStore()
  const fixedNow = options?.now ?? new Date("2026-07-18T10:00:00.000Z")
  let idSeq = 0
  let nowSeq = 0
  const service = new ProjectService(
    store,
    () => {
      if (ids.length > 0) return ids.shift() as string
      idSeq += 1
      return `id-${idSeq}`
    },
    () => {
      const value = new Date(fixedNow.getTime() + nowSeq * 1000)
      nowSeq += 1
      return value
    },
  )
  return { service, store }
}

describe("ProjectService", () => {
  it("creates, lists, and loads a project for the owner", async () => {
    const { service } = createService({
      ids: ["proj-1", "rev-1"],
    })

    const created = await service.create({
      userId: "user-a",
      title: "My Song",
      document: createEmptyProjectDocument("My Song"),
    })

    expect(created.id).toBe("proj-1")
    expect(created.revisionId).toBe("rev-1")
    expect(created.version).toBe(1)
    expect(created.document.schemaVersion).toBe(1)

    const listed = await service.list("user-a")
    expect(listed).toHaveLength(1)
    expect(listed[0]?.currentVersion).toBe(1)

    const loaded = await service.load("user-a", "proj-1")
    expect(loaded.document.song.title).toBe("My Song")
  })

  it("denies cross-user load, save, delete, and export", async () => {
    const { service } = createService({
      ids: ["proj-1", "rev-1", "rev-2"],
    })
    const created = await service.create({ userId: "owner", title: "Private" })

    await expect(service.load("intruder", created.id)).rejects.toMatchObject({
      code: "forbidden",
    })
    await expect(
      service.save({
        userId: "intruder",
        projectId: created.id,
        document: createEmptyProjectDocument("Hijack"),
        expectedRevisionId: created.revisionId,
        expectedVersion: created.version,
      }),
    ).rejects.toMatchObject({ code: "forbidden" })
    await expect(service.delete("intruder", created.id)).rejects.toMatchObject({
      code: "forbidden",
    })
    await expect(service.exportProject("intruder", created.id)).rejects.toMatchObject({
      code: "forbidden",
    })

    // Owner still has access; intruder never mutated state.
    const stillThere = await service.load("owner", created.id)
    expect(stillThere.title).toBe("Private")
  })

  it("enforces optimistic concurrency on stale saves", async () => {
    const { service } = createService({
      ids: ["proj-1", "rev-1", "rev-2", "rev-3"],
    })
    const created = await service.create({ userId: "user-a", title: "Concurrency" })

    const firstSave = await service.save({
      userId: "user-a",
      projectId: created.id,
      document: {
        schemaVersion: 1,
        song: {
          title: "Concurrency",
          tempo: 100,
          key: "D",
          sections: [],
        },
      },
      expectedRevisionId: created.revisionId,
      expectedVersion: 1,
    })
    expect(firstSave.version).toBe(2)

    await expect(
      service.save({
        userId: "user-a",
        projectId: created.id,
        document: createEmptyProjectDocument("Stale"),
        expectedRevisionId: created.revisionId,
        expectedVersion: 1,
      }),
    ).rejects.toMatchObject({ code: "conflict" })

    const current = await service.load("user-a", created.id)
    expect(current.version).toBe(2)
    expect(current.document.song.key).toBe("D")
  })

  it("migrates older documents on save", async () => {
    const { service } = createService({
      ids: ["proj-1", "rev-1", "rev-2"],
    })
    const created = await service.create({ userId: "user-a", title: "Migrate Me" })

    const saved = await service.save({
      userId: "user-a",
      projectId: created.id,
      document: {
        version: 0,
        title: "Migrated Song",
        tempo: 88,
        key: "F",
        sections: [{ id: "s1", name: "Verse", chords: [{ symbol: "Fmaj7", startBeat: 0 }] }],
        bass: { sourceId: "b1", engineVersion: "0.1.0" },
      },
      expectedRevisionId: created.revisionId,
      expectedVersion: 1,
    })

    expect(saved.document.schemaVersion).toBe(1)
    expect(saved.document.song.title).toBe("Migrated Song")
    expect(saved.document.song.sections[0]?.chords[0]?.symbol).toBe("Fmaj7")
    expect(saved.document.bass?.sourceId).toBe("b1")
  })

  it("rejects malformed and oversized save payloads", async () => {
    const { service } = createService({
      ids: ["proj-1", "rev-1"],
    })
    const created = await service.create({ userId: "user-a", title: "Validation" })

    await expect(
      service.save({
        userId: "user-a",
        projectId: created.id,
        document: { schemaVersion: 1, song: { title: "x", tempo: 120, key: "C" } },
        expectedRevisionId: created.revisionId,
        expectedVersion: 1,
      }),
    ).rejects.toBeInstanceOf(ProjectError)

    await expect(
      service.save({
        userId: "user-a",
        projectId: created.id,
        document: {
          schemaVersion: 1,
          song: {
            title: "A".repeat(600_000),
            tempo: 120,
            key: "C",
            sections: [],
          },
        },
        expectedRevisionId: created.revisionId,
        expectedVersion: 1,
      }),
    ).rejects.toMatchObject({ code: "payload_too_large" })
  })

  it("exports a single project and an account payload", async () => {
    const store = new MemoryProjectStore()
    const { service } = createService({
      store,
      ids: ["proj-1", "rev-1", "proj-2", "rev-2", "rev-3"],
    })

    const first = await service.create({ userId: "user-a", title: "One" })
    const second = await service.create({ userId: "user-a", title: "Two" })
    await service.save({
      userId: "user-a",
      projectId: second.id,
      document: createEmptyProjectDocument("Two Updated"),
      expectedRevisionId: second.revisionId,
      expectedVersion: 1,
    })

    store.seedBlob({
      id: "blob-1",
      userId: "user-a",
      projectId: first.id,
      storageKey: "users/user-a/proj-1/a.mid",
      contentType: "audio/midi",
      byteSize: 128,
      checksumSha256: "abc",
      purpose: "render",
      createdAt: new Date("2026-07-18T09:00:00.000Z"),
    })
    store.seedBlob({
      id: "blob-orphan",
      userId: "user-a",
      projectId: null,
      storageKey: "users/user-a/orphan.mid",
      contentType: "audio/midi",
      byteSize: 64,
      checksumSha256: "def",
      purpose: "upload",
      createdAt: new Date("2026-07-18T09:30:00.000Z"),
    })

    const projectExport = await service.exportProject("user-a", first.id)
    expect(projectExport.project.id).toBe(first.id)
    expect(projectExport.revisions).toHaveLength(1)
    expect(projectExport.blobReferences.map((blob) => blob.id)).toEqual(["blob-1"])

    const account = await service.exportAccount("user-a")
    expect(account.userId).toBe("user-a")
    expect(account.projects).toHaveLength(2)
    expect(account.projects.find((entry) => entry.project.id === second.id)?.revisions).toHaveLength(
      2,
    )
    expect(account.orphanBlobReferences.map((blob) => blob.id)).toEqual(["blob-orphan"])
  })

  it("soft-deletes safely and preserves immutable revision history in the store", async () => {
    const store = new MemoryProjectStore()
    const { service } = createService({
      store,
      ids: ["proj-1", "rev-1", "rev-2"],
    })

    const created = await service.create({ userId: "user-a", title: "Delete Me" })
    await service.save({
      userId: "user-a",
      projectId: created.id,
      document: createEmptyProjectDocument("Delete Me v2"),
      expectedRevisionId: created.revisionId,
      expectedVersion: 1,
    })

    store.seedBlob({
      id: "blob-1",
      userId: "user-a",
      projectId: created.id,
      storageKey: "users/user-a/delete-me.mid",
      contentType: "audio/midi",
      byteSize: 10,
      checksumSha256: "aa",
      purpose: "render",
      createdAt: new Date(),
    })

    await service.delete("user-a", created.id)

    await expect(service.load("user-a", created.id)).rejects.toMatchObject({ code: "not_found" })
    expect(await service.list("user-a")).toEqual([])

    const projectRow = await store.getProject(created.id)
    expect(projectRow?.deletedAt).not.toBeNull()

    const revisions = await store.listRevisionsForProject(created.id)
    expect(revisions).toHaveLength(2)
    expect(revisions.map((revision) => revision.version)).toEqual([1, 2])

    const blobs = await store.listBlobReferencesForUser("user-a")
    expect(blobs[0]?.projectId).toBeNull()
  })

  it("requires authentication", async () => {
    const { service } = createService()
    await expect(service.list(null)).rejects.toMatchObject({ code: "unauthenticated" })
    await expect(service.create({ userId: undefined as unknown as string })).rejects.toMatchObject({
      code: "unauthenticated",
    })
  })

  it("keeps revision documents immutable across saves", async () => {
    const store = new MemoryProjectStore()
    const { service } = createService({
      store,
      ids: ["proj-1", "rev-1", "rev-2"],
    })
    const created = await service.create({
      userId: "user-a",
      document: {
        schemaVersion: 1,
        song: { title: "Immutable", tempo: 120, key: "C", sections: [] },
      },
    })

    await service.save({
      userId: "user-a",
      projectId: created.id,
      document: {
        schemaVersion: 1,
        song: { title: "Immutable", tempo: 140, key: "C", sections: [] },
      },
      expectedRevisionId: created.revisionId,
      expectedVersion: 1,
    })

    const first = await store.getRevision(created.revisionId)
    expect(first?.document.song.tempo).toBe(120)
    const second = await store.getLatestRevision(created.id)
    expect(second?.document.song.tempo).toBe(140)
    expect(second?.id).not.toBe(created.revisionId)
  })
})
