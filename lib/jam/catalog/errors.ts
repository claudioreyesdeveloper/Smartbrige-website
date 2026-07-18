export type JamCatalogErrorCode =
  | "unauthenticated"
  | "forbidden"
  | "not_found"
  | "validation"
  | "malformed"
  | "limit_exceeded"
  | "unsupported_schema"
  | "unsupported_model"
  | "network"
  | "internal"

export class JamCatalogError extends Error {
  readonly code: JamCatalogErrorCode
  readonly status?: number

  constructor(code: JamCatalogErrorCode, message: string, status?: number) {
    super(message)
    this.name = "JamCatalogError"
    this.code = code
    this.status = status
  }
}

export function isJamCatalogError(error: unknown): error is JamCatalogError {
  return error instanceof JamCatalogError
}
