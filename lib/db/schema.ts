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
