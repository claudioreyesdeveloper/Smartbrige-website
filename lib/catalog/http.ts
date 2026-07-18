import { NextResponse } from "next/server"
import { AuthorizationError } from "@/lib/auth/owner"
import { CatalogError, catalogErrorHttpStatus, isCatalogError } from "@/lib/catalog/errors"
import { isStorageError } from "@/lib/storage/errors"

export function catalogErrorResponse(error: unknown): NextResponse {
  if (isCatalogError(error)) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: catalogErrorHttpStatus(error.code) },
    )
  }
  if (isStorageError(error)) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
  }
  if (error instanceof AuthorizationError) {
    const status =
      error.code === "unauthenticated" ? 401 : error.code === "not_found" ? 404 : 403
    return NextResponse.json({ error: error.message, code: error.code }, { status })
  }
  if (error instanceof Error && error.message === "Authentication is required.") {
    return NextResponse.json(
      { error: error.message, code: "unauthenticated" },
      { status: 401 },
    )
  }
  console.error("Unexpected catalog API error", error)
  return NextResponse.json({ error: "Internal server error.", code: "internal" }, { status: 500 })
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export async function readCatalogJsonBody(request: Request): Promise<unknown> {
  const text = await request.text()
  if (!text.trim()) {
    throw new CatalogError("validation", "Request body must be JSON.")
  }
  try {
    return JSON.parse(text) as unknown
  } catch {
    throw new CatalogError("validation", "Request body must be valid JSON.")
  }
}
