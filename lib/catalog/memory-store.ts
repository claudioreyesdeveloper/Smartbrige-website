import { CatalogError } from "@/lib/catalog/errors"
import type {
  InsertCatalogEntryInput,
  InsertCatalogVersionInput,
  CatalogStore,
} from "@/lib/catalog/store"
import type {
  CatalogActivationRecord,
  CatalogEntryRecord,
  CatalogVersionRecord,
} from "@/lib/catalog/types"
import type { ServiceKey } from "@/lib/services/catalog"

export class MemoryCatalogStore implements CatalogStore {
  readonly versions = new Map<string, CatalogVersionRecord>()
  readonly entries = new Map<string, CatalogEntryRecord>()
  readonly activations = new Map<ServiceKey, CatalogActivationRecord>()

  async findVersionByContentTreeSha256(
    contentTreeSha256: string,
  ): Promise<CatalogVersionRecord | null> {
    for (const version of this.versions.values()) {
      if (version.contentTreeSha256 === contentTreeSha256) {
        return version
      }
    }
    return null
  }

  async findVersionById(id: string): Promise<CatalogVersionRecord | null> {
    return this.versions.get(id) ?? null
  }

  async listVersions(): Promise<CatalogVersionRecord[]> {
    return [...this.versions.values()].sort(
      (left, right) => left.createdAt.getTime() - right.createdAt.getTime(),
    )
  }

  async insertVersion(input: InsertCatalogVersionInput): Promise<CatalogVersionRecord> {
    if ([...this.versions.values()].some((row) => row.contentTreeSha256 === input.contentTreeSha256)) {
      throw new CatalogError("conflict", "content_tree_sha256 already exists")
    }
    const row: CatalogVersionRecord = {
      id: input.id,
      contentTreeSha256: input.contentTreeSha256,
      catalogExportVersion: input.catalogExportVersion,
      schemaVersion: input.schemaVersion,
      sourceProvenance: input.sourceProvenance,
      status: input.status,
      sectionCounts: input.sectionCounts,
      importCheckpoint: input.importCheckpoint ?? null,
      errorMessage: null,
      createdAt: input.createdAt,
      updatedAt: input.createdAt,
      completedAt: null,
    }
    this.versions.set(row.id, row)
    return row
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
    const existing = this.versions.get(id)
    if (!existing) {
      throw new CatalogError("not_found", "Catalog version was not found.")
    }
    const next = { ...existing, ...patch }
    this.versions.set(id, next)
    return next
  }

  async findEntry(
    catalogVersionId: string,
    stableId: string,
  ): Promise<CatalogEntryRecord | null> {
    for (const entry of this.entries.values()) {
      if (entry.catalogVersionId === catalogVersionId && entry.stableId === stableId) {
        return entry
      }
    }
    return null
  }

  async listEntriesForService(
    catalogVersionId: string,
    serviceKey: ServiceKey,
  ): Promise<CatalogEntryRecord[]> {
    return [...this.entries.values()]
      .filter(
        (entry) =>
          entry.catalogVersionId === catalogVersionId && entry.serviceKey === serviceKey,
      )
      .sort((left, right) => left.stableId.localeCompare(right.stableId))
  }

  async insertEntry(input: InsertCatalogEntryInput): Promise<CatalogEntryRecord> {
    const existing = await this.findEntry(input.catalogVersionId, input.stableId)
    if (existing) {
      throw new CatalogError("conflict", "stable_id already imported for this version")
    }
    const row: CatalogEntryRecord = { ...input }
    this.entries.set(row.id, row)
    return row
  }

  async getActivation(serviceKey: ServiceKey): Promise<CatalogActivationRecord | null> {
    return this.activations.get(serviceKey) ?? null
  }

  async listActivations(): Promise<CatalogActivationRecord[]> {
    return [...this.activations.values()]
  }

  async upsertActivation(input: {
    serviceKey: ServiceKey
    catalogVersionId: string
    previousCatalogVersionId: string | null
    activatedAt: Date
  }): Promise<CatalogActivationRecord> {
    const row: CatalogActivationRecord = { ...input }
    this.activations.set(input.serviceKey, row)
    return row
  }
}
