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
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "feature_feedback_feature_idx" ON "feature_feedback" USING btree ("feature_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "feature_feedback_status_idx" ON "feature_feedback" USING btree ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "feature_feedback_created_idx" ON "feature_feedback" USING btree ("created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "feature_feedback_fingerprint_idx" ON "feature_feedback" USING btree ("fingerprint_hash");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "feature_feedback_replies" (
  "id" text PRIMARY KEY NOT NULL,
  "feedback_id" text NOT NULL,
  "author_name" text DEFAULT 'Claudio' NOT NULL,
  "body" text NOT NULL,
  "is_public" integer DEFAULT 1 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "feature_feedback_replies_feedback_idx" ON "feature_feedback_replies" USING btree ("feedback_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "feature_feedback_votes" (
  "id" text PRIMARY KEY NOT NULL,
  "feedback_id" text NOT NULL,
  "fingerprint_hash" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "feature_feedback_votes_once_idx" ON "feature_feedback_votes" USING btree ("feedback_id","fingerprint_hash");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "feature_feedback_votes_feedback_idx" ON "feature_feedback_votes" USING btree ("feedback_id");
