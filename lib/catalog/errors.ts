export type CatalogErrorCode =
  | "unauthenticated"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "validation"
  | "checksum_mismatch"
  | "unavailable"

export class CatalogError extends Error {
  readonly code: CatalogErrorCode

  constructor(code: CatalogErrorCode, message: string) {
    super(message)
    this.name = "CatalogError"
    this.code = code
  }
}

export function catalogErrorHttpStatus(code: CatalogErrorCode): number {
  switch (code) {
    case "unauthenticated":
      return 401
    case "forbidden":
      return 403
    case "not_found":
      return 404
    case "conflict":
      return 409
    case "checksum_mismatch":
      return 400
    case "validation":
      return 400
    case "unavailable":
      return 503
  }
}

export function isCatalogError(error: unknown): error is CatalogError {
  return error instanceof CatalogError
}
