import type { ServiceKey } from "@/lib/services/catalog"
import { verifyChecksumSha256 } from "@/lib/storage/checksum"
import { buildStorageKey } from "@/lib/storage/keys"
import type { BlobStorePort } from "@/lib/storage/types"
import {
  assertAllowedByteSize,
  resolveAssetKind,
  sanitizeFilename,
} from "@/lib/storage/validation"

export type FactoryBlobWriterPort = Pick<BlobStorePort, "putPrivateImmutable">

export type FactoryAssetWriteInput = {
  serviceKey: ServiceKey
  filename: string
  contentType: string
  body: Uint8Array
  checksumSha256: string
}

export type FactoryAssetWriteResult = {
  storageKey: string
  contentType: string
  byteSize: number
  checksumSha256: string
}

/**
 * Separate A11 catalog/admin boundary for immutable factory Blob writes.
 *
 * It deliberately has no authenticated user id and no BlobReferenceStore:
 * factory catalog persistence belongs to the catalog importer, never to
 * user-owned blob_references or POST /api/assets.
 */
export function createFactoryAssetCatalogWriter(blobs: FactoryBlobWriterPort) {
  return {
    async writeFactoryAsset(input: FactoryAssetWriteInput): Promise<FactoryAssetWriteResult> {
      const filename = sanitizeFilename(input.filename)
      const assetKind = resolveAssetKind(filename, input.contentType)
      assertAllowedByteSize(input.body.byteLength)
      const checksumSha256 = verifyChecksumSha256(input.body, input.checksumSha256)
      const storageKey = buildStorageKey({
        kind: "factory",
        serviceKey: input.serviceKey,
        checksumSha256,
        assetKind,
      })
      const contentType = input.contentType.trim().toLowerCase()

      await blobs.putPrivateImmutable({
        pathname: storageKey,
        body: input.body,
        contentType,
      })

      return {
        storageKey,
        contentType,
        byteSize: input.body.byteLength,
        checksumSha256,
      }
    },
  }
}

export type FactoryAssetCatalogWriter = ReturnType<typeof createFactoryAssetCatalogWriter>
