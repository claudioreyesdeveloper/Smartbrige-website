import { sql } from "drizzle-orm"
import { requireDb } from "@/lib/db"

let schemaPromise: Promise<void> | null = null

export function ensureFeatureFeedbackSchema() {
  if (schemaPromise) return schemaPromise

  schemaPromise = (async () => {
    const db = requireDb()

    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS "feature_feedback" (
        "id" text PRIMARY KEY NOT NULL,
        "feature_id" text NOT NULL,
        "type" text DEFAULT 'feedback' NOT NULL,
        "pulse" text,
        "comment" text DEFAULT '' NOT NULL,
        "display_name" text DEFAULT 'Anonymous' NOT NULL,
        "email" text,
        "notify_on_reply" integer DEFAULT 0 NOT NULL,
        "video_seconds" integer,
        "status" text DEFAULT 'new' NOT NULL,
        "is_hidden" integer DEFAULT 0 NOT NULL,
        "fingerprint_hash" text NOT NULL,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL
      )
    `))
    await db.execute(sql.raw(`CREATE INDEX IF NOT EXISTS "feature_feedback_feature_idx" ON "feature_feedback" ("feature_id")`))
    await db.execute(sql.raw(`CREATE INDEX IF NOT EXISTS "feature_feedback_status_idx" ON "feature_feedback" ("status")`))
    await db.execute(sql.raw(`CREATE INDEX IF NOT EXISTS "feature_feedback_created_idx" ON "feature_feedback" ("created_at")`))
    await db.execute(sql.raw(`CREATE INDEX IF NOT EXISTS "feature_feedback_fingerprint_idx" ON "feature_feedback" ("fingerprint_hash")`))

    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS "feature_feedback_replies" (
        "id" text PRIMARY KEY NOT NULL,
        "feedback_id" text NOT NULL,
        "author_name" text DEFAULT 'Claudio' NOT NULL,
        "body" text NOT NULL,
        "is_public" integer DEFAULT 1 NOT NULL,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL
      )
    `))
    await db.execute(sql.raw(`CREATE INDEX IF NOT EXISTS "feature_feedback_replies_feedback_idx" ON "feature_feedback_replies" ("feedback_id")`))

    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS "feature_feedback_votes" (
        "id" text PRIMARY KEY NOT NULL,
        "feedback_id" text NOT NULL,
        "fingerprint_hash" text NOT NULL,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL
      )
    `))
    await db.execute(sql.raw(`CREATE UNIQUE INDEX IF NOT EXISTS "feature_feedback_votes_once_idx" ON "feature_feedback_votes" ("feedback_id","fingerprint_hash")`))
    await db.execute(sql.raw(`CREATE INDEX IF NOT EXISTS "feature_feedback_votes_feedback_idx" ON "feature_feedback_votes" ("feedback_id")`))
  })().catch((error) => {
    schemaPromise = null
    throw error
  })

  return schemaPromise
}
