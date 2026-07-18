import { NextResponse } from "next/server"
import { AuthorizationError } from "@/lib/auth/owner"
import { StorageError, isStorageError } from "@/lib/storage/errors"

export function storageErrorResponse(error: unknown): NextResponse {
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
  return NextResponse.json({ error: "Unexpected storage error.", code: "unavailable" }, { status: 500 })
}

export function toUploadBody(bytes: ArrayBuffer): Uint8Array {
  return new Uint8Array(bytes)
}

export function createStorageError(code: StorageError["code"], message: string): StorageError {
  return new StorageError(code, message)
}
