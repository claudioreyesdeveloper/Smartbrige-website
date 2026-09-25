import { eq } from "drizzle-orm"
import { NextRequest, NextResponse } from "next/server"
import { requireDb } from "@/lib/db"
import { ensureFeatureFeedbackSchema } from "@/lib/feature-feedback-schema"
import { featureFeedback } from "@/lib/db/schema"
import { requireAdminSession } from "@/lib/style-maker/admin-auth"

const STATUSES = new Set(["new", "under_review", "planned", "building", "shipped", "not_planned"])

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminSession()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    await ensureFeatureFeedbackSchema()
    const { id } = await params
    const body = (await request.json()) as { status?: string; isHidden?: boolean }
    const changes: { status?: string; isHidden?: number; updatedAt: Date } = {
      updatedAt: new Date(),
    }

    if (body.status !== undefined) {
      if (!STATUSES.has(body.status)) {
        return NextResponse.json({ error: "Invalid status." }, { status: 400 })
      }
      changes.status = body.status
    }
    if (body.isHidden !== undefined) changes.isHidden = body.isHidden ? 1 : 0

    const db = requireDb()
    await db.update(featureFeedback).set(changes).where(eq(featureFeedback.id, id))
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("admin feedback PATCH failed", error)
    return NextResponse.json({ error: "Could not update feedback." }, { status: 503 })
  }
}
