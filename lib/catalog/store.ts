import type { ServiceKey } from "@/lib/services/catalog"
import type {
  CatalogActivationRecord,
  CatalogEntryRecord,
  CatalogImportStatus,
  CatalogVersionRecord,
} from "@/lib/catalog/types"

export type InsertCatalogVersionInput = {
  id: string
  contentTreeSha256: string
  catalogExportVersion: number
  schemaVersion: number
  sourceProvenance: Record<string, unknown>
  status: CatalogImportStatus
  sectionCounts: Record<string, number>
  importCheckpoint?: { completedStableIds: string[] } | null
  createdAt: Date
}

export type InsertCatalogEntryInput = {
  id: string
  catalogVersionId: string
  section: string
  stableId: string
  serviceKey: ServiceKey
  kind: string
  metadata: Record<string, unknown>
  blobReferenceId: string | null
  createdAt: Date
}

export type CatalogStore = {
  findVersionByContentTreeSha256: (
    contentTreeSha256: string,
  ) => Promise<CatalogVersionRecord | null>
  findVersionById: (id: string) => Promise<CatalogVersionRecord | null>
  listVersions: () => Promise<CatalogVersionRecord[]>
  insertVersion: (input: InsertCatalogVersionInput) => Promise<CatalogVersionRecord>
  updateVersion: (
    id: string,
    patch: Partial<{
      status: CatalogImportStatus
      sectionCounts: Record<string, number>
      importCheckpoint: { completedStableIds: string[] } | null
      errorMessage: string | null
      updatedAt: Date
      completedAt: Date | null
    }>,
  ) => Promise<CatalogVersionRecord>
  findEntry: (
    catalogVersionId: string,
    stableId: string,
  ) => Promise<CatalogEntryRecord | null>
  listEntriesForService: (
    catalogVersionId: string,
    serviceKey: ServiceKey,
  ) => Promise<CatalogEntryRecord[]>
  insertEntry: (input: InsertCatalogEntryInput) => Promise<CatalogEntryRecord>
  getActivation: (serviceKey: ServiceKey) => Promise<CatalogActivationRecord | null>
  listActivations: () => Promise<CatalogActivationRecord[]>
  upsertActivation: (input: {
    serviceKey: ServiceKey
    catalogVersionId: string
    previousCatalogVersionId: string | null
    activatedAt: Date
  }) => Promise<CatalogActivationRecord>
}
