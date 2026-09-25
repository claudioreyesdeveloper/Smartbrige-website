import { createHash, randomUUID } from "crypto"
import type { NextRequest, NextResponse } from "next/server"

const COOKIE_NAME = "sb_feedback_id"

export function feedbackIdentity(request: NextRequest) {
  const existing = request.cookies.get(COOKIE_NAME)?.value?.trim()
  const id = existing || randomUUID()
  const salt = process.env.FEEDBACK_COOKIE_SECRET || "smartbridge-feedback-v1"
  const hash = createHash("sha256").update(`${salt}:${id}`).digest("hex")
  return { id, hash, isNew: !existing }
}

export function attachFeedbackCookie(
  response: NextResponse,
  identity: { id: string; isNew: boolean },
) {
  if (!identity.isNew) return
  response.cookies.set(COOKIE_NAME, identity.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  })
}
