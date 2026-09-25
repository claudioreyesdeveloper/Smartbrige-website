import { randomUUID } from "crypto"
import { eq } from "drizzle-orm"
import { NextRequest, NextResponse } from "next/server"
import { requireDb } from "@/lib/db"
import { ensureFeatureFeedbackSchema } from "@/lib/feature-feedback-schema"
import { featureFeedback, featureFeedbackReplies } from "@/lib/db/schema"
import { getFeatureStory } from "@/lib/feature-stories"
import { requireAdminSession } from "@/lib/style-maker/admin-auth"

function clean(value: unknown, maxLength: number) {
  return typeof value === "string"
    ? value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim().slice(0, maxLength)
    : ""
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminSession()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const { id } = await params
    const body = (await request.json()) as Record<string, unknown>
    const reply = clean(body.reply, 3000)
    if (!reply) return NextResponse.json({ error: "Reply cannot be empty." }, { status: 400 })

    const db = requireDb()
    const [feedback] = await db
      .select()
      .from(featureFeedback)
      .where(eq(featureFeedback.id, id))
      .limit(1)
    if (!feedback) return NextResponse.json({ error: "Feedback not found." }, { status: 404 })

    await db.insert(featureFeedbackReplies).values({
      id: randomUUID(),
      feedbackId: id,
      authorName: "Claudio",
      body: reply,
      isPublic: 1,
    })

    const apiKey = process.env.RESEND_API_KEY
    if (apiKey && feedback.notifyOnReply === 1 && feedback.email) {
      const sender = process.env.DEMO_FEEDBACK_FROM || "SmartBridge Feedback <demo@thesmartbridge.io>"
      const story = getFeatureStory(feedback.featureId)
      void fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({
          from: sender,
          to: [feedback.email],
          subject: `Claudio replied to your ${story?.title || "SmartBridge"} feedback`,
          text: `Claudio replied to your SmartBridge feedback:\n\n${reply}\n\nOpen the discussion: https://thesmartbridge.io/explore/${feedback.featureId}`,
        }),
      }).catch(() => undefined)
    }

    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (error) {
    console.error("admin feedback reply failed", error)
    return NextResponse.json({ error: "Could not post reply." }, { status: 503 })
  }
}
