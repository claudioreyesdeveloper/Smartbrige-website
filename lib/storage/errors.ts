export type StorageErrorCode =
  | "unauthenticated"
  | "forbidden"
  | "not_found"
  | "validation"
  | "conflict"
  | "checksum_mismatch"
  | "expired"
  | "misconfigured"
  | "unavailable"

export class StorageError extends Error {
  readonly code: StorageErrorCode
  readonly status: number

  constructor(code: StorageErrorCode, message: string, status?: number) {
    super(message)
    this.name = "StorageError"
    this.code = code
    this.status =
      status ??
      (
        {
          unauthenticated: 401,
          forbidden: 403,
          not_found: 404,
          validation: 400,
          conflict: 409,
          checksum_mismatch: 400,
          expired: 401,
          misconfigured: 503,
          unavailable: 503,
        } as const
      )[code]
  }
}

export function isStorageError(error: unknown): error is StorageError {
  return error instanceof StorageError
}
