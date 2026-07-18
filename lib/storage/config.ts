import { StorageError } from "@/lib/storage/errors"

export type BlobRuntimeConfig = {
  /** Classic read-write token available via BLOB_READ_WRITE_TOKEN. */
  hasReadWriteToken: boolean
  /** Store id available for OIDC-scoped private Blob access via BLOB_STORE_ID. */
  hasBlobStoreId: boolean
}

/**
 * Fail closed unless private Blob delivery credentials are available.
 * Env var names only — values are never returned or logged here.
 */
export function readBlobRuntimeConfig(
  env: Partial<NodeJS.ProcessEnv> = process.env,
): BlobRuntimeConfig {
  return {
    hasReadWriteToken: Boolean(env.BLOB_READ_WRITE_TOKEN?.trim()),
    hasBlobStoreId: Boolean(env.BLOB_STORE_ID?.trim()),
  }
}

export function assertPrivateBlobDeliveryAvailable(
  config: BlobRuntimeConfig = readBlobRuntimeConfig(),
): void {
  if (!config.hasReadWriteToken && !config.hasBlobStoreId) {
    throw new StorageError(
      "misconfigured",
      "Private Blob delivery is unavailable. Configure BLOB_READ_WRITE_TOKEN or BLOB_STORE_ID (with Vercel OIDC).",
    )
  }
}

/** Env var names used by storage (values never exposed). */
export const STORAGE_ENV_VAR_NAMES = [
  "BLOB_READ_WRITE_TOKEN",
  "BLOB_STORE_ID",
  "VERCEL_OIDC_TOKEN",
  "DATABASE_URL",
  "AUTH_SECRET",
] as const
