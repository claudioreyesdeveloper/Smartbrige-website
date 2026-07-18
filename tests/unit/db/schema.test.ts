import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { getTableName, getTableColumns } from "drizzle-orm"
import { getTableConfig } from "drizzle-orm/pg-core"
import {
  accounts,
  blobReferences,
  catalogEntries,
  catalogServiceActivations,
  catalogVersions,
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
      catalogVersions,
      catalogServiceActivations,
      catalogEntries,
    ].map(getTableName)

    expect(tableNames).toEqual([
      "services",
      "service_prices",
      "user_entitlements",
      "projects",
      "project_revisions",
      "blob_references",
      "stripe_webhook_events",
      "catalog_versions",
      "catalog_service_activations",
      "catalog_entries",
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

  it("allows at most one entitlement per user and service", () => {
    const config = getTableConfig(userEntitlements)
    const uniqueIndex = config.indexes.find(
      (candidate) => candidate.config.name === "user_entitlements_user_service_unique",
    )

    expect(uniqueIndex?.config.unique).toBe(true)
    expect(uniqueIndex?.config.columns.map((column) => "name" in column && column.name)).toEqual([
      "user_id",
      "service_id",
    ])
  })

  it("links the current project revision without cascading revision deletion", () => {
    const config = getTableConfig(projects)
    const foreignKey = config.foreignKeys.find(
      (candidate) =>
        candidate.getName() ===
        "projects_current_revision_id_project_revisions_id_fk",
    )
    const reference = foreignKey?.reference()

    expect(reference?.columns.map((column) => column.name)).toEqual([
      "current_revision_id",
    ])
    expect(reference?.foreignColumns.map((column) => column.name)).toEqual([
      "id",
    ])
    expect(foreignKey?.onDelete).toBe("set null")
    expect(foreignKey?.onUpdate).toBe("no action")
  })

  it("records the circular revision pointer FK in the initial migration and snapshot", () => {
    const migrationPath = path.join(
      process.cwd(),
      "drizzle",
      "0000_exotic_proudstar.sql",
    )
    const migration = readFileSync(migrationPath, "utf8")
    const constraint =
      'ALTER TABLE "projects" ADD CONSTRAINT "projects_current_revision_id_project_revisions_id_fk" FOREIGN KEY ("current_revision_id") REFERENCES "public"."project_revisions"("id") ON DELETE set null ON UPDATE no action;'

    expect(migration).toContain(constraint)
    expect(migration.indexOf(constraint)).toBeGreaterThan(
      migration.indexOf('CREATE TABLE "projects"'),
    )
    expect(migration.indexOf(constraint)).toBeGreaterThan(
      migration.indexOf('CREATE TABLE "project_revisions"'),
    )

    const snapshotPath = path.join(
      process.cwd(),
      "drizzle",
      "meta",
      "0000_snapshot.json",
    )
    const snapshot = JSON.parse(readFileSync(snapshotPath, "utf8"))
    expect(
      snapshot.tables["public.projects"].foreignKeys[
        "projects_current_revision_id_project_revisions_id_fk"
      ],
    ).toEqual({
      name: "projects_current_revision_id_project_revisions_id_fk",
      tableFrom: "projects",
      tableTo: "project_revisions",
      columnsFrom: ["current_revision_id"],
      columnsTo: ["id"],
      onDelete: "set null",
      onUpdate: "no action",
    })
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
