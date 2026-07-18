import { describe, expect, it } from "vitest"
import {
  assertAuthenticatedUserId,
  assertResourceOwner,
  AuthorizationError,
  isResourceOwner,
} from "@/lib/auth/owner"

describe("owner helpers", () => {
  it("detects matching owners", () => {
    expect(isResourceOwner("user-1", "user-1")).toBe(true)
    expect(isResourceOwner("user-1", "user-2")).toBe(false)
  })

  it("throws when a resource owner mismatch occurs", () => {
    expect(() => assertResourceOwner("owner-a", "owner-b", "project")).toThrow(AuthorizationError)
    expect(() => assertResourceOwner("owner-a", "owner-b", "project")).toThrow(/project/)
  })

  it("requires an authenticated user id", () => {
    expect(() => assertAuthenticatedUserId(undefined)).toThrow(AuthorizationError)
    expect(() => assertAuthenticatedUserId("user-123")).not.toThrow()
  })
})
