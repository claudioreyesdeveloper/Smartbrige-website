CREATE TYPE "public"."catalog_import_status" AS ENUM('importing', 'ready', 'failed');--> statement-breakpoint
CREATE TABLE "catalog_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"content_tree_sha256" text NOT NULL,
	"catalog_export_version" integer NOT NULL,
	"schema_version" integer NOT NULL,
	"source_provenance" jsonb NOT NULL,
	"status" "catalog_import_status" NOT NULL,
	"section_counts" jsonb NOT NULL,
	"import_checkpoint" jsonb,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "catalog_service_activations" (
	"service_key" text PRIMARY KEY NOT NULL,
	"catalog_version_id" text NOT NULL,
	"previous_catalog_version_id" text,
	"activated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "catalog_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"catalog_version_id" text NOT NULL,
	"section" text NOT NULL,
	"stable_id" text NOT NULL,
	"service_key" text NOT NULL,
	"kind" text NOT NULL,
	"metadata" jsonb NOT NULL,
	"blob_reference_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "catalog_service_activations" ADD CONSTRAINT "catalog_service_activations_catalog_version_id_catalog_versions_id_fk" FOREIGN KEY ("catalog_version_id") REFERENCES "public"."catalog_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_service_activations" ADD CONSTRAINT "catalog_service_activations_previous_catalog_version_id_catalog_versions_id_fk" FOREIGN KEY ("previous_catalog_version_id") REFERENCES "public"."catalog_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_entries" ADD CONSTRAINT "catalog_entries_catalog_version_id_catalog_versions_id_fk" FOREIGN KEY ("catalog_version_id") REFERENCES "public"."catalog_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_entries" ADD CONSTRAINT "catalog_entries_blob_reference_id_blob_references_id_fk" FOREIGN KEY ("blob_reference_id") REFERENCES "public"."blob_references"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "catalog_versions_content_tree_sha256_unique" ON "catalog_versions" USING btree ("content_tree_sha256");--> statement-breakpoint
CREATE INDEX "catalog_versions_status_idx" ON "catalog_versions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "catalog_service_activations_version_idx" ON "catalog_service_activations" USING btree ("catalog_version_id");--> statement-breakpoint
CREATE UNIQUE INDEX "catalog_entries_version_stable_id_unique" ON "catalog_entries" USING btree ("catalog_version_id","stable_id");--> statement-breakpoint
CREATE INDEX "catalog_entries_service_key_idx" ON "catalog_entries" USING btree ("service_key");--> statement-breakpoint
CREATE INDEX "catalog_entries_version_section_idx" ON "catalog_entries" USING btree ("catalog_version_id","section");--> statement-breakpoint
CREATE INDEX "catalog_entries_blob_reference_id_idx" ON "catalog_entries" USING btree ("blob_reference_id");
