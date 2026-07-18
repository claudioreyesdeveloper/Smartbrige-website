import { NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth"
import { projectErrorResponse } from "@/lib/projects/http"
import { getProjectService } from "@/lib/projects/runtime"

export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{ projectId: string }>
}

/** GET /api/projects/:projectId/export — export one owned project and its revisions. */
export async function GET(_request: Request, context: RouteContext) {
  try {
    const { projectId } = await context.params
    const userId = await getSessionUserId()
    const payload = await getProjectService().exportProject(userId, projectId)
    return NextResponse.json(payload)
  } catch (error) {
    return projectErrorResponse(error)
  }
}
