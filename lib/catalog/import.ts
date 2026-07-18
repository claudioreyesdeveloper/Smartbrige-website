import type { CatalogBundleReader } from "@/lib/catalog/bundle"
import type { CatalogAssetWriter } from "@/lib/catalog/assets"
import { CATALOG_SECTION_ORDER, type CatalogSectionName } from "@/lib/catalog/constants"
import { CatalogError } from "@/lib/catalog/errors"
import {
  flattenImportRecords,
  verifyAssetBytes,
  verifyContentTreeSha256,
  verifyRecordsChecksum,
  type SectionManifest,
} from "@/lib/catalog/manifest"
import { kindFromStableId, serviceKeyForSection } from "@/lib/catalog/mapping"
import type { CatalogStore } from "@/lib/catalog/store"
import type { CatalogVersionRecord } from "@/lib/catalog/types"
import type { ServiceKey } from "@/lib/services/catalog"

export type CatalogImportResult = {
  version: CatalogVersionRecord
  deduplicated: boolean
  resumed: boolean
  importedEntryCount: number
  activatedServices: ServiceKey[]
}

export type CatalogImporterDeps = {
  store: CatalogStore
  assets: CatalogAssetWriter
  bundle: CatalogBundleReader
  /** Blob reference owner for factory rows (admin/system user id). */
  ownerUserId: string
  /** Resolve the configured owner before any import or Blob/reference write. */
  assertOwnerUserExists: (userId: string) => Promise<void>
  createId?: () => string
  now?: () => Date
  /** When true, activate mapped services onto this version after a successful import. */
  activateOnSuccess?: boolean
}

export class CatalogImporter {
  private readonly createId: () => string
  private readonly now: () => Date

  constructor(private readonly deps: CatalogImporterDeps) {
    this.createId = deps.createId ?? (() => crypto.randomUUID())
    this.now = deps.now ?? (() => new Date())
  }

