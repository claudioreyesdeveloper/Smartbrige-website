export type JamErrorCode =
  | "unauthenticated"
  | "forbidden"
  | "not_found"
  | "validation"
  | "payload_too_large"
  | "quota_exceeded"
  | "unavailable"
  | "misconfigured"
  | "internal"

export class JamError extends Error {
  readonly code: JamErrorCode

  constructor(code: JamErrorCode, message: string) {
    super(message)
    this.name = "JamError"
    this.code = code
  }
}

export function isJamError(error: unknown): error is JamError {
  return error instanceof JamError
}

export function jamErrorHttpStatus(code: JamErrorCode): number {
  switch (code) {
    case "unauthenticated":
      return 401
    case "forbidden":
      return 403
    case "not_found":
      return 404
    case "validation":
      return 400
    case "payload_too_large":
      return 413
    case "quota_exceeded":
      return 429
    case "unavailable":
      return 503
    case "misconfigured":
      return 503
    case "internal":
      return 500
  }
}

/** Abuse-safe public messages — never leak backend URL, token, or stack. */
export function abuseSafeJamMessage(code: JamErrorCode, fallback?: string): string {
  switch (code) {
    case "unauthenticated":
      return "Authentication is required."
    case "forbidden":
      return "You do not have access to this operation."
    case "not_found":
      return "Resource was not found."
    case "validation":
      return fallback ?? "Request validation failed."
    case "payload_too_large":
      return "Request body is too large."
    case "quota_exceeded":
      return "Usage limit exceeded. Try again later."
    case "unavailable":
      return "The jam engine is temporarily unavailable."
    case "misconfigured":
      return "The jam engine is temporarily unavailable."
    case "internal":
      return "Internal server error."
  }
}
