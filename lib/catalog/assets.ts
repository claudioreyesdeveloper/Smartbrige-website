import type { ServiceKey } from "@/lib/services/catalog"
import { buildStorageKey } from "@/lib/storage/keys"
import { assertAllowedByteSize } from "@/lib/storage/validation"
import type { BlobReferenceRecord, BlobReferenceStore, BlobStorePort } from "@/lib/storage/types"
import { StorageError } from "@/lib/storage/errors"
import { CatalogError } from "@/lib/catalog/errors"

export type CatalogAssetWriter = {
  putFactoryMidi: (input: {
    serviceKey: ServiceKey
    checksumSha256: string
    body: Uint8Array
    ownerUserId: string
    createId: () => string
    now: () => Date
  }) => Promise<BlobReferenceRecord>
}

/**
 * Privileged factory asset writer used by catalog import.
 * Bypasses end-user entitlement checks; authorization is admin-gated upstream.
 */
export function createCatalogAssetWriter(deps: {
  blobs: BlobStorePort
  references: BlobReferenceStore
}): CatalogAssetWriter {
  return {
    async putFactoryMidi(input) {
      assertAllowedByteSize(input.body.byteLength)
      const storageKey = buildStorageKey({
        kind: "factory",
        serviceKey: input.serviceKey,
        checksumSha256: input.checksumSha256,
        assetKind: "midi",
      })

      const existingByKey = await deps.references.findByStorageKey(storageKey)
      if (existingByKey) {
        if (existingByKey.checksumSha256 !== input.checksumSha256) {
          throw new CatalogError(
            "conflict",
            "Immutable factory storage key collision with a different checksum.",
          )
        }
        return existingByKey
      }

      const existingFactory = await deps.references.findByChecksumAndPurpose(
        input.checksumSha256,
        "factory",
      )
      if (existingFactory) {
        return existingFactory
      }

      try {
        await deps.blobs.putPrivateImmutable({
          pathname: storageKey,
          body: input.body,
          contentType: "audio/midi",
        })
      } catch (error) {
        if (error instanceof StorageError && error.code === "conflict") {
          const raced = await deps.references.findByStorageKey(storageKey)
          if (raced && raced.checksumSha256 === input.checksumSha256) {
            return raced
          }
        }
        throw error
      }

      return deps.references.insert({
        id: input.createId(),
        userId: input.ownerUserId,
        projectId: null,
        storageKey,
        contentType: "audio/midi",
        byteSize: input.body.byteLength,
        checksumSha256: input.checksumSha256,
        purpose: "factory",
        createdAt: input.now(),
      })
    },
  }
}
