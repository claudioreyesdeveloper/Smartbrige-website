import {
  BlobError,
  del,
  issueSignedToken,
  presignUrl,
  put,
} from "@vercel/blob"
import { assertPrivateBlobDeliveryAvailable } from "@/lib/storage/config"
import { StorageError } from "@/lib/storage/errors"
import type {
  BlobStorePort,
  PresignPrivateGetInput,
  PresignPrivateGetResult,
  PutPrivateBlobInput,
  PutPrivateBlobResult,
} from "@/lib/storage/types"

function mapBlobError(error: unknown): never {
  if (error instanceof StorageError) {
    throw error
  }
  if (error instanceof BlobError) {
    const message = error.message.toLowerCase()
    if (message.includes("already exists") || message.includes("overwrite")) {
      throw new StorageError("conflict", "Immutable blob key already exists.")
    }
    throw new StorageError("unavailable", `Blob operation failed: ${error.message}`)
  }
  throw error
}

/**
 * Adapter over @vercel/blob using only documented private APIs:
 * put({ access: 'private', allowOverwrite: false }), del, issueSignedToken, presignUrl.
 */
export function createVercelBlobStore(): BlobStorePort {
  return {
    async putPrivateImmutable(input: PutPrivateBlobInput): Promise<PutPrivateBlobResult> {
      assertPrivateBlobDeliveryAvailable()
      try {
        const result = await put(input.pathname, Buffer.from(input.body), {
          access: "private",
          addRandomSuffix: false,
          allowOverwrite: false,
          contentType: input.contentType,
        })
        return {
          pathname: result.pathname,
          url: result.url,
          contentType: result.contentType,
        }
      } catch (error) {
        mapBlobError(error)
      }
    },

    async deleteByPathname(pathname: string): Promise<void> {
      assertPrivateBlobDeliveryAvailable()
      try {
        await del(pathname)
      } catch (error) {
        mapBlobError(error)
      }
    },

    async deleteManyByPathname(pathnames: string[]): Promise<void> {
      if (pathnames.length === 0) {
        return
      }
      assertPrivateBlobDeliveryAvailable()
      try {
        await del(pathnames)
      } catch (error) {
        mapBlobError(error)
      }
    },

    async presignPrivateGet(input: PresignPrivateGetInput): Promise<PresignPrivateGetResult> {
      assertPrivateBlobDeliveryAvailable()
      try {
        const signed = await issueSignedToken({
          pathname: input.pathname,
          operations: ["get"],
          validUntil: input.validUntil,
        })
        const { presignedUrl } = await presignUrl(
          {
            clientSigningToken: signed.clientSigningToken,
            delegationToken: signed.delegationToken,
          },
          {
            access: "private",
            operation: "get",
            pathname: input.pathname,
            validUntil: input.validUntil,
          },
        )
        return {
          presignedUrl,
          expiresAt: new Date(Math.min(signed.validUntil, input.validUntil)),
        }
      } catch (error) {
        mapBlobError(error)
      }
    },
  }
}
