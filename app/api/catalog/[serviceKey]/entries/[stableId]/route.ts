import { NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth"
import { catalogErrorResponse } from "@/lib/catalog/http"
import { getCatalogService } from "@/lib/catalog/runtime"

export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{ serviceKey: string; stableId: string }>
}

/** GET /api/catalog/:serviceKey/entries/:stableId */
export async function GET(_request: Request, context: RouteContext) {
  try {
    const { serviceKey, stableId } = await context.params
    const userId = await getSessionUserId()
    const entry = await getCatalogService().getEntry(userId, serviceKey, decodeURIComponent(stableId))
    return NextResponse.json({ entry })
  } catch (error) {
    return catalogErrorResponse(error)
  }
}
