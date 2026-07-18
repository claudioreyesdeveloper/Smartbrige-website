import { describe, expect, it } from "vitest"
import { getTableName, getTableColumns } from "drizzle-orm"
import {
  accounts,
  blobReferences,
  projectRevisions,
  projects,
  servicePrices,
  services,
  sessions,
  stripeWebhookEvents,
  userEntitlements,
  users,
  verificationTokens,
} from "@/lib/db/schema"
import { SERVICE_CATALOG, SERVICE_KEYS } from "@/lib/db/services"

describe("database schema", () => {
  it("defines Auth.js adapter tables", () => {
    expect(getTableName(users)).toBe("user")
    expect(getTableName(accounts)).toBe("account")
    expect(getTableName(sessions)).toBe("session")
    expect(getTableName(verificationTokens)).toBe("verificationToken")
  })

  it("defines SaaS tables without a global paid flag", () => {
    const tableNames = [
      services,
      servicePrices,
      userEntitlements,
      projects,
      projectRevisions,
      blobReferences,
      stripeWebhookEvents,
    ].map(getTableName)

    expect(tableNames).toEqual([
      "services",
      "service_prices",
      "user_entitlements",
      "projects",
      "project_revisions",
      "blob_references",
      "stripe_webhook_events",
    ])

    for (const table of [users, services, projects, userEntitlements]) {
      const columns = Object.keys(getTableColumns(table))
      expect(columns.some((name) => /paid|premium|subscribed/i.test(name))).toBe(false)
    }
  })

  it("keys entitlements through the service catalog", () => {
    const entitlementColumns = Object.keys(getTableColumns(userEntitlements))
    expect(entitlementColumns).toContain("serviceId")
    expect(entitlementColumns).not.toContain("serviceKey")
  })

  it("matches the independent service catalog keys", () => {
    expect(SERVICE_CATALOG.map((entry) => entry.key)).toEqual([...SERVICE_KEYS])
    expect(SERVICE_KEYS).toEqual([
      "jam-player",
      "bass-drums",
      "solo-phrases",
      "lyrics",
      "genos-mixer",
      "style-maker",
    ])
  })
})
