import {
  ALLOWED_CONTENT_TYPES,
  ALLOWED_EXTENSIONS,
  MAX_ASSET_BYTES,
} from "@/lib/storage/constants"
import { StorageError } from "@/lib/storage/errors"
import type { AllowedAssetKind, BlobPurpose } from "@/lib/storage/types"

const UNSAFE_FILENAME = /[\u0000-\u001f\u007f"\\/<>:|?*]|^\.+$/

export function sanitizeFilename(filename: string): string {
  const value = filename.trim()
  if (
    !value ||
    value.length > 180 ||
    value.includes("/") ||
    value.includes("\\") ||
    value.includes("..") ||
    UNSAFE_FILENAME.test(value)
  ) {
    throw new StorageError("validation", "Filename is missing or contains unsafe characters.")
  }
  return value
}

export function resolveAssetKind(filename: string, contentType: string): AllowedAssetKind {
  const safeName = sanitizeFilename(filename)
  const lowerName = safeName.toLowerCase()
  const normalizedType = contentType.trim().toLowerCase()

  for (const kind of ["midi", "project"] as const) {
    const extensionOk = ALLOWED_EXTENSIONS[kind].some((ext) => lowerName.endsWith(ext))
    const typeOk = ALLOWED_CONTENT_TYPES[kind].includes(normalizedType)
    if (extensionOk && typeOk) {
      return kind
    }
  }

  throw new StorageError(
    "validation",
    "Only MIDI (.mid/.midi) and project JSON (.json) assets are allowed with matching content types.",
  )
}

export function assertAllowedByteSize(byteSize: number): void {
  if (!Number.isInteger(byteSize) || byteSize <= 0) {
    throw new StorageError("validation", "Asset body must be a non-empty byte payload.")
  }
  if (byteSize > MAX_ASSET_BYTES) {
    throw new StorageError(
      "validation",
      `Asset exceeds the maximum allowed size of ${MAX_ASSET_BYTES} bytes.`,
    )
  }
}

export function assertSafeStorageKeySegment(segment: string, label: string): string {
  if (!segment || segment.includes("..") || segment.includes("/") || segment.includes("\\")) {
    throw new StorageError("validation", `Invalid ${label} for storage key.`)
  }
  if (!/^[A-Za-z0-9._-]+$/.test(segment)) {
    throw new StorageError("validation", `Invalid ${label} for storage key.`)
  }
  return segment
}

export function assertPurposeAllowsServiceKey(
  purpose: BlobPurpose,
  serviceKey: string | undefined,
): void {
  if (purpose === "factory" && !serviceKey) {
    throw new StorageError("validation", "Factory assets require a serviceKey.")
  }
  if (purpose !== "factory" && serviceKey) {
    throw new StorageError("validation", "serviceKey is only valid for factory assets.")
  }
}

export function extensionForKind(kind: AllowedAssetKind): string {
  return ALLOWED_EXTENSIONS[kind][0]
}
