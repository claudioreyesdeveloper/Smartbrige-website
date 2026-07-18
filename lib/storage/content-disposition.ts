import { StorageError } from "@/lib/storage/errors"
import { sanitizeFilename } from "@/lib/storage/validation"

/**
 * Build a Content-Disposition value that cannot inject headers or escape quotes.
 * Uses attachment + a sanitized filename only.
 */
export function buildAttachmentContentDisposition(filename: string): string {
  const safe = sanitizeFilename(filename)
  if (/[^\x20-\x7E]/.test(safe) || safe.includes('"') || safe.includes("\\") || safe.includes(";")) {
    throw new StorageError("validation", "Filename is not safe for Content-Disposition.")
  }
  return `attachment; filename="${safe}"`
}
