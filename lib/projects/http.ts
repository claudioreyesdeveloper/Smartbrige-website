import { NextResponse } from "next/server"
import { AuthorizationError } from "@/lib/auth/owner"
import { ProjectError, projectErrorHttpStatus } from "@/lib/projects/errors"
import { PROJECT_API_BODY_MAX_BYTES } from "@/lib/projects/limits"

export function projectErrorResponse(error: unknown): NextResponse {
  if (error instanceof ProjectError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: projectErrorHttpStatus(error.code) },
    )
  }
  if (error instanceof AuthorizationError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: projectErrorHttpStatus(error.code) },
    )
  }
  console.error("Unexpected project API error", error)
  return NextResponse.json({ error: "Internal server error.", code: "internal" }, { status: 500 })
}

export async function readJsonBody(request: Request): Promise<unknown> {
  const contentLength = request.headers.get("content-length")
  if (contentLength) {
    const length = Number(contentLength)
    if (Number.isFinite(length) && length > PROJECT_API_BODY_MAX_BYTES) {
      throw new ProjectError(
        "payload_too_large",
        `Request body exceeds ${PROJECT_API_BODY_MAX_BYTES} bytes.`,
      )
    }
  }

  const text = await request.text()
  if (new TextEncoder().encode(text).byteLength > PROJECT_API_BODY_MAX_BYTES) {
    throw new ProjectError(
      "payload_too_large",
      `Request body exceeds ${PROJECT_API_BODY_MAX_BYTES} bytes.`,
    )
  }

  if (!text.trim()) {
    throw new ProjectError("validation", "Request body must be JSON.")
  }

  try {
    return JSON.parse(text) as unknown
  } catch {
    throw new ProjectError("validation", "Request body must be valid JSON.")
  }
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