  async importBundle(): Promise<CatalogImportResult> {
    await this.deps.assertOwnerUserExists(this.deps.ownerUserId)

    const top = await this.deps.bundle.readTopManifest()
    const contentTreeSha256 = top.content_tree_sha256.toLowerCase()
    const existing = await this.deps.store.findVersionByContentTreeSha256(contentTreeSha256)

    if (existing?.status === "ready") {
      const activatedServices = this.deps.activateOnSuccess
        ? await this.activateMappedServices(existing.id)
        : []
      return {
        version: existing,
        deduplicated: true,
        resumed: false,
        importedEntryCount: 0,
        activatedServices,
      }
    }

    let version = existing
    let resumed = false
    if (version && version.status === "importing") {
      resumed = true
    } else if (version && version.status === "failed") {
      version = await this.deps.store.updateVersion(version.id, {
        status: "importing",
        errorMessage: null,
        updatedAt: this.now(),
        completedAt: null,
        importCheckpoint: version.importCheckpoint,
      })
      resumed = true
    } else if (!version) {
      version = await this.deps.store.insertVersion({
        id: this.createId(),
        contentTreeSha256,
        catalogExportVersion: top.catalog_export_version,
        schemaVersion: top.schema_version,
        sourceProvenance: top.source_provenance,
        status: "importing",
        sectionCounts: {},
        importCheckpoint: { completedStableIds: [] },
        createdAt: this.now(),
      })
    }

    const completed = new Set(version.importCheckpoint?.completedStableIds ?? [])
    let importedEntryCount = 0

    try {
      const sectionManifests: SectionManifest[] = []
      const sectionCounts: Record<string, number> = {}

      for (const sectionName of CATALOG_SECTION_ORDER) {
        const summary = top.sections[sectionName]
        if (!summary) {
          continue
        }
        const section = await this.deps.bundle.readSectionManifest(
          sectionName,
          summary.manifest_path,
        )
        if (section.section !== sectionName) {
          throw new CatalogError(
            "validation",
            `Section manifest name mismatch: expected ${sectionName}, got ${section.section}`,
          )
        }
        if (section.records_sha256.toLowerCase() !== summary.records_sha256.toLowerCase()) {
          throw new CatalogError(
            "checksum_mismatch",
            `Top-level records_sha256 mismatch for section ${sectionName}`,
          )
        }
        if (section.record_count !== summary.record_count) {
          throw new CatalogError(
            "validation",
            `Top-level record_count mismatch for section ${sectionName}`,
          )
        }
        verifyRecordsChecksum(section)
        sectionManifests.push(section)
        sectionCounts[sectionName] = section.record_count
      }

      for (const name of Object.keys(top.sections)) {
        if (!(CATALOG_SECTION_ORDER as readonly string[]).includes(name)) {
          throw new CatalogError("validation", `Unexpected section in top manifest: ${name}`)
        }
      }

      verifyContentTreeSha256(sectionManifests, top.content_tree_sha256)

      for (const section of sectionManifests) {
        const serviceKey = serviceKeyForSection(section.section as CatalogSectionName)
        const flat = flattenImportRecords(section.section as CatalogSectionName, section.records)

        for (const item of flat) {
          if (completed.has(item.stableId)) {
            continue
          }

          const already = await this.deps.store.findEntry(version.id, item.stableId)
          if (already) {
            completed.add(item.stableId)
            continue
          }

          let blobReferenceId: string | null = null
          if (item.asset) {
            const body = await this.deps.bundle.readAssetBytes(
              section.section as CatalogSectionName,
              item.asset.path,
            )
            verifyAssetBytes(body, item.asset, item.stableId)
            const reference = await this.deps.assets.putFactoryMidi({
              serviceKey,
              checksumSha256: item.asset.sha256,
              body,
              ownerUserId: this.deps.ownerUserId,
              createId: this.createId,
              now: this.now,
            })
            blobReferenceId = reference.id
          }

          const metadata = {
            ...item.metadata,
            asset: item.asset
              ? {
                  sha256: item.asset.sha256,
                  size_bytes: item.asset.size_bytes,
                  blobReferenceId,
                }
              : null,
          }

          await this.deps.store.insertEntry({
            id: this.createId(),
            catalogVersionId: version.id,
            section: section.section,
            stableId: item.stableId,
            serviceKey,
            kind: item.kind || kindFromStableId(item.stableId),
            metadata,
            blobReferenceId,
            createdAt: this.now(),
          })

          completed.add(item.stableId)
          importedEntryCount += 1

          version = await this.deps.store.updateVersion(version.id, {
            importCheckpoint: { completedStableIds: [...completed].sort() },
            sectionCounts,
            updatedAt: this.now(),
          })
        }
      }

      version = await this.deps.store.updateVersion(version.id, {
        status: "ready",
        sectionCounts,
        importCheckpoint: { completedStableIds: [...completed].sort() },
        errorMessage: null,
        updatedAt: this.now(),
        completedAt: this.now(),
      })

      const activatedServices = this.deps.activateOnSuccess
        ? await this.activateMappedServices(version.id)
        : []

      return {
        version,
        deduplicated: false,
        resumed,
        importedEntryCount,
        activatedServices,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Catalog import failed."
      await this.deps.store.updateVersion(version.id, {
        status: "failed",
        errorMessage: message,
        importCheckpoint: { completedStableIds: [...completed].sort() },
        updatedAt: this.now(),
      })
      throw error
    }
  }

  private async activateMappedServices(catalogVersionId: string): Promise<ServiceKey[]> {
    const activated: ServiceKey[] = []
    const services = new Set<ServiceKey>(
      CATALOG_SECTION_ORDER.map((section) => serviceKeyForSection(section)),
    )
    for (const serviceKey of services) {
      await activateCatalogVersion(this.deps.store, serviceKey, catalogVersionId, this.now)
      activated.push(serviceKey)
    }
    return activated.sort()
  }
}

export async function activateCatalogVersion(
  store: CatalogStore,
  serviceKey: ServiceKey,
  catalogVersionId: string,
  now: () => Date = () => new Date(),
): Promise<CatalogVersionRecord> {
  const version = await store.findVersionById(catalogVersionId)
  if (!version) {
    throw new CatalogError("not_found", "Catalog version was not found.")
  }
  if (version.status !== "ready") {
    throw new CatalogError(
      "conflict",
      `Only ready catalog versions can be activated (status=${version.status}).`,
    )
  }

  const previous = await store.getActivation(serviceKey)
  await store.upsertActivation({
    serviceKey,
    catalogVersionId,
    previousCatalogVersionId: previous?.catalogVersionId ?? null,
    activatedAt: now(),
  })
  return version
}
