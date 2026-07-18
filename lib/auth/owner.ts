export class AuthorizationError extends Error {
  readonly code: "unauthenticated" | "forbidden" | "not_found"

  constructor(code: AuthorizationError["code"], message: string) {
    super(message)
    this.name = "AuthorizationError"
    this.code = code
  }
}

export function isResourceOwner(resourceUserId: string, sessionUserId: string): boolean {
  return resourceUserId === sessionUserId
}

export function assertResourceOwner(
  resourceUserId: string,
  sessionUserId: string,
  resourceLabel = "resource",
): void {
  if (!isResourceOwner(resourceUserId, sessionUserId)) {
    throw new AuthorizationError("forbidden", `You do not own this ${resourceLabel}.`)
  }
}

export function assertAuthenticatedUserId(userId: string | undefined | null): asserts userId is string {
  if (!userId) {
    throw new AuthorizationError("unauthenticated", "Authentication is required.")
  }
}
