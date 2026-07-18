import { NextResponse } from "next/server"
import { assertCatalogAdminToken } from "@/lib/catalog/admin"
import { catalogErrorResponse } from "@/lib/catalog/http"
import { getCatalogService } from "@/lib/catalog/runtime"

export const runtime = "nodejs"

/** GET /api/admin/catalog/versions — list immutable import versions and activations. */
export async function GET(request: Request) {
  try {
    assertCatalogAdminToken(request)
    const service = getCatalogService()
    const [versions, activations] = await Promise.all([
      service.listVersions(),
      service.listActivations(),
    ])
    return NextResponse.json({ versions, activations })
  } catch (error) {
    return catalogErrorResponse(error)
  }
}
