import { createHash } from "node:crypto"
import { describe, expect, it } from "vitest"
import { AuthorizationError } from "@/lib/auth/owner"
import type { ServiceKey } from "@/lib/services/catalog"
import {
  assertAuthorizationNotExpired,
  assertPrivateBlobDeliveryAvailable,
  buildAttachmentContentDisposition,
  createFactoryAssetCatalogWriter,
  createStorageService,
  MAX_ASSET_BYTES,
  StorageError,
} from "@/lib/storage"
import { readBlobRuntimeConfig } from "@/lib/storage/config"
import { createMemoryBlobStore, createMemoryReferenceStore } from "./fakes"

function sha256(body: Uint8Array): string {
  return createHash("sha256").update(body).digest("hex")
}

function midiBody(seed = "note"): Uint8Array {
  return new TextEncoder().encode(`MThd-midi-fixture-${seed}`)
}

function createService(options?: {
  entitlements?: ServiceKey[]
  projectOwnerId?: string
  now?: Date
  privateDeliveryAvailable?: boolean
  readTtlMs?: number
}) {
  const entitlements = new Set<ServiceKey>(options?.entitlements ?? ["bass-drums"])
  const blobs = createMemoryBlobStore({
    privateDeliveryAvailable: options?.privateDeliveryAvailable,
  })
  const references = createMemoryReferenceStore()
  const current = { value: options?.now ?? new Date("2026-07-18T10:00:00.000Z") }

  const service = createStorageService({
    blobs,
    references,
    now: () => current.value,
    readTtlMs: options?.readTtlMs ?? 60_000,
    createId: () => `blob-${references.rows.size + 1}`,
    auth: {
      requireSessionUserId: async () => "user-a",
      requireProjectOwner: async (userId, projectId) => {
        if (options?.projectOwnerId && options.projectOwnerId !== userId) {
          throw new AuthorizationError("forbidden", "You do not own this project.")
        }
        if (projectId === "missing") {
          throw new AuthorizationError("not_found", "Project was not found.")
        }
        return userId
      },
      userHasEntitlement: async (_userId, serviceKey) => entitlements.has(serviceKey),
    },
  })

  return { service, blobs, references, current, entitlements }
}

