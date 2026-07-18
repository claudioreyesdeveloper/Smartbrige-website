import { NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth"
import { projectErrorResponse } from "@/lib/projects/http"
import { getProjectService } from "@/lib/projects/runtime"

export const runtime = "nodejs"

/**
 * GET /api/projects/export — account export of all active projects,
 * immutable revisions, and blob reference metadata for the owner.
 */
export async function GET() {
  try {
    const userId = await getSessionUserId()
    const payload = await getProjectService().exportAccount(userId)
    return NextResponse.json(payload)
  } catch (error) {
    return projectErrorResponse(error)
  }
}
