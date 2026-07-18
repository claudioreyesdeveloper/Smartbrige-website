import { afterEach, describe, expect, it } from "vitest"
import {
  ACCESS_FIXTURE_ENV,
  encodeAccessFixtureCookie,
  isAccessFixtureEnabled,
  parseAccessFixtureCookie,
} from "@/lib/access/fixture"

describe("access fixture cookie", () => {
  afterEach(() => {
    delete process.env[ACCESS_FIXTURE_ENV]
    delete process.env.VERCEL_ENV
  })

  it("returns null when fixture mode is disabled", () => {
    const encoded = encodeAccessFixtureCookie({
      userId: "user-1",
      entitlements: [{ serviceKey: "jam-player", status: "active" }],
    })
    expect(parseAccessFixtureCookie(encoded)).toBeNull()
  })

  it("allows fixture mode for local Playwright", () => {
    process.env[ACCESS_FIXTURE_ENV] = "1"
    expect(isAccessFixtureEnabled()).toBe(true)
  })

  it("fails closed on Vercel production even when explicitly enabled", () => {
    process.env[ACCESS_FIXTURE_ENV] = "1"
    process.env.VERCEL_ENV = "production"
    const encoded = encodeAccessFixtureCookie({
      userId: "user-1",
      entitlements: [{ serviceKey: "jam-player", status: "active" }],
    })

    expect(isAccessFixtureEnabled()).toBe(false)
    expect(parseAccessFixtureCookie(encoded)).toBeNull()
  })

  it("remains available on Vercel preview when explicitly enabled", () => {
    process.env[ACCESS_FIXTURE_ENV] = "1"
    process.env.VERCEL_ENV = "preview"
    expect(isAccessFixtureEnabled()).toBe(true)
  })

  it("parses service keys and statuses without trusting access claims", () => {
    process.env[ACCESS_FIXTURE_ENV] = "1"
    const encoded = encodeURIComponent(
      JSON.stringify({
        userId: "user-1",
        email: "fixture@example.com",
        entitlements: [
          { serviceKey: "jam-player", status: "active" },
          { serviceKey: "bass-drums", status: "canceled", access: "active" },
        ],
      }),
    )

    const parsed = parseAccessFixtureCookie(encoded)
    expect(parsed?.userId).toBe("user-1")
    expect(parsed?.email).toBe("fixture@example.com")
    expect(parsed?.records).toEqual([
      expect.objectContaining({ serviceKey: "jam-player", status: "active" }),
      expect.objectContaining({ serviceKey: "bass-drums", status: "canceled" }),
    ])
    expect(parsed?.records[0]).not.toHaveProperty("access")
  })

  it("rejects unknown services and malformed payloads", () => {
    process.env[ACCESS_FIXTURE_ENV] = "1"
    expect(parseAccessFixtureCookie("not-json")).toBeNull()
    expect(
      parseAccessFixtureCookie(
        encodeURIComponent(
          JSON.stringify({
            userId: "user-1",
            entitlements: [{ serviceKey: "not-a-service", status: "active" }],
          }),
        ),
      )?.records,
    ).toEqual([])
  })
})
