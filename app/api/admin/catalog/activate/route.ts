import { NextResponse } from "next/server"
import { assertCatalogAdminToken } from "@/lib/catalog/admin"
import { CatalogError } from "@/lib/catalog/errors"
import { catalogErrorResponse, isPlainObject, readCatalogJsonBody } from "@/lib/catalog/http"
import { getCatalogService } from "@/lib/catalog/runtime"

export const runtime = "nodejs"

/**
 * POST /api/admin/catalog/activate
 * Body: { serviceKey, catalogVersionId } | { serviceKey, rollback: true }
 */
export async function POST(request: Request) {
  try {
    assertCatalogAdminToken(request)
    const body = await readCatalogJsonBody(request)
    if (!isPlainObject(body) || typeof body.serviceKey !== "string") {
      throw new CatalogError("validation", "serviceKey is required.")
    }

    const service = getCatalogService()
    if (body.rollback === true) {
      const result = await service.rollback(body.serviceKey)
      return NextResponse.json(result)
    }

    if (typeof body.catalogVersionId !== "string" || !body.catalogVersionId.trim()) {
      throw new CatalogError("validation", "catalogVersionId is required unless rollback=true.")
    }

    const result = await service.activate(body.serviceKey, body.catalogVersionId.trim())
    return NextResponse.json(result)
  } catch (error) {
    return catalogErrorResponse(error)
  }
}
