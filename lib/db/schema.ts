import type { AdapterAccountType } from "@auth/core/adapters"
import { relations } from "drizzle-orm"
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  type AnyPgColumn,
} from "drizzle-orm/pg-core"
import { SERVICE_KEYS } from "@/lib/db/services"

export const serviceAvailabilityEnum = pgEnum("service_availability", ["active", "future"])

export const entitlementStatusEnum = pgEnum("entitlement_status", [
  "active",
  "trialing",
  "canceled",
  "expired",
])

export const entitlementSourceEnum = pgEnum("entitlement_source", [
  "stripe",
  "manual",
  "promo",
])

export const blobPurposeEnum = pgEnum("blob_purpose", ["render", "upload", "factory"])

export const catalogImportStatusEnum = pgEnum("catalog_import_status", [
  "importing",
  "ready",
  "failed",
])

export const engineOperationEnum = pgEnum("engine_operation", [
  "jam_prepare",
  "jam_reharmonize",
  "rhythm_browse",
  "rhythm_fills",
  "rhythm_render",
])

export const engineUsageStatusEnum = pgEnum("engine_usage_status", [
  "completed",
  "failed",
  "rejected",
])

export const users = pgTable("user", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
})

export const accounts = pgTable(
  "account",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [
    primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
  ],
)

export const sessions = pgTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
})

export const verificationTokens = pgTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (verificationToken) => [
    primaryKey({
      columns: [verificationToken.identifier, verificationToken.token],
    }),
  ],
)

export const services = pgTable(
  "services",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    key: text("key").$type<(typeof SERVICE_KEYS)[number]>().notNull(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    availability: serviceAvailabilityEnum("availability").notNull(),
    sortOrder: integer("sort_order").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("services_key_unique").on(table.key)],
)

export const servicePrices = pgTable(
  "service_prices",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    serviceId: text("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "cascade" }),
    stripeProductId: text("stripe_product_id").notNull(),
    stripePriceId: text("stripe_price_id").notNull(),
    billingInterval: text("billing_interval").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("service_prices_stripe_price_unique").on(table.stripePriceId),
    index("service_prices_service_id_idx").on(table.serviceId),
  ],
)

export const userEntitlements = pgTable(
  "user_entitlements",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    serviceId: text("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "cascade" }),
    status: entitlementStatusEnum("status").notNull(),
    source: entitlementSourceEnum("source").notNull(),
    stripeSubscriptionId: text("stripe_subscription_id"),
    stripeSubscriptionItemId: text("stripe_subscription_item_id"),
    validFrom: timestamp("valid_from", { mode: "date" }).notNull(),
    validUntil: timestamp("valid_until", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("user_entitlements_user_id_idx").on(table.userId),
    index("user_entitlements_service_id_idx").on(table.serviceId),
    uniqueIndex("user_entitlements_user_service_unique").on(table.userId, table.serviceId),
  ],
)

export const projects = pgTable(
  "projects",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    currentRevisionId: text("current_revision_id").references(
      (): AnyPgColumn => projectRevisions.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { mode: "date" }),
  },
  (table) => [index("projects_user_id_idx").on(table.userId)],
)

export const projectRevisions = pgTable(
  "project_revisions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    document: jsonb("document").notNull(),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("project_revisions_project_version_unique").on(table.projectId, table.version),
    index("project_revisions_project_id_idx").on(table.projectId),
  ],
)

export const blobReferences = pgTable(
  "blob_references",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    projectId: text("project_id").references(() => projects.id, { onDelete: "set null" }),
    storageKey: text("storage_key").notNull(),
    contentType: text("content_type").notNull(),
    byteSize: integer("byte_size").notNull(),
    checksumSha256: text("checksum_sha256").notNull(),
    purpose: blobPurposeEnum("purpose").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("blob_references_storage_key_unique").on(table.storageKey),
    index("blob_references_user_id_idx").on(table.userId),
    index("blob_references_project_id_idx").on(table.projectId),
  ],
)

