import { AuthorizationError, assertResourceOwner } from "@/lib/auth/owner"
import {
  getSharedServiceCatalogEntry,
  isServiceKey,
  type ServiceKey,
} from "@/lib/services/catalog"
import { StorageError } from "@/lib/storage/errors"
import { parseFactoryServiceKey } from "@/lib/storage/keys"
import type { BlobPurpose, BlobReferenceRecord } from "@/lib/storage/types"

export function mapAuthorizationError(error: unknown): never {
  if (error instanceof AuthorizationError) {
    throw new StorageError(error.code, error.message)
  }
  throw error
}

export function assertServiceIsPurchasable(serviceKey: ServiceKey): void {
  const entry = getSharedServiceCatalogEntry(serviceKey)
  if (entry.availability === "future") {
    throw new StorageError(
      "forbidden",
      `Service is not available for asset access: ${serviceKey}`,
    )
  }
}

export function resolveFactoryServiceKey(storageKey: string): ServiceKey {
  const serviceKey = parseFactoryServiceKey(storageKey)
  if (!serviceKey || !isServiceKey(serviceKey)) {
    throw new StorageError("validation", "Factory storage key is missing a valid service key.")
  }
  return serviceKey
}

export type EntitlementChecker = {
  userHasEntitlement: (userId: string, serviceKey: ServiceKey) => Promise<boolean>
}

/**
 * Factory assets: matching active service entitlement (future services denied).
 * User project/upload/render assets: ownership only.
 */
export async function assertCanAccessBlobReference(
  actorUserId: string,
  reference: BlobReferenceRecord,
  entitlements: EntitlementChecker,
): Promise<void> {
  if (reference.purpose === "factory") {
    const serviceKey = resolveFactoryServiceKey(reference.storageKey)
    assertServiceIsPurchasable(serviceKey)
    const allowed = await entitlements.userHasEntitlement(actorUserId, serviceKey)
    if (!allowed) {
      throw new StorageError("forbidden", `Service entitlement required: ${serviceKey}`)
    }
    return
  }

  try {
    assertResourceOwner(reference.userId, actorUserId, "blob reference")
  } catch (error) {
    mapAuthorizationError(error)
  }
}

export async function assertCanUploadAsset(input: {
  userId: string
  purpose: BlobPurpose
  projectId?: string | null
  serviceKey?: ServiceKey
  requireProjectOwner: (userId: string, projectId: string) => Promise<string>
  userHasEntitlement: (userId: string, serviceKey: ServiceKey) => Promise<boolean>
}): Promise<void> {
  if (input.purpose === "factory") {
    throw new StorageError(
      "forbidden",
      "Factory assets cannot be written through the user storage service.",
    )
  }

  if (input.purpose === "render") {
    if (!input.projectId) {
      throw new StorageError("validation", "Render assets require a projectId.")
    }
    try {
      await input.requireProjectOwner(input.userId, input.projectId)
    } catch (error) {
      mapAuthorizationError(error)
    }
  }
}

export function assertAuthorizationNotExpired(expiresAt: Date, now: Date = new Date()): void {
  if (expiresAt.getTime() <= now.getTime()) {
    throw new StorageError("expired", "Authorized download has expired.")
  }
}
