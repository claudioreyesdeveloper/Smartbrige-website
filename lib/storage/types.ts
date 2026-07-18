import type { ServiceKey } from "@/lib/db/services"

export type BlobPurpose = "render" | "upload" | "factory"

export type AllowedAssetKind = "midi" | "project"

export type BlobReferenceRecord = {
  id: string
  userId: string
  projectId: string | null
  storageKey: string
  contentType: string
  byteSize: number
  checksumSha256: string
  purpose: BlobPurpose
  createdAt: Date
}

export type UploadAssetInput = {
  userId: string
  purpose: BlobPurpose
  filename: string
  contentType: string
  body: Uint8Array
  /** Client-declared SHA-256 hex; verified against the body. */
  checksumSha256: string
  projectId?: string | null
  /** Required when purpose is factory. */
  serviceKey?: ServiceKey
}

export type UploadAssetResult = {
  reference: BlobReferenceRecord
  deduplicated: boolean
}

export type AuthorizedDownload = {
  blobReferenceId: string
  storageKey: string
  contentType: string
  byteSize: number
  filename: string
  contentDisposition: string
  /** Short-lived private GET URL. Never includes the read-write token. */
  presignedUrl: string
  expiresAt: Date
}

export type PutPrivateBlobInput = {
  pathname: string
  body: Uint8Array
  contentType: string
}

export type PutPrivateBlobResult = {
  pathname: string
  url: string
  contentType: string
}

export type PresignPrivateGetInput = {
  pathname: string
  /** Absolute expiry in ms since epoch. */
  validUntil: number
}

export type PresignPrivateGetResult = {
  presignedUrl: string
  expiresAt: Date
}

export type BlobStorePort = {
  putPrivateImmutable: (input: PutPrivateBlobInput) => Promise<PutPrivateBlobResult>
  deleteByPathname: (pathname: string) => Promise<void>
  deleteManyByPathname: (pathnames: string[]) => Promise<void>
  presignPrivateGet: (input: PresignPrivateGetInput) => Promise<PresignPrivateGetResult>
}

export type BlobReferenceStore = {
  findById: (id: string) => Promise<BlobReferenceRecord | null>
  findByStorageKey: (storageKey: string) => Promise<BlobReferenceRecord | null>
  findByUserAndChecksum: (
    userId: string,
    checksumSha256: string,
    purpose: BlobPurpose,
  ) => Promise<BlobReferenceRecord | null>
  findByChecksumAndPurpose: (
    checksumSha256: string,
    purpose: BlobPurpose,
  ) => Promise<BlobReferenceRecord | null>
  listByUserId: (userId: string) => Promise<BlobReferenceRecord[]>
  insert: (
    record: Omit<BlobReferenceRecord, "createdAt"> & { createdAt?: Date },
  ) => Promise<BlobReferenceRecord>
  deleteById: (id: string) => Promise<void>
  deleteByUserId: (userId: string) => Promise<number>
}

export type StorageAuthContext = {
  requireSessionUserId: () => Promise<string>
  requireProjectOwner: (userId: string, projectId: string) => Promise<string>
  userHasEntitlement: (userId: string, serviceKey: ServiceKey) => Promise<boolean>
}
