import { and, eq } from "drizzle-orm"
import { NextRequest, NextResponse } from "next/server"
import { db, requireDb } from "@/lib/db"
import { styleMakerProjects } from "@/lib/db/schema"
import {
  getAuthUserId,
  userHasActiveSubscription,
} from "@/lib/style-maker/entitlements"
import {
  base64ToBytes,
  isUniqueViolation,
  parseWriteBody,
  projectRowToWire,
} from "@/lib/style-maker/project-store"

type RouteContext = { params: Promise<{ id: string }> }

async function requireProjectUser(): Promise<
  { userId: string } | NextResponse
> {
  const userId = await getAuthUserId()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!(await userHasActiveSubscription(userId))) {
    return NextResponse.json({ error: "Subscription required" }, { status: 402 })
  }
  if (!db) {
    return NextResponse.json(
      { error: "DATABASE_URL is not configured." },
      { status: 503 },
    )
  }
  return { userId }
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const auth = await requireProjectUser()
  if (auth instanceof NextResponse) return auth
  const { id } = await context.params
  if (!id?.trim()) {
    return NextResponse.json({ error: "Missing project id." }, { status: 400 })
  }

  try {
    const database = requireDb()
    const rows = await database
      .select()
      .from(styleMakerProjects)
      .where(
        and(
          eq(styleMakerProjects.id, id),
          eq(styleMakerProjects.userId, auth.userId),
        ),
      )
      .limit(1)
    const row = rows[0]
    if (!row) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 })
    }
    return NextResponse.json(projectRowToWire(row))
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Could not load project.",
      },
      { status: 500 },
    )
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const auth = await requireProjectUser()
  if (auth instanceof NextResponse) return auth
  const { id } = await context.params
  if (!id?.trim()) {
    return NextResponse.json({ error: "Missing project id." }, { status: 400 })
  }

  try {
    const raw = await request.json()
    const body = parseWriteBody(raw)
    const donorBytes = Buffer.from(base64ToBytes(body.donorBytesBase64))
    const lastBuiltBytes = body.lastBuiltBytesBase64
      ? Buffer.from(base64ToBytes(body.lastBuiltBytesBase64))
      : null
    const now = new Date()
    const database = requireDb()

    const updated = await database
      .update(styleMakerProjects)
      .set({
        name: body.name,
        donorFileName: body.donorFileName,
        donorBytes,
        lastBuiltFileName: body.lastBuiltFileName || null,
        lastBuiltBytes,
        payload: body.payload,
        updatedAt: now,
      })
      .where(
        and(
          eq(styleMakerProjects.id, id),
          eq(styleMakerProjects.userId, auth.userId),
        ),
      )
      .returning()

    if (!updated[0]) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 })
    }
    return NextResponse.json(projectRowToWire(updated[0]))
  } catch (error) {
    if (isUniqueViolation(error)) {
      return NextResponse.json(
        { error: "A project with that name already exists." },
        { status: 409 },
      )
    }
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Could not update project.",
      },
      { status: 400 },
    )
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const auth = await requireProjectUser()
  if (auth instanceof NextResponse) return auth
  const { id } = await context.params
  if (!id?.trim()) {
    return NextResponse.json({ error: "Missing project id." }, { status: 400 })
  }

  try {
    const database = requireDb()
    const deleted = await database
      .delete(styleMakerProjects)
      .where(
        and(
          eq(styleMakerProjects.id, id),
          eq(styleMakerProjects.userId, auth.userId),
        ),
      )
      .returning({ id: styleMakerProjects.id })

    if (!deleted[0]) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 })
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Could not delete project.",
      },
      { status: 500 },
    )
  }
}
