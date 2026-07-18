export type ProjectErrorCode =
  | "unauthenticated"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "validation"
  | "payload_too_large"

export class ProjectError extends Error {
  readonly code: ProjectErrorCode

  constructor(code: ProjectErrorCode, message: string) {
    super(message)
    this.name = "ProjectError"
    this.code = code
  }
}

export function projectErrorHttpStatus(code: ProjectErrorCode): number {
  switch (code) {
    case "unauthenticated":
      return 401
    case "forbidden":
      return 403
    case "not_found":
      return 404
    case "conflict":
      return 409
    case "payload_too_large":
      return 413
    case "validation":
      return 400
  }
}
