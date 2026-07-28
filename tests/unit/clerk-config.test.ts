import { describe, expect, it } from "vitest"
import {
  isClerkFullyConfigured,
  isClerkPublishableEnabled,
} from "@/lib/billing/clerk-config"

describe("clerk-config", () => {
  it("disables live keys on localhost / development", () => {
    expect(
      isClerkPublishableEnabled({
        NODE_ENV: "development",
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_live_abc",
        NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      }),
    ).toBe(false)
    expect(
      isClerkFullyConfigured({
        NODE_ENV: "development",
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_live_abc",
        CLERK_SECRET_KEY: "sk_live_abc",
        NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      }),
    ).toBe(false)
  })

  it("allows test keys in development", () => {
    expect(
      isClerkFullyConfigured({
        NODE_ENV: "development",
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_abc",
        CLERK_SECRET_KEY: "sk_test_abc",
        NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      }),
    ).toBe(true)
  })

  it("allows live keys in production on the real host", () => {
    expect(
      isClerkFullyConfigured({
        NODE_ENV: "production",
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_live_abc",
        CLERK_SECRET_KEY: "sk_live_abc",
        NEXT_PUBLIC_APP_URL: "https://thesmartbridge.io",
      }),
    ).toBe(true)
  })
})
