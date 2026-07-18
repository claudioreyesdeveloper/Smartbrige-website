import type { ServiceKey } from "@/lib/db/services"
import { StorageError } from "@/lib/storage/errors"
import type { AllowedAssetKind, BlobPurpose } from "@/lib/storage/types"
import {
  assertSafeStorageKeySegment,
  extensionForKind,
} from "@/lib/storage/validation"
import { isServiceKey } from "@/lib/services/catalog"

export type StorageKeyParts =
  | {
      kind: "user"
      purpose: Exclude<BlobPurpose, "factory">
      userId: string
      projectId: string | null
      checksumSha256: string
      assetKind: AllowedAssetKind
    }
  | {
      kind: "factory"
      serviceKey: ServiceKey
      checksumSha256: string
      assetKind: AllowedAssetKind
    }

export function buildStorageKey(parts: StorageKeyParts): string {
  const checksum = assertSafeStorageKeySegment(parts.checksumSha256, "checksum")
  const ext = extensionForKind(parts.assetKind)

  if (parts.kind === "factory") {
    const serviceKey = assertSafeStorageKeySegment(parts.serviceKey, "serviceKey")
    return `factory/${serviceKey}/${checksum}${ext}`
  }

  const userId = assertSafeStorageKeySegment(parts.userId, "userId")
  if (parts.purpose === "render") {
    if (!parts.projectId) {
      throw new StorageError("validation", "Render assets require a projectId.")
    }
    const projectId = assertSafeStorageKeySegment(parts.projectId, "projectId")
    return `users/${userId}/projects/${projectId}/renders/${checksum}${ext}`
  }

  return `users/${userId}/uploads/${checksum}${ext}`
}

export function parseFactoryServiceKey(storageKey: string): ServiceKey | null {
  const match = /^factory\/([^/]+)\//.exec(storageKey)
  if (!match) {
    return null
  }
  const candidate = match[1]
  return isServiceKey(candidate) ? candidate : null
}

export function assertNoPathTraversal(storageKey: string): string {
  if (
    !storageKey ||
    storageKey.includes("..") ||
    storageKey.startsWith("/") ||
    storageKey.includes("\\") ||
    storageKey.includes("\0")
  ) {
    throw new StorageError("validation", "Invalid storage key.")
  }
  return storageKey
}

export function filenameFromStorageKey(storageKey: string): string {
  const safe = assertNoPathTraversal(storageKey)
  const name = safe.split("/").pop()
  if (!name) {
    throw new StorageError("validation", "Invalid storage key.")
  }
  return name
}
