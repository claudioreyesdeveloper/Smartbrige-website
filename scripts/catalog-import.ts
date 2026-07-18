/**
 * Operator entrypoint for A06 → Neon/Blob catalog import.
 *
 * Usage (on a host with env + bundle path; does not touch the desktop DB):
 *   CATALOG_SYSTEM_USER_ID=... DATABASE_URL=... BLOB_READ_WRITE_TOKEN=... \
 *     npx --yes tsx scripts/catalog-import.ts /path/to/a06-export
 *
 * Optional: --no-activate
 */
import { createCatalogImporterForBundlePath } from "../lib/catalog/runtime"

async function main(): Promise<void> {
  const args = process.argv.slice(2).filter((arg) => arg !== "--no-activate")
  const activateOnSuccess = !process.argv.includes("--no-activate")
  const bundlePath = args[0]
  if (!bundlePath) {
    throw new Error("Usage: tsx scripts/catalog-import.ts <a06-export-dir> [--no-activate]")
  }

  const importer = createCatalogImporterForBundlePath(bundlePath, { activateOnSuccess })
  const result = await importer.importBundle()
  process.stdout.write(
    `${JSON.stringify(
      {
        catalogVersionId: result.version.id,
        contentTreeSha256: result.version.contentTreeSha256,
        status: result.version.status,
        deduplicated: result.deduplicated,
        resumed: result.resumed,
        importedEntryCount: result.importedEntryCount,
        activatedServices: result.activatedServices,
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
