/**
 * Fast catalog import for jam-songs bundles (no MIDI blob uploads).
 * Batches Drizzle inserts instead of one-row-at-a-time checkpointing.
 *
 * Usage:
 *   npx tsx scripts/catalog-import-fast.ts /tmp/factory-catalog-jam-songs
 */
import { randomUUID } from "node:crypto"
import { createFilesystemCatalogBundle } from "../lib/catalog/bundle"
import {
  flattenImportRecords,
  parseTopLevelManifest,
  verifyContentTreeSha256,
  verifyRecordsChecksum,
  type SectionManifest,
} from "../lib/catalog/manifest"
import { CATALOG_SECTION_ORDER, type CatalogSectionName } from "../lib/catalog/constants"
import { serviceKeyForSection } from "../lib/catalog/mapping"
import { getCatalogStore } from "../lib/catalog/runtime"
import { activateCatalogVersion } from "../lib/catalog/import"
import { getDb } from "../lib/db"
import { catalogEntries } from "../lib/db/schema"
import { eq } from "drizzle-orm"

const BATCH = 250

async function main(): Promise<void> {
  const bundlePath = process.argv[2]
  if (!bundlePath) {
    throw new Error("Usage: tsx scripts/catalog-import-fast.ts <bundle-dir>")
  }

  const bundle = createFilesystemCatalogBundle(bundlePath)
  const top = await bundle.readTopManifest()
  const contentTreeSha256 = top.content_tree_sha256.toLowerCase()
  parseTopLevelManifest(top)

  const store = getCatalogStore()
  const existing = await store.findVersionByContentTreeSha256(contentTreeSha256)
  if (existing?.status === "ready") {
    const activated = []
    for (const serviceKey of ["jam-player", "bass-drums", "solo-phrases", "lyrics"] as const) {
      await activateCatalogVersion(store, serviceKey, existing.id)
      activated.push(serviceKey)
    }
    process.stdout.write(
      `${JSON.stringify({ catalogVersionId: existing.id, deduplicated: true, activated }, null, 2)}\n`,
    )
    return
  }

  let versionId = existing?.id
  if (!versionId) {
    versionId = randomUUID()
    await store.insertVersion({
      id: versionId,
      contentTreeSha256,
      catalogExportVersion: top.catalog_export_version,
      schemaVersion: top.schema_version,
      sourceProvenance: top.source_provenance,
      status: "importing",
      sectionCounts: {},
      importCheckpoint: { completedStableIds: [] },
      createdAt: new Date(),
    })
  } else if (existing && existing.status !== "importing") {
    await store.updateVersion(existing.id, {
      status: "importing",
      errorMessage: null,
      updatedAt: new Date(),
      completedAt: null,
    })
  }

  const sectionManifests: SectionManifest[] = []
  const sectionCounts: Record<string, number> = {}
  for (const sectionName of CATALOG_SECTION_ORDER) {
    const summary = top.sections[sectionName]
    if (!summary) continue
    const section = await bundle.readSectionManifest(sectionName, summary.manifest_path)
    verifyRecordsChecksum(section)
    sectionManifests.push(section)
    sectionCounts[sectionName] = section.record_count
  }
  verifyContentTreeSha256(sectionManifests, top.content_tree_sha256)

  const db = getDb()
  const already = await db
    .select({ stableId: catalogEntries.stableId })
    .from(catalogEntries)
    .where(eq(catalogEntries.catalogVersionId, versionId!))
  const completed = new Set(already.map((row) => row.stableId))
  let imported = 0

  for (const section of sectionManifests) {
    const serviceKey = serviceKeyForSection(section.section as CatalogSectionName)
    const flat = flattenImportRecords(section.section as CatalogSectionName, section.records)
    const pending = flat.filter((item) => !completed.has(item.stableId))
    for (let i = 0; i < pending.length; i += BATCH) {
      const chunk = pending.slice(i, i + BATCH)
      const now = new Date()
      await db.insert(catalogEntries).values(
        chunk.map((item) => ({
          id: randomUUID(),
          catalogVersionId: versionId!,
          section: section.section,
          stableId: item.stableId,
          serviceKey,
          kind: item.kind,
          metadata: {
            ...item.metadata,
            asset: null,
          },
          blobReferenceId: null,
          createdAt: now,
        })),
      )
      for (const item of chunk) completed.add(item.stableId)
      imported += chunk.length
      process.stdout.write(
        `progress section=${section.section} imported=${imported}/${pending.length}\n`,
      )
    }
  }

  await store.updateVersion(versionId!, {
    status: "ready",
    sectionCounts,
    importCheckpoint: { completedStableIds: [...completed].sort() },
    errorMessage: null,
    updatedAt: new Date(),
    completedAt: new Date(),
  })

  const activated = []
  for (const serviceKey of ["jam-player", "bass-drums", "solo-phrases", "lyrics"] as const) {
    await activateCatalogVersion(store, serviceKey, versionId!)
    activated.push(serviceKey)
  }

  process.stdout.write(
    `${JSON.stringify(
      {
        catalogVersionId: versionId,
        contentTreeSha256,
        importedEntryCount: imported,
        activatedServices: activated,
      },
      null,
      2,
    )}\n`,
  )
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  process.stderr.write(`${message}\n`)
  process.exitCode = 1
})
