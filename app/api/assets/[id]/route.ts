import { NextResponse } from "next/server"
import { requireSessionUserId } from "@/lib/auth"
import { getStorageService } from "@/lib/storage/runtime"
import { storageErrorResponse } from "@/lib/storage/http"

export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const userId = await requireSessionUserId()
    const { id } = await context.params
    const download = await getStorageService().authorizeDownload(userId, id)

    // Never return Blob tokens or DB credentials — only the short-lived presigned URL.
    return NextResponse.json({
      id: download.blobReferenceId,
      contentType: download.contentType,
      byteSize: download.byteSize,
      filename: download.filename,
      contentDisposition: download.contentDisposition,
      url: download.presignedUrl,
      expiresAt: download.expiresAt.toISOString(),
    })
  } catch (error) {
    return storageErrorResponse(error)
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const userId = await requireSessionUserId()
    const { id } = await context.params
    await getStorageService().deleteAsset(userId, id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return storageErrorResponse(error)
  }
}
