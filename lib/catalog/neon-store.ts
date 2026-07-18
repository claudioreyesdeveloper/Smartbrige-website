import { and, asc, eq } from "drizzle-orm"
import { getDb, type AppDatabase } from "@/lib/db"
import {
  catalogEntries,
  catalogServiceActivations,
  catalogVersions,
} from "@/lib/db/schema"
import { CatalogError } from "@/lib/catalog/errors"
import type {
  CatalogStore,
  InsertCatalogEntryInput,
  InsertCatalogVersionInput,
} from "@/lib/catalog/store"
import type {
  CatalogActivationRecord,
  CatalogEntryRecord,
  CatalogVersionRecord,
} from "@/lib/catalog/types"
import type { ServiceKey } from "@/lib/services/catalog"

function mapVersion(row: typeof catalogVersions.$inferSelect): CatalogVersionRecord {
  return {
    id: row.id,
    contentTreeSha256: row.contentTreeSha256,
    catalogExportVersion: row.catalogExportVersion,
    schemaVersion: row.schemaVersion,
    sourceProvenance: row.sourceProvenance,
    status: row.status,
    sectionCounts: row.sectionCounts,
    importCheckpoint: row.importCheckpoint ?? null,
    errorMessage: row.errorMessage,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    completedAt: row.completedAt,
  }
}

function mapEntry(row: typeof catalogEntries.$inferSelect): CatalogEntryRecord {
  return {
    id: row.id,
    catalogVersionId: row.catalogVersionId,
    section: row.section,
    stableId: row.stableId,
    serviceKey: row.serviceKey,
    kind: row.kind,
    metadata: row.metadata,
    blobReferenceId: row.blobReferenceId,
    createdAt: row.createdAt,
  }
}

function mapActivation(
  row: typeof catalogServiceActivations.$inferSelect,
): CatalogActivationRecord {
  return {
    serviceKey: row.serviceKey,
    catalogVersionId: row.catalogVersionId,
    previousCatalogVersionId: row.previousCatalogVersionId,
    activatedAt: row.activatedAt,
  }
}

export class NeonCatalogStore implements CatalogStore {
  constructor(private readonly db: AppDatabase = getDb()) {}

  async findVersionByContentTreeSha256(
    contentTreeSha256: string,
  ): Promise<CatalogVersionRecord | null> {
    const row = await this.db.query.catalogVersions.findFirst({
      where: eq(catalogVersions.contentTreeSha256, contentTreeSha256.toLowerCase()),
    })
    return row ? mapVersion(row) : null
  }

  async findVersionById(id: string): Promise<CatalogVersionRecord | null> {
    const row = await this.db.query.catalogVersions.findFirst({
      where: eq(catalogVersions.id, id),
    })
    return row ? mapVersion(row) : null
  }

  async listVersions(): Promise<CatalogVersionRecord[]> {
    const rows = await this.db
      .select()
      .from(catalogVersions)
      .orderBy(asc(catalogVersions.createdAt))
    return rows.map(mapVersion)
  }

  async insertVersion(input: InsertCatalogVersionInput): Promise<CatalogVersionRecord> {
    const [row] = await this.db
      .insert(catalogVersions)
      .values({
        id: input.id,
        contentTreeSha256: input.contentTreeSha256.toLowerCase(),
        catalogExportVersion: input.catalogExportVersion,
        schemaVersion: input.schemaVersion,
        sourceProvenance: input.sourceProvenance,
        status: input.status,
        sectionCounts: input.sectionCounts,
        importCheckpoint: input.importCheckpoint ?? null,
        createdAt: input.createdAt,
        updatedAt: input.createdAt,
      })
      .returning()
    if (!row) {
      throw new CatalogError("unavailable", "Failed to insert catalog version.")
    }
    return mapVersion(row)
  }

  async updateVersion(
    id: string,
    patch: Partial<{
      status: CatalogVersionRecord["status"]
      sectionCounts: Record<string, number>
      importCheckpoint: { completedStableIds: string[] } | null
      errorMessage: string | null
      updatedAt: Date
      completedAt: Date | null
    }>,
  ): Promise<CatalogVersionRecord> {
    const [row] = await this.db
      .update(catalogVersions)
      .set(patch)
      .where(eq(catalogVersions.id, id))
      .returning()
    if (!row) {
      throw new CatalogError("not_found", "Catalog version was not found.")
    }
    return mapVersion(row)
  }

  async findEntry(
    catalogVersionId: string,
    stableId: string,
  ): Promise<CatalogEntryRecord | null> {
    const row = await this.db.query.catalogEntries.findFirst({
      where: and(
        eq(catalogEntries.catalogVersionId, catalogVersionId),
        eq(catalogEntries.stableId, stableId),
      ),
    })
    return row ? mapEntry(row) : null
  }

  async listEntriesForService(
    catalogVersionId: string,
    serviceKey: ServiceKey,
  ): Promise<CatalogEntryRecord[]> {
    const rows = await this.db
      .select()
      .from(catalogEntries)
      .where(
        and(
          eq(catalogEntries.catalogVersionId, catalogVersionId),
          eq(catalogEntries.serviceKey, serviceKey),
        ),
      )
      .orderBy(asc(catalogEntries.stableId))
    return rows.map(mapEntry)
  }

  async insertEntry(input: InsertCatalogEntryInput): Promise<CatalogEntryRecord> {
    const [row] = await this.db
      .insert(catalogEntries)
      .values({
        id: input.id,
        catalogVersionId: input.catalogVersionId,
        section: input.section,
        stableId: input.stableId,
        serviceKey: input.serviceKey,
        kind: input.kind,
        metadata: input.metadata,
        blobReferenceId: input.blobReferenceId,
        createdAt: input.createdAt,
      })
      .returning()
    if (!row) {
      throw new CatalogError("unavailable", "Failed to insert catalog entry.")
    }
    return mapEntry(row)
  }

  async getActivation(serviceKey: ServiceKey): Promise<CatalogActivationRecord | null> {
    const row = await this.db.query.catalogServiceActivations.findFirst({
      where: eq(catalogServiceActivations.serviceKey, serviceKey),
    })
    return row ? mapActivation(row) : null
  }

  async listActivations(): Promise<CatalogActivationRecord[]> {
    const rows = await this.db.select().from(catalogServiceActivations)
    return rows.map(mapActivation)
  }

  async upsertActivation(input: {
    serviceKey: ServiceKey
    catalogVersionId: string
    previousCatalogVersionId: string | null
    activatedAt: Date
  }): Promise<CatalogActivationRecord> {
    const [row] = await this.db
      .insert(catalogServiceActivations)
      .values({
        serviceKey: input.serviceKey,
        catalogVersionId: input.catalogVersionId,
        previousCatalogVersionId: input.previousCatalogVersionId,
        activatedAt: input.activatedAt,
      })
      .onConflictDoUpdate({
        target: catalogServiceActivations.serviceKey,
        set: {
          catalogVersionId: input.catalogVersionId,
          previousCatalogVersionId: input.previousCatalogVersionId,
          activatedAt: input.activatedAt,
        },
      })
      .returning()
    if (!row) {
      throw new CatalogError("unavailable", "Failed to upsert catalog activation.")
    }
    return mapActivation(row)
  }
}
