/**
 * Prevent open redirects: only same-origin relative paths are allowed.
 * Rejects protocol-relative URLs, absolute URLs, and backslash tricks.
 */
export function sanitizeCallbackUrl(
  candidate: string | null | undefined,
  fallback = "/app",
): string {
  if (typeof candidate !== "string" || candidate.length === 0) {
    return fallback
  }

  if (!candidate.startsWith("/") || candidate.startsWith("//") || candidate.includes("\\")) {
    return fallback
  }

  if (candidate.includes("://")) {
    return fallback
  }

  try {
    const decoded = decodeURIComponent(candidate)
    if (
      !decoded.startsWith("/") ||
      decoded.startsWith("//") ||
      decoded.includes("://") ||
      decoded.includes("\\")
    ) {
      return fallback
    }
  } catch {
    return fallback
  }

  return candidate
}

/** App-area callback: must stay under /app after sanitization. */
export function sanitizeAppCallbackUrl(
  candidate: string | null | undefined,
  fallback = "/app",
): string {
  const safe = sanitizeCallbackUrl(candidate, fallback)
  if (safe === "/app" || safe.startsWith("/app/") || safe.startsWith("/app?")) {
    return safe
  }
  return fallback
}
