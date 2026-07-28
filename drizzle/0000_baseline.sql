CREATE TABLE "keyboard_models" (
	"id" integer PRIMARY KEY NOT NULL,
	"model_key" text NOT NULL,
	"display_name" text NOT NULL,
	"source_file" text DEFAULT '' NOT NULL,
	"is_active" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "keyboard_styles" (
	"id" integer PRIMARY KEY NOT NULL,
	"model_id" integer NOT NULL,
	"style_number" integer NOT NULL,
	"name" text NOT NULL,
	"category" text,
	"display_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "keyboard_voices" (
	"id" integer PRIMARY KEY NOT NULL,
	"model_id" integer NOT NULL,
	"msb" integer NOT NULL,
	"lsb" integer NOT NULL,
	"pc0" integer DEFAULT 0 NOT NULL,
	"prg" integer NOT NULL,
	"name" text NOT NULL,
	"category" text,
	"sub_category" text,
	"display_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "library_clips" (
	"id" integer PRIMARY KEY NOT NULL,
	"source_kind" text NOT NULL,
	"source_library" text,
	"category_name" text,
	"subcategory_name" text,
	"song_name" text,
	"clip_name" text,
	"library_name" text,
	"feel_name" text,
	"feel_mode" text,
	"time_signature" text,
	"bpm" real,
	"bpm_bucket" text,
	"section_type" text,
	"style_tags" text DEFAULT '[]' NOT NULL,
	"variation" integer DEFAULT 0 NOT NULL,
	"midi_path" text NOT NULL,
	"note_count" integer DEFAULT 0 NOT NULL,
	"note_lo" integer,
	"note_hi" integer,
	"bars" real,
	"midi_data" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "style_maker_projects" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"donor_file_name" text NOT NULL,
	"donor_bytes" "bytea" NOT NULL,
	"last_built_file_name" text,
	"last_built_bytes" "bytea",
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"stripe_price_id" text,
	"status" text DEFAULT 'inactive' NOT NULL,
	"current_period_end" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "keyboard_models_model_key_idx" ON "keyboard_models" USING btree ("model_key");--> statement-breakpoint
CREATE UNIQUE INDEX "keyboard_styles_model_number_idx" ON "keyboard_styles" USING btree ("model_id","style_number");--> statement-breakpoint
CREATE UNIQUE INDEX "library_clips_midi_path_idx" ON "library_clips" USING btree ("midi_path");--> statement-breakpoint
CREATE UNIQUE INDEX "style_maker_projects_user_name_idx" ON "style_maker_projects" USING btree ("user_id","name");--> statement-breakpoint
CREATE INDEX "style_maker_projects_user_id_idx" ON "style_maker_projects" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "subscriptions_user_id_idx" ON "subscriptions" USING btree ("user_id");