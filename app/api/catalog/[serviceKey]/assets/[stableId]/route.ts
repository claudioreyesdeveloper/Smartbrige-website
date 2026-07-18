import { NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth"
import { catalogErrorResponse } from "@/lib/catalog/http"
import { getCatalogService } from "@/lib/catalog/runtime"

export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{ serviceKey: string; stableId: string }>
}

/**
 * GET /api/catalog/:serviceKey/assets/:stableId
 * Short-lived private Blob access for a factory catalog asset (A09).
 */
export async function GET(_request: Request, context: RouteContext) {
  try {
    const { serviceKey, stableId } = await context.params
    const userId = await getSessionUserId()
    const download = await getCatalogService().authorizeAssetAccess(
      userId,
      serviceKey,
      decodeURIComponent(stableId),
    )
    return NextResponse.json({
      blobReferenceId: download.blobReferenceId,
      contentType: download.contentType,
      byteSize: download.byteSize,
      filename: download.filename,
      contentDisposition: download.contentDisposition,
      presignedUrl: download.presignedUrl,
      expiresAt: download.expiresAt.toISOString(),
    })
  } catch (error) {
    return catalogErrorResponse(error)
  }
}
