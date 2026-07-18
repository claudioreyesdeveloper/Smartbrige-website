CREATE TYPE "public"."engine_operation" AS ENUM('jam_prepare', 'jam_reharmonize');--> statement-breakpoint
CREATE TYPE "public"."engine_usage_status" AS ENUM('completed', 'failed', 'rejected');--> statement-breakpoint
CREATE TABLE "engine_usage_events" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"project_id" text,
	"operation" "engine_operation" NOT NULL,
	"status" "engine_usage_status" NOT NULL,
	"error_code" text,
	"duration_ms" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "engine_usage_events" ADD CONSTRAINT "engine_usage_events_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engine_usage_events" ADD CONSTRAINT "engine_usage_events_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "engine_usage_events_user_created_idx" ON "engine_usage_events" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "engine_usage_events_user_status_created_idx" ON "engine_usage_events" USING btree ("user_id","status","created_at");--> statement-breakpoint
CREATE INDEX "engine_usage_events_project_id_idx" ON "engine_usage_events" USING btree ("project_id");
