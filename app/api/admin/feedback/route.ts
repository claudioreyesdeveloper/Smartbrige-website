import { count, desc, eq } from "drizzle-orm"
import { NextRequest, NextResponse } from "next/server"
import { requireDb } from "@/lib/db"
import {
  featureFeedback,
  featureFeedbackReplies,
  featureFeedbackVotes,
} from "@/lib/db/schema"
import { requireAdminSession } from "@/lib/style-maker/admin-auth"

export const dynamic = "force-dynamic"

export async function GET(_request: NextRequest) {
  const auth = await requireAdminSession()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const db = requireDb()
    const rows = await db
      .select()
      .from(featureFeedback)
      .orderBy(desc(featureFeedback.createdAt))
      .limit(500)

    const feedback = await Promise.all(
      rows.map(async (row) => {
        const [voteRow] = await db
          .select({ value: count() })
          .from(featureFeedbackVotes)
          .where(eq(featureFeedbackVotes.feedbackId, row.id))
        const replies = await db
          .select()
          .from(featureFeedbackReplies)
          .where(eq(featureFeedbackReplies.feedbackId, row.id))
          .orderBy(featureFeedbackReplies.createdAt)

        return {
          ...row,
          votes: Number(voteRow?.value || 0),
          replies,
        }
      }),
    )
    return NextResponse.json({ feedback })
  } catch (error) {
    console.error("admin feedback GET failed", error)
    return NextResponse.json({ error: "Could not load feedback." }, { status: 503 })
  }
}
