import { NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth"
import { ProjectError } from "@/lib/projects/errors"
import { isPlainObject, projectErrorResponse, readJsonBody } from "@/lib/projects/http"
import { getProjectService } from "@/lib/projects/runtime"

export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{ projectId: string }>
}

/** GET /api/projects/:projectId — load current revision for the owner. */
export async function GET(_request: Request, context: RouteContext) {
  try {
    const { projectId } = await context.params
    const userId = await getSessionUserId()
    const project = await getProjectService().load(userId, projectId)
    return NextResponse.json({ project })
  } catch (error) {
    return projectErrorResponse(error)
  }
}

/**
 * PUT /api/projects/:projectId — save a new immutable revision with
 * optimistic concurrency (`expectedRevisionId` + `expectedVersion`).
 */
export async function PUT(request: Request, context: RouteContext) {
  try {
    const { projectId } = await context.params
    const userId = await getSessionUserId()
    const body = await readJsonBody(request)
    if (!isPlainObject(body)) {
      throw new ProjectError("validation", "Request body must be a JSON object.")
    }
    if (!("document" in body)) {
      throw new ProjectError("validation", "document is required.")
    }
    if (typeof body.expectedRevisionId !== "string") {
      throw new ProjectError("validation", "expectedRevisionId is required.")
    }
    if (typeof body.expectedVersion !== "number") {
      throw new ProjectError("validation", "expectedVersion is required.")
    }

    const title = typeof body.title === "string" ? body.title : undefined
    const project = await getProjectService().save({
      userId,
      projectId,
      document: body.document,
      expectedRevisionId: body.expectedRevisionId,
      expectedVersion: body.expectedVersion,
      title,
    })
    return NextResponse.json({ project })
  } catch (error) {
    return projectErrorResponse(error)
  }
}

/**
 * DELETE /api/projects/:projectId — soft-delete the project for the owner.
 * Revisions remain immutable; blob project links are detached.
 */
export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { projectId } = await context.params
    const userId = await getSessionUserId()
    const result = await getProjectService().delete(userId, projectId)
    return NextResponse.json(result)
  } catch (error) {
    return projectErrorResponse(error)
  }
}
