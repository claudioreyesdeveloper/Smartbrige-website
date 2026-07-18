import { describe, expect, it } from "vitest"
import { createCatalogAssetWriter } from "@/lib/catalog/assets"
import { createMemoryCatalogBundle } from "@/lib/catalog/bundle"
import { CatalogError } from "@/lib/catalog/errors"
import { CatalogImporter } from "@/lib/catalog/import"
import { MemoryCatalogStore } from "@/lib/catalog/memory-store"
import { CatalogService } from "@/lib/catalog/service"
import type { ServiceKey } from "@/lib/services/catalog"
import { createMemoryBlobStore, createMemoryReferenceStore } from "../storage/fakes"
import { buildSection, buildTopManifest, createMinimalFactoryBundle } from "./fixtures"
import {
  A06_FACTORY_CLIP_BYTES,
  A06_FACTORY_SONGS_SECTION,
  A06_FACTORY_SONGS_TOP,
} from "./a06-factory-songs-fixture"

function createImporter(
  bundleOptions?: Parameters<typeof createMinimalFactoryBundle>[0],
  options?: {
    activateOnSuccess?: boolean
    store?: MemoryCatalogStore
  },
) {
  const fixture = createMinimalFactoryBundle(bundleOptions)
  const store = options?.store ?? new MemoryCatalogStore()
  const blobs = createMemoryBlobStore()
  const references = createMemoryReferenceStore()
  const assets = createCatalogAssetWriter({ blobs, references })

  let idSeq = 0
  const importer = new CatalogImporter({
    store,
    assets,
    bundle: createMemoryCatalogBundle(fixture),
    ownerUserId: "catalog-system",
    assertOwnerUserExists: async () => {},
    activateOnSuccess: options?.activateOnSuccess ?? true,
    createId: () => {
      idSeq += 1
      return `id-${idSeq}`
    },
    now: () => new Date("2026-07-18T12:00:00.000Z"),
  })

  return { importer, store, blobs, references, fixture }
}

function parseService(storageKey: string): string | null {
  const match = /^factory\/([^/]+)\//.exec(storageKey)
  return match?.[1] ?? null
}

