import { NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth"
import { catalogErrorResponse } from "@/lib/catalog/http"
import { getCatalogService } from "@/lib/catalog/runtime"

export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{ serviceKey: string }>
}

/** GET /api/catalog/:serviceKey — entitlement-gated active factory catalog metadata. */
export async function GET(_request: Request, context: RouteContext) {
  try {
    const { serviceKey } = await context.params
    const userId = await getSessionUserId()
    const catalog = await getCatalogService().listForService(userId, serviceKey)
    return NextResponse.json(catalog)
  } catch (error) {
    return catalogErrorResponse(error)
  }
}
