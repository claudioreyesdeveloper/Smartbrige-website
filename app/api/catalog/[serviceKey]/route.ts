import { NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth"
import { catalogErrorResponse } from "@/lib/catalog/http"
import { getCatalogService } from "@/lib/catalog/runtime"

export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{ serviceKey: string }>
}

function parseKinds(raw: string | null): string[] | undefined {
  if (!raw) return undefined
  const kinds = raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
  return kinds.length > 0 ? kinds : undefined
}

/** GET /api/catalog/:serviceKey — entitlement-gated active factory catalog metadata. */
export async function GET(request: Request, context: RouteContext) {
  try {
    const { serviceKey } = await context.params
    const userId = await getSessionUserId()
    const url = new URL(request.url)
    const kinds = parseKinds(url.searchParams.get("kinds"))
    const songStableId = url.searchParams.get("songStableId")?.trim() || undefined
    const modelKey = url.searchParams.get("modelKey")?.trim() || undefined
    const slimStyles =
      url.searchParams.get("slimStyles") === "1" ||
      url.searchParams.get("slimStyles") === "true" ||
      Boolean(modelKey)

    const catalog = await getCatalogService().listForService(userId, serviceKey, {
      kinds,
      songStableId,
      modelKey,
      slimStyles,
    })
    return NextResponse.json(catalog)
  } catch (error) {
    return catalogErrorResponse(error)
  }
}