describe("catalog import + API", () => {
  it("imports a valid A06 bundle idempotently and activates mapped services", async () => {
    const { importer, store, blobs } = createImporter()
    const first = await importer.importBundle()

    expect(first.deduplicated).toBe(false)
    expect(first.version.status).toBe("ready")
    expect(first.importedEntryCount).toBeGreaterThan(0)
    expect(first.activatedServices).toEqual([
      "bass-drums",
      "jam-player",
      "lyrics",
      "solo-phrases",
    ])
    expect(blobs.objects.size).toBeGreaterThan(0)

    const second = await importer.importBundle()
    expect(second.deduplicated).toBe(true)
    expect(second.importedEntryCount).toBe(0)
    expect(store.versions.size).toBe(1)

    const bassEntries = await store.listEntriesForService(first.version.id, "bass-drums")
    expect(bassEntries.map((entry) => entry.stableId)).toEqual(["midi_clip:1"])
    expect(bassEntries[0]?.blobReferenceId).toBeTruthy()
  })

  it("accepts the exact A06 factory_songs nested asset manifest", async () => {
    const store = new MemoryCatalogStore()
    const blobs = createMemoryBlobStore()
    const references = createMemoryReferenceStore()
    let id = 0
    const importer = new CatalogImporter({
      store,
      assets: createCatalogAssetWriter({ blobs, references }),
      bundle: createMemoryCatalogBundle({
        top: A06_FACTORY_SONGS_TOP,
        sections: { factory_songs: A06_FACTORY_SONGS_SECTION },
        assets: {
          "factory_songs/assets/factory_clip_1.mid": A06_FACTORY_CLIP_BYTES,
        },
      }),
      ownerUserId: "catalog-system",
      assertOwnerUserExists: async () => {},
      createId: () => `a06-id-${++id}`,
      now: () => new Date("2026-07-18T12:00:00.000Z"),
    })

    const result = await importer.importBundle()
    expect(result.version.status).toBe("ready")
    expect(result.version.contentTreeSha256).toBe(
      "a725cb8e3658f025a33498c0a48241cfca49becfad51a5a26a751f362e7d9ed9",
    )
    expect([...store.entries.values()].map((entry) => entry.stableId)).toContain(
      "factory_clip:1",
    )
    expect(blobs.objects.size).toBe(1)
  })

  it("rejects tampered nested A06 factory clip bytes", async () => {
    const { importer } = createAuthenticA06Importer(
      Uint8Array.from([...A06_FACTORY_CLIP_BYTES.slice(0, -1), 0x3e]),
    )

    await expect(importer.importBundle()).rejects.toMatchObject({
      code: "checksum_mismatch",
      message: expect.stringContaining("asset sha256 mismatch"),
    })
  })

  it("fails owner preflight before writing versions, blobs, or references", async () => {
    const fixture = createMinimalFactoryBundle()
    const store = new MemoryCatalogStore()
    const blobs = createMemoryBlobStore()
    const references = createMemoryReferenceStore()
    const importer = new CatalogImporter({
      store,
      assets: createCatalogAssetWriter({ blobs, references }),
      bundle: createMemoryCatalogBundle(fixture),
      ownerUserId: "missing-system-user",
      assertOwnerUserExists: async (userId) => {
        throw new CatalogError(
          "unavailable",
          `CATALOG_SYSTEM_USER_ID does not resolve to an existing user: ${userId}`,
        )
      },
    })

    await expect(importer.importBundle()).rejects.toMatchObject({
      code: "unavailable",
      message: expect.stringContaining("does not resolve to an existing user"),
    })
    expect(store.versions.size).toBe(0)
    expect(store.entries.size).toBe(0)
    expect(blobs.objects.size).toBe(0)
    expect(references.rows.size).toBe(0)
  })

  it("rejects tampered asset hashes", async () => {
    const { importer } = createImporter({ tamperAssetHash: true })
    await expect(importer.importBundle()).rejects.toMatchObject({
      code: "checksum_mismatch",
    })
  })

  it("rejects missing assets", async () => {
    const { importer } = createImporter({ omitAssetBytes: true })
    await expect(importer.importBundle()).rejects.toMatchObject({
      code: "validation",
      message: expect.stringContaining("Missing asset bytes"),
    })
  })

  it("rejects path leakage / unsafe asset paths", async () => {
    const { importer } = createImporter({ absoluteAssetPath: true })
    await expect(importer.importBundle()).rejects.toMatchObject({
      code: "validation",
      message: expect.stringMatching(/Unsafe asset path|safe relative/),
    })
  })

  it("rejects prohibited user/jam stable ids", async () => {
    const { importer } = createImporter({ includeJamSong: true })
    await expect(importer.importBundle()).rejects.toMatchObject({
      code: "validation",
      message: expect.stringContaining("Prohibited user/jam"),
    })
  })

  it("resumes after partial failure without duplicating entries", async () => {
    const store = new MemoryCatalogStore()
    const fixture = createMinimalFactoryBundle()
    const blobs = createMemoryBlobStore()
    const references = createMemoryReferenceStore()
    const assets = createCatalogAssetWriter({ blobs, references })

    let idSeq = 0
    let failOnce = true
    const originalInsert = store.insertEntry.bind(store)
    store.insertEntry = async (input) => {
      if (failOnce && input.stableId === "solo_phrase:solo-1") {
        failOnce = false
        throw new CatalogError("unavailable", "simulated partial failure")
      }
      return originalInsert(input)
    }

    const importer = new CatalogImporter({
      store,
      assets,
      bundle: createMemoryCatalogBundle(fixture),
      ownerUserId: "catalog-system",
      assertOwnerUserExists: async () => {},
      activateOnSuccess: true,
      createId: () => {
        idSeq += 1
        return `id-${idSeq}`
      },
      now: () => new Date("2026-07-18T12:00:00.000Z"),
    })

    await expect(importer.importBundle()).rejects.toMatchObject({
      message: "simulated partial failure",
    })

    const failed = [...store.versions.values()][0]
    expect(failed?.status).toBe("failed")
    expect(failed?.importCheckpoint?.completedStableIds.length).toBeGreaterThan(0)

    const resumed = await importer.importBundle()
    expect(resumed.resumed).toBe(true)
    expect(resumed.version.status).toBe("ready")

    const allStableIds = [...store.entries.values()].map((entry) => entry.stableId)
    expect(new Set(allStableIds).size).toBe(allStableIds.length)
  })

  it("supports rollback activation to a previous ready version", async () => {
    const { importer, store } = createImporter(undefined, { activateOnSuccess: true })
    const first = await importer.importBundle()

    // Build a second distinct bundle by mutating browse metadata and recomputing checksums.
    const fixture2 = createMinimalFactoryBundle()
    fixture2.sections.midi_clips.records[0]!.clip = {
      ...(fixture2.sections.midi_clips.records[0]!.clip as object),
      clip_name: "Groove B",
    }
    const sections = Object.values(fixture2.sections).map((section) => {
      if (section.section !== "midi_clips") {
        return section
      }
      return buildSection(section.section, section.records)
    })
    const rebuilt = buildTopManifest(sections)
    fixture2.top = rebuilt.top
    fixture2.sections = Object.fromEntries(sections.map((section) => [section.section, section]))

    let idSeq = 100
    const importer2 = new CatalogImporter({
      store,
      assets: createCatalogAssetWriter({
        blobs: createMemoryBlobStore(),
        references: createMemoryReferenceStore(),
      }),
      bundle: createMemoryCatalogBundle(fixture2),
      ownerUserId: "catalog-system",
      assertOwnerUserExists: async () => {},
      activateOnSuccess: true,
      createId: () => {
        idSeq += 1
        return `id-${idSeq}`
      },
      now: () => new Date("2026-07-18T13:00:00.000Z"),
    })

    const second = await importer2.importBundle()
    expect(second.version.id).not.toBe(first.version.id)

    const activation = await store.getActivation("bass-drums")
    expect(activation?.catalogVersionId).toBe(second.version.id)
    expect(activation?.previousCatalogVersionId).toBe(first.version.id)

    const service = new CatalogService({
      store,
      entitlements: { userHasEntitlement: async () => true },
      downloads: {
        authorizeDownload: async () => {
          throw new Error("unused")
        },
      },
    })

    const rolled = await service.rollback("bass-drums")
    expect(rolled.catalogVersionId).toBe(first.version.id)

    const after = await store.getActivation("bass-drums")
    expect(after?.catalogVersionId).toBe(first.version.id)
  })

  it("denies cross-entitlement catalog reads and asset access", async () => {
    const { importer, store, references } = createImporter()
    await importer.importBundle()

    // Wire download authorizer to the same reference store used during import.
    const entitled = new Set<ServiceKey>(["solo-phrases"])
    const service = new CatalogService({
      store,
      entitlements: {
        userHasEntitlement: async (_userId, serviceKey) => entitled.has(serviceKey),
      },
      downloads: {
        authorizeDownload: async (actorUserId, blobReferenceId) => {
          const ref = references.rows.get(blobReferenceId)
          if (!ref) {
            throw new CatalogError("not_found", "missing")
          }
          const serviceKey = parseService(ref.storageKey)
          if (!serviceKey || !entitled.has(serviceKey as ServiceKey)) {
            throw new CatalogError("forbidden", `Service entitlement required: ${serviceKey}`)
          }
          void actorUserId
          return {
            blobReferenceId: ref.id,
            storageKey: ref.storageKey,
            contentType: ref.contentType,
            byteSize: ref.byteSize,
            filename: "x.mid",
            contentDisposition: 'attachment; filename="x.mid"',
            presignedUrl: `https://blob.example/${ref.storageKey}`,
            expiresAt: new Date("2026-07-18T12:05:00.000Z"),
          }
        },
      },
    })

    await expect(service.listForService("user-a", "bass-drums")).rejects.toMatchObject({
      code: "forbidden",
    })
    await expect(service.listForService("user-a", "solo-phrases")).resolves.toMatchObject({
      serviceKey: "solo-phrases",
    })

    const solo = await service.listForService("user-a", "solo-phrases")
    const soloEntry = solo.entries.find((entry) => entry.hasAsset)
    expect(soloEntry).toBeTruthy()

    await expect(
      service.authorizeAssetAccess("user-a", "bass-drums", "midi_clip:1"),
    ).rejects.toMatchObject({ code: "forbidden" })

    await expect(
      service.authorizeAssetAccess("user-a", "solo-phrases", soloEntry!.stableId),
    ).resolves.toMatchObject({
      blobReferenceId: soloEntry!.blobReferenceId,
    })
  })

  it("fails closed for future and unmapped services", async () => {
    const { importer, store } = createImporter()
    await importer.importBundle()
    const service = new CatalogService({
      store,
      entitlements: { userHasEntitlement: async () => true },
      downloads: {
        authorizeDownload: async () => {
          throw new Error("unused")
        },
      },
    })

    await expect(service.listForService("user-a", "style-maker")).rejects.toMatchObject({
      code: "forbidden",
      message: expect.stringContaining("not available"),
    })
    await expect(service.listForService("user-a", "genos-mixer")).rejects.toMatchObject({
      code: "forbidden",
      message: expect.stringContaining("No factory catalog is mapped"),
    })
  })
})

function createAuthenticA06Importer(nestedAssetBytes: Uint8Array) {
  const store = new MemoryCatalogStore()
  const blobs = createMemoryBlobStore()
  const references = createMemoryReferenceStore()
  let id = 0
  const importer = new CatalogImporter({
    store,
    assets: createCatalogAssetWriter({ blobs, references }),
    bundle: createMemoryCatalogBundle({
      top: A06_FACTORY_SONGS_TOP,
      sections: { factory_songs: A06_FACTORY_SONGS_SECTION },
      assets: {
        "factory_songs/assets/factory_clip_1.mid": nestedAssetBytes,
      },
    }),
    ownerUserId: "catalog-system",
    assertOwnerUserExists: async () => {},
    createId: () => `a06-id-${++id}`,
  })
  return { importer, store, blobs, references }
}