export const stripeWebhookEvents = pgTable(
  "stripe_webhook_events",
  {
    id: text("id").primaryKey(),
    type: text("type").notNull(),
    payloadHash: text("payload_hash").notNull(),
    processedAt: timestamp("processed_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [index("stripe_webhook_events_processed_at_idx").on(table.processedAt)],
)

/** Immutable A06 factory catalog import versions (compact Neon metadata, not SQLCipher). */
export const catalogVersions = pgTable(
  "catalog_versions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    contentTreeSha256: text("content_tree_sha256").notNull(),
    catalogExportVersion: integer("catalog_export_version").notNull(),
    schemaVersion: integer("schema_version").notNull(),
    sourceProvenance: jsonb("source_provenance").notNull().$type<Record<string, unknown>>(),
    status: catalogImportStatusEnum("status").notNull(),
    sectionCounts: jsonb("section_counts").notNull().$type<Record<string, number>>(),
    importCheckpoint: jsonb("import_checkpoint").$type<{
      completedStableIds: string[]
    } | null>(),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
    completedAt: timestamp("completed_at", { mode: "date" }),
  },
  (table) => [
    uniqueIndex("catalog_versions_content_tree_sha256_unique").on(table.contentTreeSha256),
    index("catalog_versions_status_idx").on(table.status),
  ],
)

/** Active catalog version pointer per service (rollback = point at a prior ready version). */
export const catalogServiceActivations = pgTable(
  "catalog_service_activations",
  {
    serviceKey: text("service_key").$type<(typeof SERVICE_KEYS)[number]>().primaryKey(),
    catalogVersionId: text("catalog_version_id")
      .notNull()
      .references(() => catalogVersions.id, { onDelete: "restrict" }),
    previousCatalogVersionId: text("previous_catalog_version_id").references(
      () => catalogVersions.id,
      { onDelete: "set null" },
    ),
    activatedAt: timestamp("activated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [index("catalog_service_activations_version_idx").on(table.catalogVersionId)],
)

/** Compact per-record factory metadata for entitlement-scoped catalog reads. */
export const catalogEntries = pgTable(
  "catalog_entries",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    catalogVersionId: text("catalog_version_id")
      .notNull()
      .references(() => catalogVersions.id, { onDelete: "cascade" }),
    section: text("section").notNull(),
    stableId: text("stable_id").notNull(),
    serviceKey: text("service_key").$type<(typeof SERVICE_KEYS)[number]>().notNull(),
    kind: text("kind").notNull(),
    metadata: jsonb("metadata").notNull().$type<Record<string, unknown>>(),
    blobReferenceId: text("blob_reference_id").references(() => blobReferences.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("catalog_entries_version_stable_id_unique").on(
      table.catalogVersionId,
      table.stableId,
    ),
    index("catalog_entries_service_key_idx").on(table.serviceKey),
    index("catalog_entries_version_section_idx").on(table.catalogVersionId, table.section),
    index("catalog_entries_blob_reference_id_idx").on(table.blobReferenceId),
  ],
)

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
  entitlements: many(userEntitlements),
  projects: many(projects),
  blobReferences: many(blobReferences),
}))

export const servicesRelations = relations(services, ({ many }) => ({
  prices: many(servicePrices),
  entitlements: many(userEntitlements),
}))

export const servicePricesRelations = relations(servicePrices, ({ one }) => ({
  service: one(services, {
    fields: [servicePrices.serviceId],
    references: [services.id],
  }),
}))

export const userEntitlementsRelations = relations(userEntitlements, ({ one }) => ({
  user: one(users, {
    fields: [userEntitlements.userId],
    references: [users.id],
  }),
  service: one(services, {
    fields: [userEntitlements.serviceId],
    references: [services.id],
  }),
}))

export const projectsRelations = relations(projects, ({ one, many }) => ({
  owner: one(users, {
    fields: [projects.userId],
    references: [users.id],
  }),
  revisions: many(projectRevisions),
  blobReferences: many(blobReferences),
}))

export const projectRevisionsRelations = relations(projectRevisions, ({ one }) => ({
  project: one(projects, {
    fields: [projectRevisions.projectId],
    references: [projects.id],
  }),
  createdBy: one(users, {
    fields: [projectRevisions.createdByUserId],
    references: [users.id],
  }),
}))

export const blobReferencesRelations = relations(blobReferences, ({ one }) => ({
  owner: one(users, {
    fields: [blobReferences.userId],
    references: [users.id],
  }),
  project: one(projects, {
    fields: [blobReferences.projectId],
    references: [projects.id],
  }),
}))

export const catalogVersionsRelations = relations(catalogVersions, ({ many }) => ({
  entries: many(catalogEntries),
  activations: many(catalogServiceActivations),
}))

export const catalogServiceActivationsRelations = relations(
  catalogServiceActivations,
  ({ one }) => ({
    version: one(catalogVersions, {
      fields: [catalogServiceActivations.catalogVersionId],
      references: [catalogVersions.id],
    }),
    previousVersion: one(catalogVersions, {
      fields: [catalogServiceActivations.previousCatalogVersionId],
      references: [catalogVersions.id],
    }),
  }),
)

export const catalogEntriesRelations = relations(catalogEntries, ({ one }) => ({
  version: one(catalogVersions, {
    fields: [catalogEntries.catalogVersionId],
    references: [catalogVersions.id],
  }),
  blobReference: one(blobReferences, {
    fields: [catalogEntries.blobReferenceId],
    references: [blobReferences.id],
  }),
}))

/**
 * Durable jam-engine usage/audit events.
 * Stores operation metadata only — never raw musical content, recipes, or traces.
 */
export const engineUsageEvents = pgTable(
  "engine_usage_events",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    projectId: text("project_id").references(() => projects.id, { onDelete: "set null" }),
    operation: engineOperationEnum("operation").notNull(),
    status: engineUsageStatusEnum("status").notNull(),
    errorCode: text("error_code"),
    durationMs: integer("duration_ms"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("engine_usage_events_user_created_idx").on(table.userId, table.createdAt),
    index("engine_usage_events_user_status_created_idx").on(
      table.userId,
      table.status,
      table.createdAt,
    ),
    index("engine_usage_events_project_id_idx").on(table.projectId),
  ],
)

export const engineUsageEventsRelations = relations(engineUsageEvents, ({ one }) => ({
  user: one(users, {
    fields: [engineUsageEvents.userId],
    references: [users.id],
  }),
  project: one(projects, {
    fields: [engineUsageEvents.projectId],
    references: [projects.id],
  }),
}))
