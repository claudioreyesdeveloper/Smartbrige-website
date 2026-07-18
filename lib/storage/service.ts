import { randomUUID } from "node:crypto"
import { SHORT_LIVED_READ_TTL_MS } from "@/lib/storage/constants"
import {
  assertAuthorizationNotExpired,
  assertCanAccessBlobReference,
  assertCanUploadAsset,
} from "@/lib/storage/authorize"
import { verifyChecksumSha256 } from "@/lib/storage/checksum"
import { buildAttachmentContentDisposition } from "@/lib/storage/content-disposition"
import { StorageError } from "@/lib/storage/errors"
import {
  assertNoPathTraversal,
  buildStorageKey,
  filenameFromStorageKey,
} from "@/lib/storage/keys"
import type {
  AuthorizedDownload,
  BlobReferenceStore,
  BlobStorePort,
  StorageAuthContext,
  UploadAssetInput,
  UploadAssetResult,
} from "@/lib/storage/types"
import {
  assertAllowedByteSize,
  assertPurposeAllowsServiceKey,
  resolveAssetKind,
  sanitizeFilename,
} from "@/lib/storage/validation"

export type StorageServiceDeps = {
  blobs: BlobStorePort
  references: BlobReferenceStore
  auth: StorageAuthContext
  now?: () => Date
  createId?: () => string
  readTtlMs?: number
}

export function createStorageService(deps: StorageServiceDeps) {
  const now = deps.now ?? (() => new Date())
  const createId = deps.createId ?? (() => randomUUID())
  const readTtlMs = deps.readTtlMs ?? SHORT_LIVED_READ_TTL_MS

  async function uploadAsset(input: UploadAssetInput): Promise<UploadAssetResult> {
    if (input.purpose === "factory") {
      throw new StorageError(
        "forbidden",
        "Factory assets cannot be written through the user storage service.",
      )
    }
    assertPurposeAllowsServiceKey(input.purpose, input.serviceKey)
    const filename = sanitizeFilename(input.filename)
    const assetKind = resolveAssetKind(filename, input.contentType)
    assertAllowedByteSize(input.body.byteLength)
    const checksumSha256 = verifyChecksumSha256(input.body, input.checksumSha256)

    await assertCanUploadAsset({
      userId: input.userId,
      purpose: input.purpose,
      projectId: input.projectId,
      serviceKey: input.serviceKey,
      requireProjectOwner: deps.auth.requireProjectOwner,
      userHasEntitlement: deps.auth.userHasEntitlement,
    })

    const storageKey = buildStorageKey({
      kind: "user",
      purpose: input.purpose,
      userId: input.userId,
      projectId: input.projectId ?? null,
      checksumSha256,
      assetKind,
    })

    const existingByKey = await deps.references.findByStorageKey(storageKey)
    if (existingByKey) {
      if (existingByKey.checksumSha256 !== checksumSha256) {
        throw new StorageError(
          "conflict",
          "Immutable storage key collision with a different checksum.",
        )
      }
      await assertCanAccessBlobReference(input.userId, existingByKey, deps.auth)
      return { reference: existingByKey, deduplicated: true }
    }

    const existingUser = await deps.references.findByUserAndChecksum(
      input.userId,
      checksumSha256,
      input.purpose,
    )
    if (existingUser) {
      return { reference: existingUser, deduplicated: true }
    }

    try {
      await deps.blobs.putPrivateImmutable({
        pathname: storageKey,
        body: input.body,
        contentType: input.contentType.trim().toLowerCase(),
      })
    } catch (error) {
      if (error instanceof StorageError && error.code === "conflict") {
        const raced = await deps.references.findByStorageKey(storageKey)
        if (raced && raced.checksumSha256 === checksumSha256) {
          return { reference: raced, deduplicated: true }
        }
        throw new StorageError("conflict", "Immutable blob key already exists.")
      }
      throw error
    }

    const reference = await deps.references.insert({
      id: createId(),
      userId: input.userId,
      projectId: input.purpose === "render" ? (input.projectId ?? null) : null,
      storageKey,
      contentType: input.contentType.trim().toLowerCase(),
      byteSize: input.body.byteLength,
      checksumSha256,
      purpose: input.purpose,
      createdAt: now(),
    })

    return { reference, deduplicated: false }
  }

  async function authorizeDownload(
    actorUserId: string,
    blobReferenceId: string,
  ): Promise<AuthorizedDownload> {
    const reference = await deps.references.findById(blobReferenceId)
    if (!reference) {
      throw new StorageError("not_found", "Blob reference was not found.")
    }

    await assertCanAccessBlobReference(actorUserId, reference, deps.auth)

    const storageKey = assertNoPathTraversal(reference.storageKey)
    const expiresAt = new Date(now().getTime() + readTtlMs)
    assertAuthorizationNotExpired(expiresAt, now())

    const { presignedUrl, expiresAt: blobExpiresAt } = await deps.blobs.presignPrivateGet({
      pathname: storageKey,
      validUntil: expiresAt.getTime(),
    })

    const effectiveExpiry =
      blobExpiresAt.getTime() < expiresAt.getTime() ? blobExpiresAt : expiresAt
    assertAuthorizationNotExpired(effectiveExpiry, now())

    const filename = filenameFromStorageKey(storageKey)
    return {
      blobReferenceId: reference.id,
      storageKey,
      contentType: reference.contentType,
      byteSize: reference.byteSize,
      filename,
      contentDisposition: buildAttachmentContentDisposition(filename),
      presignedUrl,
      expiresAt: effectiveExpiry,
    }
  }

  async function deleteAsset(actorUserId: string, blobReferenceId: string): Promise<void> {
    const reference = await deps.references.findById(blobReferenceId)
    if (!reference) {
      throw new StorageError("not_found", "Blob reference was not found.")
    }

    // Deletion is ownership-scoped; factory catalog rows are not user-deletable here.
    if (reference.purpose === "factory") {
      throw new StorageError("forbidden", "Factory assets cannot be deleted through user routes.")
    }
    if (reference.userId !== actorUserId) {
      throw new StorageError("forbidden", "You do not own this blob reference.")
    }

    const storageKey = assertNoPathTraversal(reference.storageKey)
    await deps.blobs.deleteByPathname(storageKey)
    await deps.references.deleteById(reference.id)
  }

  async function cleanupAccountAssets(actorUserId: string): Promise<{ deleted: number }> {
    const refs = await deps.references.listByUserId(actorUserId)
    const userOwned = refs.filter((ref) => ref.purpose !== "factory" && ref.userId === actorUserId)
    const pathnames = userOwned.map((ref) => assertNoPathTraversal(ref.storageKey))
    await deps.blobs.deleteManyByPathname(pathnames)
    // Remove only this user's non-factory rows; factory rows may be shared catalog metadata.
    for (const ref of userOwned) {
      await deps.references.deleteById(ref.id)
    }
    return { deleted: userOwned.length }
  }

  return {
    uploadAsset,
    authorizeDownload,
    deleteAsset,
    cleanupAccountAssets,
  }
}

export type StorageService = ReturnType<typeof createStorageService>
