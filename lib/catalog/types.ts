import type { ServiceKey } from "@/lib/services/catalog"

export type CatalogImportStatus = "importing" | "ready" | "failed"

export type CatalogVersionRecord = {
  id: string
  contentTreeSha256: string
  catalogExportVersion: number
  schemaVersion: number
  sourceProvenance: Record<string, unknown>
  status: CatalogImportStatus
  sectionCounts: Record<string, number>
  importCheckpoint: { completedStableIds: string[] } | null
  errorMessage: string | null
  createdAt: Date
  updatedAt: Date
  completedAt: Date | null
}

export type CatalogEntryRecord = {
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

export type CatalogActivationRecord = {
  serviceKey: ServiceKey
  catalogVersionId: string
  previousCatalogVersionId: string | null
  activatedAt: Date
}

export type CatalogEntryPublic = {
  stableId: string
  section: string
  kind: string
  metadata: Record<string, unknown>
  hasAsset: boolean
  blobReferenceId: string | null
}

export type CatalogListResult = {
  serviceKey: ServiceKey
  catalogVersionId: string
  contentTreeSha256: string
  catalogExportVersion: number
  schemaVersion: number
  entries: CatalogEntryPublic[]
}
