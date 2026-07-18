import { NextResponse } from "next/server"
import { requireSessionUserId } from "@/lib/auth"
import { getStorageService } from "@/lib/storage/runtime"
import { storageErrorResponse } from "@/lib/storage/http"

export const runtime = "nodejs"

/** Delete the caller's non-factory Blob objects and blob_references rows. */
export async function DELETE() {
  try {
    const userId = await requireSessionUserId()
    const result = await getStorageService().cleanupAccountAssets(userId)
    return NextResponse.json({ ok: true, deleted: result.deleted })
  } catch (error) {
    return storageErrorResponse(error)
  }
}
