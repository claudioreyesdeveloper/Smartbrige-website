import { afterEach, describe, expect, it } from "vitest"
import {
  ACCESS_FIXTURE_ENV,
  encodeAccessFixtureCookie,
  parseAccessFixtureCookie,
} from "@/lib/access/fixture"

describe("access fixture cookie", () => {
  afterEach(() => {
    delete process.env[ACCESS_FIXTURE_ENV]
  })

  it("returns null when fixture mode is disabled", () => {
    const encoded = encodeAccessFixtureCookie({
      userId: "user-1",
      entitlements: [{ serviceKey: "jam-player", status: "active" }],
    })
    expect(parseAccessFixtureCookie(encoded)).toBeNull()
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