describe("storage service", () => {
  it("uploads an immutable private user MIDI asset with checksum verification", async () => {
    const { service, blobs, references } = createService()
    const body = midiBody("a")
    const checksumSha256 = sha256(body)

    const result = await service.uploadAsset({
      userId: "user-a",
      purpose: "upload",
      filename: "groove.mid",
      contentType: "audio/midi",
      body,
      checksumSha256,
    })

    expect(result.deduplicated).toBe(false)
    expect(result.reference.checksumSha256).toBe(checksumSha256)
    expect(result.reference.storageKey).toBe(`users/user-a/uploads/${checksumSha256}.mid`)
    expect(blobs.objects.has(result.reference.storageKey)).toBe(true)
    expect(references.rows.size).toBe(1)
  })

  it("deduplicates by checksum for the same user", async () => {
    const { service } = createService()
    const body = midiBody("same")
    const checksumSha256 = sha256(body)
    const first = await service.uploadAsset({
      userId: "user-a",
      purpose: "upload",
      filename: "a.mid",
      contentType: "audio/midi",
      body,
      checksumSha256,
    })
    const second = await service.uploadAsset({
      userId: "user-a",
      purpose: "upload",
      filename: "b.mid",
      contentType: "audio/midi",
      body,
      checksumSha256,
    })
    expect(second.deduplicated).toBe(true)
    expect(second.reference.id).toBe(first.reference.id)
  })

  it("denies cross-user download of project assets", async () => {
    const { service, references } = createService()
    const body = midiBody("owned")
    const uploaded = await service.uploadAsset({
      userId: "user-a",
      purpose: "upload",
      filename: "owned.mid",
      contentType: "audio/midi",
      body,
      checksumSha256: sha256(body),
    })

    // Simulate another user's reference ownership already in DB.
    const foreign = {
      ...uploaded.reference,
      id: "blob-foreign",
      userId: "user-b",
      storageKey: `users/user-b/uploads/${uploaded.reference.checksumSha256}.mid`,
    }
    references.rows.set(foreign.id, foreign)

    await expect(service.authorizeDownload("user-a", foreign.id)).rejects.toMatchObject({
      code: "forbidden",
    })
  })

  it("denies factory writes by non-entitled authenticated users", async () => {
    const { service } = createService({ entitlements: [] })
    const body = midiBody("factory")
    await expect(
      service.uploadAsset({
        userId: "user-a",
        purpose: "factory",
        filename: "clip.mid",
        contentType: "audio/midi",
        body,
        checksumSha256: sha256(body),
        serviceKey: "bass-drums",
      }),
    ).rejects.toMatchObject({ code: "forbidden" })
  })

  it("denies factory writes by entitled authenticated users", async () => {
    const { service } = createService({ entitlements: ["bass-drums"] })
    const body = midiBody("entitled-factory")
    await expect(
      service.uploadAsset({
        userId: "user-a",
        purpose: "factory",
        filename: "factory.mid",
        contentType: "audio/midi",
        body,
        checksumSha256: sha256(body),
        serviceKey: "bass-drums",
      }),
    ).rejects.toMatchObject({
      code: "forbidden",
      message: expect.stringContaining("user storage service"),
    })
  })

  it("rejects a tampered checksum", async () => {
    const { service } = createService()
    const body = midiBody("tamper")
    await expect(
      service.uploadAsset({
        userId: "user-a",
        purpose: "upload",
        filename: "tamper.mid",
        contentType: "audio/midi",
        body,
        checksumSha256: "a".repeat(64),
      }),
    ).rejects.toMatchObject({ code: "checksum_mismatch" })
  })

  it("rejects oversized and wrong-type uploads", async () => {
    const { service } = createService()
    const oversized = new Uint8Array(MAX_ASSET_BYTES + 1)
    await expect(
      service.uploadAsset({
        userId: "user-a",
        purpose: "upload",
        filename: "big.mid",
        contentType: "audio/midi",
        body: oversized,
        checksumSha256: sha256(oversized),
      }),
    ).rejects.toMatchObject({ code: "validation" })

    const body = midiBody("type")
    await expect(
      service.uploadAsset({
        userId: "user-a",
        purpose: "upload",
        filename: "notes.exe",
        contentType: "application/octet-stream",
        body,
        checksumSha256: sha256(body),
      }),
    ).rejects.toMatchObject({ code: "validation" })
  })

  it("rejects immutable key collisions with a different checksum", async () => {
    const { service, references } = createService()
    const body = midiBody("collision")
    const checksumSha256 = sha256(body)
    const storageKey = `users/user-a/uploads/${checksumSha256}.mid`
    references.rows.set("existing", {
      id: "existing",
      userId: "user-a",
      projectId: null,
      storageKey,
      contentType: "audio/midi",
      byteSize: 4,
      checksumSha256: "b".repeat(64),
      purpose: "upload",
      createdAt: new Date(),
    })

    await expect(
      service.uploadAsset({
        userId: "user-a",
        purpose: "upload",
        filename: "collision.mid",
        contentType: "audio/midi",
        body,
        checksumSha256,
      }),
    ).rejects.toMatchObject({ code: "conflict" })
  })

  it("rejects expired download authorization", async () => {
    const body = midiBody("exp")
    const checksumSha256 = sha256(body)
    const refs = createMemoryReferenceStore()
    refs.rows.set("blob-exp", {
      id: "blob-exp",
      userId: "user-a",
      projectId: null,
      storageKey: `users/user-a/uploads/${checksumSha256}.mid`,
      contentType: "audio/midi",
      byteSize: body.byteLength,
      checksumSha256,
      purpose: "upload",
      createdAt: new Date("2026-07-18T10:00:00.000Z"),
    })

    expect(() =>
      assertAuthorizationNotExpired(
        new Date("2026-07-18T10:00:01.000Z"),
        new Date("2026-07-18T12:00:00.000Z"),
      ),
    ).toThrow(StorageError)

    const serviceExpired = createStorageService({
      blobs: createMemoryBlobStore(),
      references: refs,
      now: () => new Date("2026-07-18T12:00:00.000Z"),
      readTtlMs: -5_000,
      auth: {
        requireSessionUserId: async () => "user-a",
        requireProjectOwner: async (userId) => userId,
        userHasEntitlement: async () => true,
      },
    })
    await expect(serviceExpired.authorizeDownload("user-a", "blob-exp")).rejects.toMatchObject({
      code: "expired",
    })
  })

  it("allows A11 catalog writes only through the distinct injected writer", async () => {
    const blobs = createMemoryBlobStore()
    const references = createMemoryReferenceStore()
    const writer = createFactoryAssetCatalogWriter(blobs)
    const body = midiBody("catalog-writer")
    const checksumSha256 = sha256(body)

    const written = await writer.writeFactoryAsset({
      serviceKey: "bass-drums",
      filename: "factory.mid",
      contentType: "audio/midi",
      body,
      checksumSha256,
    })

    expect(written.storageKey).toBe(`factory/bass-drums/${checksumSha256}.mid`)
    expect(blobs.objects.has(written.storageKey)).toBe(true)
    expect(references.rows.size).toBe(0)
  })

  it("deletes owned assets and cleans up an account", async () => {
    const { service, blobs, references } = createService()
    const body = midiBody("cleanup")
    const uploaded = await service.uploadAsset({
      userId: "user-a",
      purpose: "upload",
      filename: "cleanup.mid",
      contentType: "audio/midi",
      body,
      checksumSha256: sha256(body),
    })

    await service.deleteAsset("user-b", uploaded.reference.id).then(
      () => {
        throw new Error("expected forbidden")
      },
      (error) => {
        expect(error).toMatchObject({ code: "forbidden" })
      },
    )

    await service.deleteAsset("user-a", uploaded.reference.id)
    expect(references.rows.has(uploaded.reference.id)).toBe(false)
    expect(blobs.objects.size).toBe(0)

    const again = await service.uploadAsset({
      userId: "user-a",
      purpose: "upload",
      filename: "cleanup2.mid",
      contentType: "audio/midi",
      body: midiBody("cleanup2"),
      checksumSha256: sha256(midiBody("cleanup2")),
    })
    const factoryBody = midiBody("factory-preserved")
    const factoryChecksum = sha256(factoryBody)
    const factoryKey = `factory/bass-drums/${factoryChecksum}.mid`
    blobs.objects.set(factoryKey, { body: factoryBody, contentType: "audio/midi" })
    references.rows.set("factory-preserved", {
      id: "factory-preserved",
      // Even a legacy/importer row associated with this account must survive user cleanup.
      userId: "user-a",
      projectId: null,
      storageKey: factoryKey,
      contentType: "audio/midi",
      byteSize: factoryBody.byteLength,
      checksumSha256: factoryChecksum,
      purpose: "factory",
      createdAt: new Date(),
    })

    const cleaned = await service.cleanupAccountAssets("user-a")
    expect(cleaned.deleted).toBe(1)
    expect(references.rows.has(again.reference.id)).toBe(false)
    expect(references.rows.has("factory-preserved")).toBe(true)
    expect(blobs.objects.has(factoryKey)).toBe(true)
  })

  it("prevents content-disposition injection and path traversal filenames", () => {
    expect(() => buildAttachmentContentDisposition('evil"\r\nLocation: x')).toThrow(StorageError)
    expect(() => buildAttachmentContentDisposition("../secret.mid")).toThrow(StorageError)
  })

  it("fails closed when private Blob delivery is unavailable", () => {
    expect(() =>
      assertPrivateBlobDeliveryAvailable({ hasReadWriteToken: false, hasBlobStoreId: false }),
    ).toThrow(StorageError)

    const config = readBlobRuntimeConfig({
      BLOB_READ_WRITE_TOKEN: undefined,
      BLOB_STORE_ID: undefined,
    })
    expect(config.hasReadWriteToken).toBe(false)
    expect(config.hasBlobStoreId).toBe(false)
  })

  it("allows entitled factory download and still denies missing entitlement on read", async () => {
    const refs = createMemoryReferenceStore()
    const blobs = createMemoryBlobStore()
    const body = midiBody("factory-read")
    const checksumSha256 = sha256(body)
    const storageKey = `factory/bass-drums/${checksumSha256}.mid`
    blobs.objects.set(storageKey, { body, contentType: "audio/midi" })
    refs.rows.set("factory-1", {
      id: "factory-1",
      userId: "importer",
      projectId: null,
      storageKey,
      contentType: "audio/midi",
      byteSize: body.byteLength,
      checksumSha256,
      purpose: "factory",
      createdAt: new Date(),
    })

    const denied = createStorageService({
      blobs,
      references: refs,
      auth: {
        requireSessionUserId: async () => "user-a",
        requireProjectOwner: async (userId) => userId,
        userHasEntitlement: async () => false,
      },
    })
    await expect(denied.authorizeDownload("user-a", "factory-1")).rejects.toMatchObject({
      code: "forbidden",
    })
  })
})
