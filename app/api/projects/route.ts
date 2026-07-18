import { NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth"
import { isPlainObject, projectErrorResponse, readJsonBody } from "@/lib/projects/http"
import { getProjectService } from "@/lib/projects/runtime"
import { ProjectError } from "@/lib/projects/errors"

export const runtime = "nodejs"

/** GET /api/projects — list the authenticated user's active projects. */
export async function GET() {
  try {
    const userId = await getSessionUserId()
    const projects = await getProjectService().list(userId)
    return NextResponse.json({ projects })
  } catch (error) {
    return projectErrorResponse(error)
  }
}

/** POST /api/projects — create a project with an initial revision. */
export async function POST(request: Request) {
  try {
    const userId = await getSessionUserId()
    const body = await readJsonBody(request)
    if (!isPlainObject(body)) {
      throw new ProjectError("validation", "Request body must be a JSON object.")
    }

    const title = typeof body.title === "string" ? body.title : undefined
    const document = body.document
    const project = await getProjectService().create({ userId, title, document })
    return NextResponse.json({ project }, { status: 201 })
  } catch (error) {
    return projectErrorResponse(error)
  }
}
