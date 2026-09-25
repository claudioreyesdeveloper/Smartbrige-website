import { randomUUID } from "crypto"
import { eq } from "drizzle-orm"
import { NextRequest, NextResponse } from "next/server"
import { requireDb } from "@/lib/db"
import { ensureFeatureFeedbackSchema } from "@/lib/feature-feedback-schema"
import { featureFeedback, featureFeedbackVotes } from "@/lib/db/schema"
import { attachFeedbackCookie, feedbackIdentity } from "@/lib/feedback-identity"

export const runtime = "nodejs"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const identity = feedbackIdentity(request)
  try {
    const { id } = await params
    const db = requireDb()
    const [target] = await db
      .select({ id: featureFeedback.id })
      .from(featureFeedback)
      .where(eq(featureFeedback.id, id))
      .limit(1)

    if (!target) return NextResponse.json({ error: "Feedback not found." }, { status: 404 })

    await db
      .insert(featureFeedbackVotes)
      .values({
        id: randomUUID(),
        feedbackId: id,
        fingerprintHash: identity.hash,
      })
      .onConflictDoNothing()

    const response = NextResponse.json({ ok: true })
    attachFeedbackCookie(response, identity)
    return response
  } catch (error) {
    console.error("feedback vote failed", error)
    return NextResponse.json({ error: "Vote could not be recorded." }, { status: 503 })
  }
}
