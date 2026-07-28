import { describe, expect, it, vi } from "vitest"
import { isDevBypassActive, warnDevBypass } from "@/lib/billing/dev-bypass"

describe("isDevBypassActive", () => {
  it("is false in production no matter what else is set", () => {
    expect(isDevBypassActive({ NODE_ENV: "production" })).toBe(false)
    expect(
      isDevBypassActive({
        NODE_ENV: "production",
        STRIPE_SECRET_KEY: undefined,
        DATABASE_URL: undefined,
      }),
    ).toBe(false)
    // Even a stray live key + nothing else configured must not flip this on.
    expect(
      isDevBypassActive({ NODE_ENV: "production", STRIPE_SECRET_KEY: "sk_live_x" }),
    ).toBe(false)
  })

  it("is false in a Vitest/CI run (NODE_ENV=test)", () => {
    expect(isDevBypassActive({ NODE_ENV: "test" })).toBe(false)
  })

  it("is false when NODE_ENV is unset", () => {
    expect(isDevBypassActive({ NODE_ENV: undefined })).toBe(false)
  })

  it("is true in development with nothing configured", () => {
    expect(isDevBypassActive({ NODE_ENV: "development" })).toBe(true)
  })

  it("is true in development when only one of Stripe/DB is configured", () => {
    expect(
      isDevBypassActive({ NODE_ENV: "development", STRIPE_SECRET_KEY: "sk_test_abc" }),
    ).toBe(true)
    expect(
      isDevBypassActive({ NODE_ENV: "development", DATABASE_URL: "postgres://x" }),
    ).toBe(true)
  })

  it("is false in development once both Stripe and DB are configured", () => {
    expect(
      isDevBypassActive({
        NODE_ENV: "development",
        STRIPE_SECRET_KEY: "sk_test_abc",
        DATABASE_URL: "postgres://x",
      }),
    ).toBe(false)
  })

  it("refuses to bypass against a live Stripe key even in development", () => {
    expect(
      isDevBypassActive({ NODE_ENV: "development", STRIPE_SECRET_KEY: "sk_live_abc" }),
    ).toBe(false)
    // ...even if DATABASE_URL is also missing, which would otherwise qualify.
    expect(
      isDevBypassActive({
        NODE_ENV: "development",
        STRIPE_SECRET_KEY: "sk_live_abc",
        DATABASE_URL: undefined,
      }),
    ).toBe(false)
  })
})

describe("warnDevBypass", () => {
  it("logs loudly, naming the call site, whenever it runs", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    warnDevBypass("userHasProduct(jam-player)")
    expect(warn).toHaveBeenCalledTimes(1)
    const [message] = warn.mock.calls[0]
    expect(message).toContain("DEV BYPASS ACTIVE")
    expect(message).toContain("userHasProduct(jam-player)")
    expect(message).toContain("NODE_ENV=production")
    warn.mockRestore()
  })
})
