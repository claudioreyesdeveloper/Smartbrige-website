import { describe, expect, it } from "vitest"
import { sanitizeAppCallbackUrl, sanitizeCallbackUrl } from "@/lib/access/safe-redirect"

describe("sanitizeCallbackUrl", () => {
  it("allows safe relative paths", () => {
    expect(sanitizeCallbackUrl("/app")).toBe("/app")
    expect(sanitizeCallbackUrl("/app/jam-player")).toBe("/app/jam-player")
    expect(sanitizeCallbackUrl("/demo")).toBe("/demo")
  })

  it("rejects open redirects", () => {
    expect(sanitizeCallbackUrl("https://evil.example/phish")).toBe("/app")
    expect(sanitizeCallbackUrl("//evil.example")).toBe("/app")
    expect(sanitizeCallbackUrl("/\\evil.example")).toBe("/app")
    expect(sanitizeCallbackUrl("https:%2F%2Fevil.example")).toBe("/app")
  })

  it("uses the provided fallback", () => {
    expect(sanitizeCallbackUrl(undefined, "/login")).toBe("/login")
    expect(sanitizeCallbackUrl("", "/")).toBe("/")
  })
})

describe("sanitizeAppCallbackUrl", () => {
  it("keeps callbacks under /app", () => {
    expect(sanitizeAppCallbackUrl("/app/billing?service=jam-player")).toBe(
      "/app/billing?service=jam-player",
    )
  })

  it("falls back when the path escapes /app", () => {
    expect(sanitizeAppCallbackUrl("/demo")).toBe("/app")
    expect(sanitizeAppCallbackUrl("https://evil.example")).toBe("/app")
  })
})
