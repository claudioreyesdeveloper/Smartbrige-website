import { createHash } from "node:crypto"
import { StorageError } from "@/lib/storage/errors"

const SHA256_HEX = /^[a-f0-9]{64}$/

export function normalizeSha256Hex(value: string): string {
  const normalized = value.trim().toLowerCase()
  if (!SHA256_HEX.test(normalized)) {
    throw new StorageError("validation", "checksumSha256 must be a 64-character lowercase hex SHA-256 digest.")
  }
  return normalized
}

export function sha256Hex(body: Uint8Array): string {
  return createHash("sha256").update(body).digest("hex")
}

export function verifyChecksumSha256(body: Uint8Array, declaredChecksum: string): string {
  const expected = normalizeSha256Hex(declaredChecksum)
  const actual = sha256Hex(body)
  if (actual !== expected) {
    throw new StorageError("checksum_mismatch", "Declared checksum does not match uploaded content.")
  }
  return actual
}
