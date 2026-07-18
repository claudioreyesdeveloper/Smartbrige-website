import { describe, expect, it } from "vitest"
import {
  VERIFY_REQUEST_CONFIRMATION,
  VERIFY_REQUEST_PATH,
} from "@/lib/auth/verify-request"

describe("verify request confirmation", () => {
  it("uses a confirmation URL without user data", () => {
    expect(VERIFY_REQUEST_PATH).toBe("/verify-request")
    expect(VERIFY_REQUEST_PATH).not.toContain("?")
  })

  it("renders generic copy without an email address", () => {
    expect(VERIFY_REQUEST_CONFIRMATION).toContain("sign-in link to your inbox")
    expect(VERIFY_REQUEST_CONFIRMATION).not.toMatch(
      /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
    )
  })
})
