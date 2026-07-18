import { afterEach, describe, expect, it } from "vitest"
import { assertCatalogAdminToken, getCatalogSystemUserId } from "@/lib/catalog/admin"

const originalToken = process.env.CATALOG_ADMIN_TOKEN
const originalSystemUserId = process.env.CATALOG_SYSTEM_USER_ID

afterEach(() => {
  if (originalToken === undefined) {
    delete process.env.CATALOG_ADMIN_TOKEN
  } else {
    process.env.CATALOG_ADMIN_TOKEN = originalToken
  }
  if (originalSystemUserId === undefined) {
    delete process.env.CATALOG_SYSTEM_USER_ID
  } else {
    process.env.CATALOG_SYSTEM_USER_ID = originalSystemUserId
  }
})

describe("catalog admin preflight", () => {
  it("accepts only the exact bearer token using the timing-safe comparison path", () => {
    process.env.CATALOG_ADMIN_TOKEN = "catalog-secret-token"

    expect(() =>
      assertCatalogAdminToken(
        new Request("https://example.test", {
          headers: { authorization: "Bearer catalog-secret-token" },
        }),
      ),
    ).not.toThrow()

    expect(() =>
      assertCatalogAdminToken(
        new Request("https://example.test", {
          headers: { authorization: "Bearer catalog-secret-tokeN" },
        }),
      ),
    ).toThrow(/Invalid catalog admin token/)

    expect(() =>
      assertCatalogAdminToken(
        new Request("https://example.test", {
          headers: { authorization: "Bearer short" },
        }),
      ),
    ).toThrow(/Invalid catalog admin token/)
  })

  it("fails clearly when the system owner id is not configured", () => {
    delete process.env.CATALOG_SYSTEM_USER_ID
    expect(() => getCatalogSystemUserId()).toThrow(
      /CATALOG_SYSTEM_USER_ID is not configured for factory blob ownership/,
    )
  })
})
