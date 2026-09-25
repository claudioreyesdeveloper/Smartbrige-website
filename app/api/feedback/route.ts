import { randomUUID } from "crypto"
import { and, count, desc, eq, gt } from "drizzle-orm"
import { NextRequest, NextResponse } from "next/server"
import { requireDb } from "@/lib/db"
import {
  featureFeedback,
  featureFeedbackReplies,
  featureFeedbackVotes,
} from "@/lib/db/schema"
import { attachFeedbackCookie, feedbackIdentity } from "@/lib/feedback-identity"
import { ensureFeatureFeedbackSchema } from "@/lib/feature-feedback-schema"
import { getFeatureStory } from "@/lib/feature-stories"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function clean(value: unknown, maxLength: number) {
  return typeof value === "string"
    ? value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim().slice(0, maxLength)
    : ""
}

async function publicFeedback(featureId?: string | null) {
  const db = requireDb()
  const rows = await db
    .select()
    .from(featureFeedback)
    .where(
      featureId
        ? and(eq(featureFeedback.isHidden, 0), eq(featureFeedback.featureId, featureId))
        : eq(featureFeedback.isHidden, 0),
    )
    .orderBy(desc(featureFeedback.createdAt))
    .limit(featureId ? 100 : 200)

  return Promise.all(
    rows.map(async (row) => {
      const [voteRow] = await db
        .select({ value: count() })
        .from(featureFeedbackVotes)
        .where(eq(featureFeedbackVotes.feedbackId, row.id))
      const replies = await db
        .select({
          id: featureFeedbackReplies.id,
          body: featureFeedbackReplies.body,
          authorName: featureFeedbackReplies.authorName,
          createdAt: featureFeedbackReplies.createdAt,
        })
        .from(featureFeedbackReplies)
        .where(
          and(
            eq(featureFeedbackReplies.feedbackId, row.id),
            eq(featureFeedbackReplies.isPublic, 1),
          ),
        )
        .orderBy(featureFeedbackReplies.createdAt)

      return {
        id: row.id,
        featureId: row.featureId,
        type: row.type,
        pulse: row.pulse,
        comment: row.comment,
        displayName: row.displayName,
        videoSeconds: row.videoSeconds,
        status: row.status,
        createdAt: row.createdAt,
        votes: Number(voteRow?.value || 0),
        replies,
      }
    }),
  )
}

export async function GET(request: NextRequest) {
  try {
    const featureId = clean(request.nextUrl.searchParams.get("feature"), 80)
    if (featureId && !getFeatureStory(featureId)) {
      return NextResponse.json({ error: "Unknown feature." }, { status: 404 })
    }
    const feedback = await publicFeedback(featureId || null)
    return NextResponse.json({ feedback })
  } catch (error) {
    console.error("feedback GET failed", error)
    return NextResponse.json({ error: "Feedback is temporarily unavailable." }, { status: 503 })
  }
}

export async function POST(request: NextRequest) {
  const identity = feedbackIdentity(request)

  try {
    const body = (await request.json()) as Record<string, unknown>
    if (clean(body.website, 200)) {
      const response = NextResponse.json({ ok: true })
      attachFeedbackCookie(response, identity)
      return response
    }

    const featureId = clean(body.featureId, 80)
    const story = getFeatureStory(featureId)
    if (!story) return NextResponse.json({ error: "Unknown feature." }, { status: 400 })

    const type = clean(body.type, 20)
    const pulse = clean(body.pulse, 10)
    const comment = clean(body.comment, 2000)
    const displayName = clean(body.displayName, 80) || "Anonymous"
    const notify = body.notify === true
    const email = clean(body.email, 254).toLowerCase()
    const rawVideoSeconds = Number(body.videoSeconds)
    const videoSeconds = Number.isFinite(rawVideoSeconds) && rawVideoSeconds >= 0
      ? Math.min(60 * 60 * 4, Math.round(rawVideoSeconds))
      : null

    if (!["feedback", "suggestion", "problem"].includes(type)) {
      return NextResponse.json({ error: "Choose a valid feedback type." }, { status: 400 })
    }
    if (pulse && !["yes", "maybe", "no"].includes(pulse)) {
      return NextResponse.json({ error: "Choose a valid response." }, { status: 400 })
    }
    if (!pulse && !comment) {
      return NextResponse.json({ error: "Add a response or comment." }, { status: 400 })
    }
    if (notify && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Add a valid email for reply notifications." }, { status: 400 })
    }

    const db = requireDb()
    const since = new Date(Date.now() - 15 * 60 * 1000)
    const [recent] = await db
      .select({ value: count() })
      .from(featureFeedback)
      .where(
        and(
          eq(featureFeedback.fingerprintHash, identity.hash),
          gt(featureFeedback.createdAt, since),
        ),
      )
    if (Number(recent?.value || 0) >= 5) {
      return NextResponse.json({ error: "Too many submissions. Please try again later." }, { status: 429 })
    }

    const id = randomUUID()
    await db.insert(featureFeedback).values({
      id,
      featureId,
      type,
      pulse: pulse || null,
      comment,
      displayName,
      email: notify ? email : null,
      notifyOnReply: notify ? 1 : 0,
      videoSeconds,
      status: "new",
      fingerprintHash: identity.hash,
    })

    const apiKey = process.env.RESEND_API_KEY
    const recipient = process.env.DEMO_FEEDBACK_TO
    if (apiKey && recipient) {
      const sender = process.env.DEMO_FEEDBACK_FROM || "SmartBridge Feedback <demo@thesmartbridge.io>"
      const timestamp = videoSeconds == null
        ? ""
        : `\nVideo moment: ${Math.floor(videoSeconds / 60)}:${String(videoSeconds % 60).padStart(2, "0")}`
      void fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({
          from: sender,
          to: [recipient],
          subject: `SmartBridge feedback — ${story.title} — ${type}`,
          text: `Feature: ${story.title}\nType: ${type}\nWould use: ${pulse || "not answered"}${timestamp}\nName: ${displayName}\nNotify on reply: ${notify ? "yes" : "no"}\nEmail: ${notify ? email : "not provided"}\n\n${comment || "No written comment."}`,
        }),
      }).catch(() => undefined)
    }

    const response = NextResponse.json({ ok: true, id }, { status: 201 })
    attachFeedbackCookie(response, identity)
    return response
  } catch (error) {
    console.error("feedback POST failed", error)
    return NextResponse.json({ error: "Feedback could not be posted." }, { status: 503 })
  }
}
