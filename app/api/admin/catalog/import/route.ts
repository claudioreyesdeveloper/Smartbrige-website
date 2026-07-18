import { NextResponse } from "next/server"
import { assertCatalogAdminToken } from "@/lib/catalog/admin"
import { CatalogError } from "@/lib/catalog/errors"
import { catalogErrorResponse, isPlainObject, readCatalogJsonBody } from "@/lib/catalog/http"
import { createCatalogImporterForBundlePath } from "@/lib/catalog/runtime"

export const runtime = "nodejs"

/**
 * POST /api/admin/catalog/import
 * Body: { bundlePath: string, activate?: boolean }
 *
 * Local/operator path import only (never mutates the desktop DB).
 * Requires CATALOG_ADMIN_TOKEN and CATALOG_ALLOW_LOCAL_PATH_IMPORT=1.
 */
export async function POST(request: Request) {
  try {
    assertCatalogAdminToken(request)
    if (process.env.CATALOG_ALLOW_LOCAL_PATH_IMPORT !== "1") {
      throw new CatalogError(
        "forbidden",
        "Local path catalog import is disabled. Set CATALOG_ALLOW_LOCAL_PATH_IMPORT=1 on an operator host.",
      )
    }

    const body = await readCatalogJsonBody(request)
    if (!isPlainObject(body) || typeof body.bundlePath !== "string" || !body.bundlePath.trim()) {
      throw new CatalogError("validation", "bundlePath is required.")
    }

    const activate = body.activate !== false
    const importer = createCatalogImporterForBundlePath(body.bundlePath.trim(), {
      activateOnSuccess: activate,
    })
    const result = await importer.importBundle()

    return NextResponse.json({
      catalogVersionId: result.version.id,
      contentTreeSha256: result.version.contentTreeSha256,
      status: result.version.status,
      deduplicated: result.deduplicated,
      resumed: result.resumed,
      importedEntryCount: result.importedEntryCount,
      activatedServices: result.activatedServices,
    })
  } catch (error) {
    return catalogErrorResponse(error)
  }
}
