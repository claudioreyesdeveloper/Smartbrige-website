import { NextResponse } from "next/server"
import { AuthorizationError } from "@/lib/auth/owner"
import {
  JamError,
  abuseSafeJamMessage,
  isJamError,
  jamErrorHttpStatus,
} from "@/lib/jam/domain/errors"
import { BODY_LIMIT_BYTES } from "@/lib/jam/domain/limits"

export function jamErrorResponse(error: unknown): NextResponse {
  if (isJamError(error)) {
    return NextResponse.json(
      {
        error: abuseSafeJamMessage(error.code, error.message),
        code: error.code,
      },
      { status: jamErrorHttpStatus(error.code) },
    )
  }
  if (error instanceof AuthorizationError) {
    const code =
      error.code === "unauthenticated"
        ? "unauthenticated"
        : error.code === "not_found"
          ? "not_found"
          : "forbidden"
    return NextResponse.json(
      { error: abuseSafeJamMessage(code, error.message), code },
      { status: jamErrorHttpStatus(code) },
    )
  }
  if (error instanceof Error && error.message === "Authentication is required.") {
    return NextResponse.json(
      { error: abuseSafeJamMessage("unauthenticated"), code: "unauthenticated" },
      { status: 401 },
    )
  }
  console.error("Unexpected jam engine API error")
  return NextResponse.json(
    { error: abuseSafeJamMessage("internal"), code: "internal" },
    { status: 500 },
  )
}

export async function readJamJsonBody(request: Request): Promise<unknown> {
  const contentLength = request.headers.get("content-length")
  if (contentLength) {
    const length = Number(contentLength)
    if (Number.isFinite(length) && length > BODY_LIMIT_BYTES) {
      throw new JamError("payload_too_large", "Request body is too large.")
    }
  }

  const text = await request.text()
  if (new TextEncoder().encode(text).byteLength > BODY_LIMIT_BYTES) {
    throw new JamError("payload_too_large", "Request body is too large.")
  }
  if (!text.trim()) {
    throw new JamError("validation", "Request body must be JSON.")
  }
  try {
    return JSON.parse(text) as unknown
  } catch {
    throw new JamError("validation", "Request body must be valid JSON.")
  }
}
