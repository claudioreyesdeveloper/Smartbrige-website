import { userHasEntitlement } from "@/lib/auth/entitlements"
import { createCatalogAssetWriter } from "@/lib/catalog/assets"
import { createFilesystemCatalogBundle } from "@/lib/catalog/bundle"
import { getCatalogSystemUserId } from "@/lib/catalog/admin"
import { CatalogImporter } from "@/lib/catalog/import"
import { NeonCatalogStore } from "@/lib/catalog/neon-store"
import { CatalogService } from "@/lib/catalog/service"
import type { CatalogStore } from "@/lib/catalog/store"
import { createDrizzleBlobReferenceStore } from "@/lib/storage/repository"
import { getStorageService } from "@/lib/storage/runtime"
import { createVercelBlobStore } from "@/lib/storage/vercel-blob"

let catalogStore: CatalogStore | undefined
let catalogService: CatalogService | undefined

export function getCatalogStore(): CatalogStore {
  if (!catalogStore) {
    catalogStore = new NeonCatalogStore()
  }
  return catalogStore
}

export function getCatalogService(): CatalogService {
  if (!catalogService) {
    const storage = getStorageService()
    catalogService = new CatalogService({
      store: getCatalogStore(),
      entitlements: { userHasEntitlement },
      downloads: {
        authorizeDownload: (actorUserId, blobReferenceId) =>
          storage.authorizeDownload(actorUserId, blobReferenceId),
      },
    })
  }
  return catalogService
}

export function createCatalogImporterForBundlePath(
  bundlePath: string,
  options?: { activateOnSuccess?: boolean },
): CatalogImporter {
  return new CatalogImporter({
    store: getCatalogStore(),
    assets: createCatalogAssetWriter({
      blobs: createVercelBlobStore(),
      references: createDrizzleBlobReferenceStore(),
    }),
    bundle: createFilesystemCatalogBundle(bundlePath),
    ownerUserId: getCatalogSystemUserId(),
    activateOnSuccess: options?.activateOnSuccess ?? true,
  })
}

export function setCatalogServiceForTests(service: CatalogService | undefined): void {
  catalogService = service
}

export function setCatalogStoreForTests(store: CatalogStore | undefined): void {
  catalogStore = store
}

export function resetCatalogRuntimeForTests(): void {
  catalogService = undefined
  catalogStore = undefined
}
