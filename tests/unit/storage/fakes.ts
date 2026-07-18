import { StorageError } from "@/lib/storage/errors"
import type {
  BlobPurpose,
  BlobReferenceRecord,
  BlobReferenceStore,
  BlobStorePort,
  PresignPrivateGetInput,
  PutPrivateBlobInput,
} from "@/lib/storage/types"

export function createMemoryBlobStore(options?: {
  privateDeliveryAvailable?: boolean
}): BlobStorePort & {
  objects: Map<string, { body: Uint8Array; contentType: string }>
  issued: Array<{ pathname: string; validUntil: number; presignedUrl: string }>
} {
  const objects = new Map<string, { body: Uint8Array; contentType: string }>()
  const issued: Array<{ pathname: string; validUntil: number; presignedUrl: string }> = []
  const privateDeliveryAvailable = options?.privateDeliveryAvailable ?? true

  return {
    objects,
    issued,
    async putPrivateImmutable(input: PutPrivateBlobInput) {
      if (!privateDeliveryAvailable) {
        throw new StorageError("misconfigured", "Private Blob delivery is unavailable.")
      }
      if (objects.has(input.pathname)) {
        throw new StorageError("conflict", "Immutable blob key already exists.")
      }
      objects.set(input.pathname, {
        body: input.body,
        contentType: input.contentType,
      })
      return {
        pathname: input.pathname,
        url: `https://blob.example/private/${input.pathname}`,
        contentType: input.contentType,
      }
    },
    async deleteByPathname(pathname: string) {
      objects.delete(pathname)
    },
    async deleteManyByPathname(pathnames: string[]) {
      for (const pathname of pathnames) {
        objects.delete(pathname)
      }
    },
    async presignPrivateGet(input: PresignPrivateGetInput) {
      if (!privateDeliveryAvailable) {
        throw new StorageError("misconfigured", "Private Blob delivery is unavailable.")
      }
      // Expiry is enforced by the storage service clock; this port only mints URLs.
      const presignedUrl = `https://blob.example/private/${input.pathname}?sig=test&exp=${input.validUntil}`
      issued.push({ pathname: input.pathname, validUntil: input.validUntil, presignedUrl })
      return {
        presignedUrl,
        expiresAt: new Date(input.validUntil),
      }
    },
  }
}

export function createMemoryReferenceStore(): BlobReferenceStore & {
  rows: Map<string, BlobReferenceRecord>
} {
  const rows = new Map<string, BlobReferenceRecord>()

  return {
    rows,
    async findById(id) {
      return rows.get(id) ?? null
    },
    async findByStorageKey(storageKey) {
      for (const row of rows.values()) {
        if (row.storageKey === storageKey) {
          return row
        }
      }
      return null
    },
    async findByUserAndChecksum(userId, checksumSha256, purpose: BlobPurpose) {
      for (const row of rows.values()) {
        if (
          row.userId === userId &&
          row.checksumSha256 === checksumSha256 &&
          row.purpose === purpose
        ) {
          return row
        }
      }
      return null
    },
    async findByChecksumAndPurpose(checksumSha256, purpose) {
      for (const row of rows.values()) {
        if (row.checksumSha256 === checksumSha256 && row.purpose === purpose) {
          return row
        }
      }
      return null
    },
    async listByUserId(userId) {
      return [...rows.values()].filter((row) => row.userId === userId)
    },
    async insert(record) {
      const row: BlobReferenceRecord = {
        ...record,
        createdAt: record.createdAt ?? new Date(),
      }
      if ([...rows.values()].some((existing) => existing.storageKey === row.storageKey)) {
        throw new StorageError("conflict", "storage_key already exists")
      }
      rows.set(row.id, row)
      return row
    },
    async deleteById(id) {
      rows.delete(id)
    },
    async deleteByUserId(userId) {
      let count = 0
      for (const [id, row] of rows) {
        if (row.userId === userId) {
          rows.delete(id)
          count += 1
        }
      }
      return count
    },
  }
}
