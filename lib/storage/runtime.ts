import { requireSessionUserId } from "@/lib/auth"
import { requireProjectOwner, userHasEntitlement } from "@/lib/auth/entitlements"
import { createDrizzleBlobReferenceStore } from "@/lib/storage/repository"
import { createStorageService, type StorageService } from "@/lib/storage/service"
import { createVercelBlobStore } from "@/lib/storage/vercel-blob"

let defaultService: StorageService | undefined

/** Server runtime wiring (Auth.js + Drizzle + Vercel Blob). */
export function getStorageService(): StorageService {
  if (!defaultService) {
    defaultService = createStorageService({
      blobs: createVercelBlobStore(),
      references: createDrizzleBlobReferenceStore(),
      auth: {
        requireSessionUserId,
        requireProjectOwner,
        userHasEntitlement,
      },
    })
  }
  return defaultService
}

export function resetStorageServiceForTests(): void {
  defaultService = undefined
}
