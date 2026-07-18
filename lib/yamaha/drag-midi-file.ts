/**
 * Chrome drag-out helper for recorded section MIDI.
 *
 * Desktop Jam Player uses OS file drag of a real temp .mid.
 * Browsers cannot offer CF_HDROP to Cubase; Chrome's DownloadURL
 * (Gmail-style) can drag a file to Finder/Desktop when the URL is a
 * data: payload prepared before dragstart (must be synchronous).
 */

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = ""
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

/** Sanitize for Chrome DownloadURL `mime:filename:url` (no colons in name). */
export function sanitizeDragFileName(fileName: string): string {
  return fileName.replace(/[:\r\n]/g, "_")
}

/**
 * Build Chrome DownloadURL payload with embedded data: URL.
 * Format: application/octet-stream:file.mid:data:application/octet-stream;base64,...
 */
export function chromeDownloadUrlPayload(
  fileName: string,
  bytes: Uint8Array,
): string {
  const safeName = sanitizeDragFileName(fileName)
  const base64 = bytesToBase64(bytes)
  return `application/octet-stream:${safeName}:data:application/octet-stream;base64,${base64}`
}

/** Attach Chrome DownloadURL only — do not mix with items.add(File) (clears store). */
export function setChromeMidiDragData(
  dataTransfer: DataTransfer,
  downloadUrlPayload: string,
  fileName: string,
) {
  dataTransfer.effectAllowed = "copy"
  dataTransfer.setData("DownloadURL", downloadUrlPayload)
  dataTransfer.setData("text/plain", sanitizeDragFileName(fileName))
}
