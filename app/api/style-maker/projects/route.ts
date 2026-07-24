import { desc, eq } from "drizzle-orm"
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
  newProjectId,
  parseWriteBody,
  projectRowToWire,
} from "@/lib/style-maker/project-store"

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

export async function GET() {
  const auth = await requireProjectUser()
  if (auth instanceof NextResponse) return auth

  try {
    const database = requireDb()
    const rows = await database
      .select({
        id: styleMakerProjects.id,
        name: styleMakerProjects.name,
        donorFileName: styleMakerProjects.donorFileName,
        updatedAt: styleMakerProjects.updatedAt,
      })
      .from(styleMakerProjects)
      .where(eq(styleMakerProjects.userId, auth.userId))
      .orderBy(desc(styleMakerProjects.updatedAt))

    return NextResponse.json({
      projects: rows.map((row) => ({
        id: row.id,
        name: row.name,
        donorFileName: row.donorFileName,
        updatedAt: row.updatedAt.toISOString(),
      })),
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Could not list projects.",
      },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireProjectUser()
  if (auth instanceof NextResponse) return auth

  try {
    const raw = await request.json()
    const body = parseWriteBody(raw)
    const donorBytes = Buffer.from(base64ToBytes(body.donorBytesBase64))
    const lastBuiltBytes = body.lastBuiltBytesBase64
      ? Buffer.from(base64ToBytes(body.lastBuiltBytesBase64))
      : null
    const id = newProjectId()
    const now = new Date()
    const database = requireDb()

    const inserted = await database
      .insert(styleMakerProjects)
      .values({
        id,
        userId: auth.userId,
        name: body.name,
        donorFileName: body.donorFileName,
        donorBytes,
        lastBuiltFileName: body.lastBuiltFileName || null,
        lastBuiltBytes,
        payload: body.payload,
        createdAt: now,
        updatedAt: now,
      })
      .returning()

    return NextResponse.json(projectRowToWire(inserted[0]))
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
          error instanceof Error ? error.message : "Could not create project.",
      },
      { status: 400 },
    )
  }
}
