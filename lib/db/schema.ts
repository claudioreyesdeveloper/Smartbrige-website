import {
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core"
import { customType } from "drizzle-orm/pg-core"

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea"
  },
})

/** Hosted copy of desktop midi_clips for Style Maker (bass/drums/guitar). */
export const libraryClips = pgTable(
  "library_clips",
  {
    id: integer("id").primaryKey(),
    sourceKind: text("source_kind").notNull(),
    sourceLibrary: text("source_library"),
    categoryName: text("category_name"),
    subcategoryName: text("subcategory_name"),
    songName: text("song_name"),
    clipName: text("clip_name"),
    libraryName: text("library_name"),
    feelName: text("feel_name"),
    feelMode: text("feel_mode"),
    timeSignature: text("time_signature"),
    bpm: real("bpm"),
    bpmBucket: text("bpm_bucket"),
    sectionType: text("section_type"),
    styleTags: text("style_tags").notNull().default("[]"),
    variation: integer("variation").notNull().default(0),
    midiPath: text("midi_path").notNull(),
    noteCount: integer("note_count").notNull().default(0),
    noteLo: integer("note_lo"),
    noteHi: integer("note_hi"),
    midiData: bytea("midi_data").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("library_clips_midi_path_idx").on(table.midiPath)],
)

/** Stripe subscription entitlement keyed by Clerk user id. */
export const subscriptions = pgTable(
  "subscriptions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().unique(),
    stripeCustomerId: text("stripe_customer_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    stripePriceId: text("stripe_price_id"),
    status: text("status").notNull().default("inactive"),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("subscriptions_user_id_idx").on(table.userId)],
)

/** Desktop keyboard_models — scopes voice/style banks per arranger. */
export const keyboardModels = pgTable(
  "keyboard_models",
  {
    id: integer("id").primaryKey(),
    modelKey: text("model_key").notNull(),
    displayName: text("display_name").notNull(),
    sourceFile: text("source_file").notNull().default(""),
    isActive: integer("is_active").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("keyboard_models_model_key_idx").on(table.modelKey)],
)

/** Desktop keyboard_voices — factory voice bank per model. */
export const keyboardVoices = pgTable(
  "keyboard_voices",
  {
    id: integer("id").primaryKey(),
    modelId: integer("model_id").notNull(),
    msb: integer("msb").notNull(),
    lsb: integer("lsb").notNull(),
    pc0: integer("pc0").notNull().default(0),
    prg: integer("prg").notNull(),
    name: text("name").notNull(),
    category: text("category"),
    subCategory: text("sub_category"),
    displayOrder: integer("display_order").notNull().default(0),
  },
)


/** Desktop keyboard_styles — factory style catalog per model. */
export const keyboardStyles = pgTable(
  "keyboard_styles",
  {
    id: integer("id").primaryKey(),
    modelId: integer("model_id").notNull(),
    styleNumber: integer("style_number").notNull(),
    name: text("name").notNull(),
    category: text("category"),
    displayOrder: integer("display_order").notNull().default(0),
  },
  (table) => [
    uniqueIndex("keyboard_styles_model_number_idx").on(
      table.modelId,
      table.styleNumber,
    ),
  ],
)

/**
 * Named Style Maker projects per Clerk user.
 * Binary style bytes live in bytea; lane takes / mixers in payload JSON.
 * Apply with: npm run db:push
 */
export const styleMakerProjects = pgTable(
  "style_maker_projects",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    donorFileName: text("donor_file_name").notNull(),
    donorBytes: bytea("donor_bytes").notNull(),
    lastBuiltFileName: text("last_built_file_name"),
    lastBuiltBytes: bytea("last_built_bytes"),
    payload: jsonb("payload").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("style_maker_projects_user_name_idx").on(table.userId, table.name),
    index("style_maker_projects_user_id_idx").on(table.userId),
  ],
)

export type LibraryClip = typeof libraryClips.$inferSelect
export type Subscription = typeof subscriptions.$inferSelect
export type KeyboardModel = typeof keyboardModels.$inferSelect
export type KeyboardVoice = typeof keyboardVoices.$inferSelect
export type KeyboardStyle = typeof keyboardStyles.$inferSelect
export type StyleMakerProjectRow = typeof styleMakerProjects.$inferSelect
