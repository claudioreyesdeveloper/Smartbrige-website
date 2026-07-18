import { createHash, timingSafeEqual } from "node:crypto"
import { CatalogError } from "@/lib/catalog/errors"

const ADMIN_HEADER = "authorization"

/**
 * Protects catalog import/activate admin routes with a shared bearer token.
 * Never uses end-user session entitlements for import privileges.
 */
export function assertCatalogAdminToken(request: Request): void {
  const expected = process.env.CATALOG_ADMIN_TOKEN?.trim()
  if (!expected) {
    throw new CatalogError("unavailable", "CATALOG_ADMIN_TOKEN is not configured.")
  }

  const header = request.headers.get(ADMIN_HEADER)
  if (!header) {
    throw new CatalogError("unauthenticated", "Catalog admin authorization is required.")
  }

  const match = /^Bearer\s+(.+)$/i.exec(header.trim())
  if (!match || !tokensMatch(match[1], expected)) {
    throw new CatalogError("forbidden", "Invalid catalog admin token.")
  }
}

function tokensMatch(provided: string, expected: string): boolean {
  const providedDigest = createHash("sha256").update(provided, "utf8").digest()
  const expectedDigest = createHash("sha256").update(expected, "utf8").digest()
  return timingSafeEqual(providedDigest, expectedDigest)
}

export function getCatalogSystemUserId(): string {
  const value = process.env.CATALOG_SYSTEM_USER_ID?.trim()
  if (!value) {
    throw new CatalogError(
      "unavailable",
      "CATALOG_SYSTEM_USER_ID is not configured for factory blob ownership.",
    )
  }
  return value
}
