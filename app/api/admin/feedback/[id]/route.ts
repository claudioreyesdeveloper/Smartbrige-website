import { eq } from "drizzle-orm"
import { NextRequest, NextResponse } from "next/server"
import { requireDb } from "@/lib/db"
import { ensureFeatureFeedbackSchema } from "@/lib/feature-feedback-schema"
import {
  featureFeedback,
  featureFeedbackReplies,
  featureFeedbackVotes,
} from "@/lib/db/schema"
import { requireAdminSession } from "@/lib/style-maker/admin-auth"

const STATUSES = new Set(["new", "under_review", "planned", "building", "shipped", "not_planned"])

function clean(value: unknown, maxLength: number) {
  return typeof value === "string"
    ? value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim().slice(0, maxLength)
    : ""
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminSession()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    await ensureFeatureFeedbackSchema()
    const { id } = await params
    const body = (await request.json()) as {
      status?: string
      isHidden?: boolean
      comment?: string
    }
    const changes: {
      status?: string
      isHidden?: number
      comment?: string
      updatedAt: Date
    } = {
      updatedAt: new Date(),
    }

    if (body.status !== undefined) {
      if (!STATUSES.has(body.status)) {
        return NextResponse.json({ error: "Invalid status." }, { status: 400 })
      }
      changes.status = body.status
    }
    if (body.isHidden !== undefined) changes.isHidden = body.isHidden ? 1 : 0
    if (body.comment !== undefined) changes.comment = clean(body.comment, 2000)

    const db = requireDb()
    await db.update(featureFeedback).set(changes).where(eq(featureFeedback.id, id))
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("admin feedback PATCH failed", error)
    return NextResponse.json({ error: "Could not update feedback." }, { status: 503 })
  }
}


export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminSession()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    await ensureFeatureFeedbackSchema()
    const { id } = await params
    const db = requireDb()

    await db.transaction(async (tx) => {
      await tx.delete(featureFeedbackReplies).where(eq(featureFeedbackReplies.feedbackId, id))
      await tx.delete(featureFeedbackVotes).where(eq(featureFeedbackVotes.feedbackId, id))
      await tx.delete(featureFeedback).where(eq(featureFeedback.id, id))
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("admin feedback DELETE failed", error)
    return NextResponse.json({ error: "Could not delete feedback." }, { status: 503 })
  }
}
