export {
  STORAGE_ENV_VAR_NAMES,
  assertPrivateBlobDeliveryAvailable,
  readBlobRuntimeConfig,
} from "@/lib/storage/config"
export { StorageError, isStorageError } from "@/lib/storage/errors"
export { createStorageService } from "@/lib/storage/service"
export {
  createFactoryAssetCatalogWriter,
  type FactoryAssetCatalogWriter,
  type FactoryAssetWriteInput,
  type FactoryAssetWriteResult,
  type FactoryBlobWriterPort,
} from "@/lib/storage/factory-writer"
export { createVercelBlobStore } from "@/lib/storage/vercel-blob"
export { createDrizzleBlobReferenceStore } from "@/lib/storage/repository"
export { buildAttachmentContentDisposition } from "@/lib/storage/content-disposition"
export { verifyChecksumSha256, sha256Hex } from "@/lib/storage/checksum"
export {
  assertCanAccessBlobReference,
  assertAuthorizationNotExpired,
  assertServiceIsPurchasable,
} from "@/lib/storage/authorize"
export { buildStorageKey, parseFactoryServiceKey } from "@/lib/storage/keys"
export { MAX_ASSET_BYTES, SHORT_LIVED_READ_TTL_MS } from "@/lib/storage/constants"
export { listStorageEnvVarNames } from "@/lib/storage/env-names"

export type {
  AuthorizedDownload,
  BlobPurpose,
  BlobReferenceRecord,
  BlobReferenceStore,
  BlobStorePort,
  UploadAssetInput,
  UploadAssetResult,
} from "@/lib/storage/types"
