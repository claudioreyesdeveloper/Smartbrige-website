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
    /** Clip length in bars (from desktop midi_clip_analysis.bars). */
    bars: real("bars"),
    midiData: bytea("midi_data").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("library_clips_midi_path_idx").on(table.midiPath)],
)

/**
 * Stripe subscription entitlement keyed by Clerk user id.
 *
 * `userId` is UNIQUE — one subscription row per user, deliberately, even
 * though a user can now be entitled to more than one product. Multi-product
 * access is modelled as a `plan` *tier* on the single row (see `plan` below),
 * not as multiple concurrent subscription rows. That keeps upgrades a single
 * Stripe plan-change (proration) instead of two invoices/renewal dates/
 * cancellation flows for the same customer. See docs/jam-player-product-plan.md §9.
 */
export const subscriptions = pgTable(
  "subscriptions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().unique(),
    stripeCustomerId: text("stripe_customer_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    stripePriceId: text("stripe_price_id"),
    status: text("status").notNull().default("inactive"),
    /**
     * Plan tier, which determines which products this row entitles.
     * 'style_maker' -> Style Maker only (default; preserves pre-tier rows).
     * 'jam_player'  -> Jam Player only.
     * 'all_access'  -> Style Maker + Jam Player.
     * See lib/billing/entitlements.ts PLAN_ENTITLEMENTS for the mapping.
     */
    plan: text("plan").notNull().default("style_maker"),
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

/** Anonymous, feature-scoped product feedback used by the public Build with us workflow. */
export const featureFeedback = pgTable(
  "feature_feedback",
  {
    id: text("id").primaryKey(),
    featureId: text("feature_id").notNull(),
    type: text("type").notNull().default("feedback"),
    pulse: text("pulse"),
    comment: text("comment").notNull().default(""),
    displayName: text("display_name").notNull().default("Anonymous"),
    email: text("email"),
    notifyOnReply: integer("notify_on_reply").notNull().default(0),
    videoSeconds: integer("video_seconds"),
    status: text("status").notNull().default("new"),
    isHidden: integer("is_hidden").notNull().default(0),
    fingerprintHash: text("fingerprint_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("feature_feedback_feature_idx").on(table.featureId),
    index("feature_feedback_status_idx").on(table.status),
    index("feature_feedback_created_idx").on(table.createdAt),
    index("feature_feedback_fingerprint_idx").on(table.fingerprintHash),
  ],
)

export const featureFeedbackReplies = pgTable(
  "feature_feedback_replies",
  {
    id: text("id").primaryKey(),
    feedbackId: text("feedback_id").notNull(),
    authorName: text("author_name").notNull().default("Claudio"),
    body: text("body").notNull(),
    isPublic: integer("is_public").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("feature_feedback_replies_feedback_idx").on(table.feedbackId),
  ],
)

export const featureFeedbackVotes = pgTable(
  "feature_feedback_votes",
  {
    id: text("id").primaryKey(),
    feedbackId: text("feedback_id").notNull(),
    fingerprintHash: text("fingerprint_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("feature_feedback_votes_once_idx").on(
      table.feedbackId,
      table.fingerprintHash,
    ),
    index("feature_feedback_votes_feedback_idx").on(table.feedbackId),
  ],
)

export type FeatureFeedbackRow = typeof featureFeedback.$inferSelect
export type FeatureFeedbackReplyRow = typeof featureFeedbackReplies.$inferSelect

